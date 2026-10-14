'use strict';
let session=null;let worker=null;
function notify(status){return chrome.runtime.sendMessage({type:'CL_AUDIO_EVENT',token:session?.token,...status}).catch(()=>{});}
async function releaseAudio(current){
  current.stream?.getTracks().forEach(track=>track.stop());
  if(current.output&&current.output.state!=='closed')await current.output.close().catch(()=>{});
}
async function cancel(){
  const old=session;session=null;if(worker){worker.terminate();worker=null;}
  if(old){old.cancelled=true;clearTimeout(old.limit);if(old.recorder?.state==='recording')old.recorder.stop();await releaseAudio(old);}
  await notify({stage:'cancelled',token:old?.token,message:'Audio timing stopped. The instant word effect is still ready.'});
}
async function start(message){
  if(session)throw new Error('Audio analysis is already running. Stop it before starting another song.');
  const current={token:message.token,videoId:message.videoId,lines:message.lines,duration:message.duration,parts:[],anchors:[],cancelled:false,phase:'capturing',startedAt:Date.now(),lastClock:Date.now()};session=current;
  try{
    current.stream=await navigator.mediaDevices.getUserMedia({audio:{mandatory:{chromeMediaSource:'tab',chromeMediaSourceId:message.streamId}},video:false});
    if(current.cancelled||session!==current){await releaseAudio(current);return {cancelled:true};}
    current.output=new AudioContext();const source=current.output.createMediaStreamSource(current.stream);source.connect(current.output.destination);await current.output.resume();
    if(current.cancelled||session!==current){await releaseAudio(current);return {cancelled:true};}
    const options=MediaRecorder.isTypeSupported('audio/webm;codecs=opus')?{mimeType:'audio/webm;codecs=opus',audioBitsPerSecond:128000}:{};
    current.recorder=new MediaRecorder(current.stream,options);
    current.recorder.ondataavailable=event=>{if(event.data.size&&!current.cancelled)current.parts.push(event.data);};
    current.recorder.onstop=()=>{if(!current.cancelled)analyze(current).catch(async error=>{if(session!==current)return;session=null;await releaseAudio(current);notify({stage:'error',token:current.token,message:error.message||'Audio analysis failed.'});});};
    current.recorder.onerror=()=>{cancel();};
    current.startedAt=Date.now();current.recorder.start(1000);
    current.limit=setTimeout(()=>finish(),Math.min(20*60*1000,Math.max(60000,(current.duration+120)*1000)));
    await notify({stage:'capturing',message:'Listening to this song locally. Word timing will be ready for replay.',progress:0});
    return {startedAt:current.startedAt};
  }catch(error){session=null;await releaseAudio(current);throw error;}
}
async function finish(){
  if(!session||session.phase!=='capturing')return;
  const current=session;current.phase='analyzing';clearTimeout(current.limit);
  if(current.recorder?.state==='recording')current.recorder.stop();
  await notify({stage:'analyzing',message:'Preparing captured song audio…',progress:0});
}
async function analyze(current){
  if(current.cancelled||session!==current)return;
  const blob=new Blob(current.parts,{type:current.recorder.mimeType});current.parts=[];
  await releaseAudio(current);
  if(blob.size<1000||current.anchors.length<3)throw new Error('Not enough audio was captured. Play the song before generating timing.');
  const decode=new AudioContext();let decoded;
  try{decoded=await decode.decodeAudioData(await blob.arrayBuffer());}finally{await decode.close();}
  const offline=new OfflineAudioContext(1,Math.ceil(decoded.duration*16000),16000);const source=offline.createBufferSource();source.buffer=decoded;source.connect(offline.destination);source.start();
  const rendered=await offline.startRendering();const audio=rendered.getChannelData(0).slice();
  const durationSeconds=(Date.now()-current.startedAt)/1000;
  const recordedEnd=current.anchors.at(-1)?.audioTime||durationSeconds;
  if(Math.abs(rendered.duration-recordedEnd)<.5&&recordedEnd>1){const scale=rendered.duration/recordedEnd;for(const anchor of current.anchors)anchor.audioTime*=scale;}
  worker=new Worker('audio-worker.js',{type:'module'});
  worker.onmessage=async event=>{
    if(current.cancelled||session!==current)return;
    const data=event.data;
    if(data.type==='PROGRESS'){notify({stage:data.stage,message:data.message,progress:data.progress});return;}
    if(data.type==='ERROR'){session=null;worker.terminate();worker=null;notify({stage:'error',token:current.token,message:data.message});return;}
    if(data.type==='DONE'){
      try{const timing=CrystalWordTiming.fromAudio(current.lines,data.chunks,current.anchors,current.duration);
        await notify({stage:'done',token:current.token,message:'Audio timing saved. Replay this video to use it.',videoId:current.videoId,timing});
      }catch(error){await notify({stage:'error',message:error.message});}
      session=null;worker.terminate();worker=null;
    }
  };
  worker.onerror=event=>{if(session!==current)return;session=null;worker?.terminate();worker=null;notify({stage:'error',token:current.token,message:event.message||'The local audio model could not start.'});};
  worker.postMessage({type:'ANALYZE',audio:audio.buffer},[audio.buffer]);
}
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(sender.id!==chrome.runtime.id||message?.target!=='cl-offscreen')return false;
  if(message.type==='CL_OS_CLOCK'){
    if(session?.phase==='capturing'){
      const current=session;const clock=message.clock;
      if(clock.videoId!==current.videoId){cancel();reply({ok:true});return false;}
      current.lastClock=Date.now();const audioTime=(clock.wallTime-current.startedAt)/1000;
      if(audioTime>=0)current.anchors.push({...clock,audioTime});
      if(clock.ended)finish();
    }reply({ok:true});return false;
  }
  const operation=message.type==='CL_OS_START'?()=>start(message):message.type==='CL_OS_FINISH'?finish:message.type==='CL_OS_CANCEL'?cancel:null;
  if(!operation)return false;
  Promise.resolve().then(operation).then(result=>reply({ok:true,result}),error=>reply({ok:false,error:error.message}));return true;
});
setInterval(()=>{if(session?.phase==='capturing'&&Date.now()-session.lastClock>12000)cancel();},3000);
