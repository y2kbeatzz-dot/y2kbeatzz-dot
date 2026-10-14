(() => {
  'use strict';
  const busy=['capturing','preparing','model','analyzing'];let creation=null;let starting=false;let lastStatusWrite=0;
  function trusted(sender,page){
    if(sender.id!==chrome.runtime.id)return false;
    try{const url=new URL(sender.url);return url.protocol==='chrome-extension:'&&url.hostname===chrome.runtime.id&&url.pathname==='/'+page;}catch(_){return false;}
  }
  async function state(){const stored=await chrome.storage.local.get('audioState');return stored.audioState||{stage:'idle',message:'Ready for local audio timing.'};}
  async function update(patch,force=true){
    const previous=await state();const value={...previous,...patch,updatedAt:Date.now()};
    if(force||Date.now()-lastStatusWrite>500){lastStatusWrite=Date.now();await chrome.storage.local.set({audioState:value});}
    if(value.tabId)chrome.tabs.sendMessage(value.tabId,{type:'CL_AUDIO_UPDATE',...value}).catch(()=>{});
    return value;
  }
  async function hasOffscreen(){const contexts=await chrome.runtime.getContexts({contextTypes:['OFFSCREEN_DOCUMENT'],documentUrls:[chrome.runtime.getURL('offscreen.html')]});return contexts.length>0;}
  async function ensureOffscreen(){
    if(await hasOffscreen())return;
    if(!creation)creation=chrome.offscreen.createDocument({url:'offscreen.html',reasons:['USER_MEDIA','WORKERS'],justification:'Analyze the current YouTube song locally for word timestamps and preserve its audible playback.'}).finally(()=>{creation=null;});
    await creation;
  }
  async function offscreen(type,payload={}){
    const reply=await chrome.runtime.sendMessage({target:'cl-offscreen',type,...payload});
    if(!reply?.ok)throw new Error(reply?.error||'The local audio tool did not respond. Reload the extension.');return reply.result;
  }
  async function start(tabId){
    if(starting)throw new Error('The audio tool is already starting.');starting=true;let launched=false;
    try{
      const previous=await state();if(busy.includes(previous.stage)&&await hasOffscreen())throw new Error('Audio timing is already running. Finish or cancel it first.');
      const tab=await chrome.tabs.get(tabId);const url=new URL(tab.url||'');
      if(url.protocol!=='https:'||!['www.youtube.com','music.youtube.com'].includes(url.hostname))throw new Error('Open the YouTube song tab before starting audio timing.');
      const context=await chrome.tabs.sendMessage(tabId,{type:'CL_AUDIO_CONTEXT'});
      if(!context?.ok)throw new Error(context?.error||'Refresh this YouTube tab after updating the extension.');
      if(context.duration<3||context.duration>1200)throw new Error('Local audio timing supports songs from 3 seconds to 20 minutes.');
      if(!context.lines?.length||context.lines.length>4000)throw new Error('Load a line-timed lyric version first using Find song or Load lyrics.');
      await ensureOffscreen();
      const token=crypto.randomUUID();
      // Get the stream ID only after the offscreen document is ready; IDs expire quickly.
      const streamId=await chrome.tabCapture.getMediaStreamId({targetTabId:tabId});
      launched=true;await update({stage:'preparing',tabId,videoId:context.videoId,token,message:'Starting local song capture…',progress:0});
      const capture=await offscreen('CL_OS_START',{streamId,videoId:context.videoId,lines:context.lines,duration:context.duration,token});
      if(capture?.cancelled)return state();
      const playing=await chrome.tabs.sendMessage(tabId,{type:'CL_AUDIO_RECORD',token});
      if(!playing?.ok)throw new Error(playing?.error||'The song could not start.');
      return await update({stage:'capturing',message:'Learning word timing while the song plays. Let it finish, then replay.',progress:0});
    }catch(error){
      if(launched){if(await hasOffscreen().catch(()=>false))await offscreen('CL_OS_CANCEL').catch(()=>{});await update({stage:'error',message:error.message});}throw error;
    }finally{starting=false;}
  }
  async function saveTiming(value){
    if(!value.videoId||!value.timing?.signature||!Array.isArray(value.timing.lines))throw new Error('Audio timing data was invalid.');
    const stored=await chrome.storage.local.get('audioTimings');const timings=stored.audioTimings||{};
    timings[value.videoId]=value.timing;const keys=Object.keys(timings).sort((a,b)=>(timings[a].createdAt||0)-(timings[b].createdAt||0));
    while(keys.length>18||new TextEncoder().encode(JSON.stringify(timings)).length>1000000){delete timings[keys.shift()];}
    await chrome.storage.local.set({audioTimings:timings});
  }
  chrome.runtime.onMessage.addListener((message,sender,reply)=>{
    if(!message||message.target==='cl-offscreen')return false;
    if(message.type==='CL_AUDIO_EVENT'){
      if(!trusted(sender,'offscreen.html'))return false;
      (async()=>{
        const current=await state();if(message.token&&current.token!==message.token)return;
        if(message.stage==='done'){
          await saveTiming(message);
          if(current.tabId)await chrome.tabs.sendMessage(current.tabId,{type:'CL_AUDIO_TIMING',videoId:message.videoId,timing:message.timing}).catch(()=>{});
        }
        await update({stage:message.stage,message:message.message,progress:message.progress??current.progress},message.stage!=='model');
      })().then(()=>reply({ok:true}),error=>{update({stage:'error',message:error.message});reply({ok:false,error:error.message});});return true;
    }
    if(message.type==='CL_AUDIO_CLOCK'){
      if(sender.id!==chrome.runtime.id||!sender.tab?.id)return false;
      (async()=>{const current=await state();if(current.tabId!==sender.tab.id||current.token!==message.token||current.stage!=='capturing')return;
        await offscreen('CL_OS_CLOCK',{clock:message.clock});
        if(message.clock?.ended)await update({stage:'analyzing',message:'Song captured. Generating word timing locally…',progress:0});
      })().then(()=>reply({ok:true}),error=>reply({ok:false,error:error.message}));return true;
    }
    if(!['CL_AUDIO_BEGIN','CL_AUDIO_FINISH','CL_AUDIO_CANCEL','CL_AUDIO_STATUS'].includes(message.type))return false;
    if(!trusted(sender,'popup.html')){reply({ok:false,error:'Open the extension popup to control local audio timing.'});return false;}
    (async()=>{
      if(message.type==='CL_AUDIO_STATUS'){const current=await state();if(busy.includes(current.stage)&&!await hasOffscreen())return update({stage:'idle',message:'Ready for local audio timing.'});return current;}
      if(message.type==='CL_AUDIO_BEGIN')return start(Number(message.tabId));
      if(await hasOffscreen())await offscreen(message.type==='CL_AUDIO_FINISH'?'CL_OS_FINISH':'CL_OS_CANCEL');
      return update({stage:message.type==='CL_AUDIO_FINISH'?'analyzing':'cancelled',message:message.type==='CL_AUDIO_FINISH'?'Generating timings for captured audio…':'Audio timing cancelled.'});
    })().then(result=>reply({ok:true,result}),error=>reply({ok:false,error:error.message}));return true;
  });
  chrome.tabs?.onRemoved?.addListener(async tabId=>{const current=await state();if(current.tabId===tabId&&busy.includes(current.stage)){if(await hasOffscreen())await offscreen('CL_OS_CANCEL').catch(()=>{});await update({stage:'cancelled',message:'The song tab was closed. Audio timing stopped.'});}});
  chrome.tabs?.onUpdated?.addListener(async(tabId,change)=>{if(change.status!=='loading')return;const current=await state();if(current.tabId===tabId&&current.stage==='capturing'){if(await hasOffscreen())await offscreen('CL_OS_CANCEL').catch(()=>{});await update({stage:'cancelled',message:'The song tab navigated or refreshed. Audio capture stopped.'});}});
})();
