import {pipeline,env} from './vendor/transformers.bundle.js';
env.allowLocalModels=false;
env.useBrowserCache=true;
env.backends.onnx.wasm.wasmPaths=new URL('./vendor/onnx/',import.meta.url).href;
env.backends.onnx.wasm.numThreads=1;
env.backends.onnx.wasm.proxy=false;
let transcriber=null;
self.onmessage=async event=>{
  if(event.data?.type!=='ANALYZE')return;
  try{
    if(!transcriber)transcriber=await pipeline('automatic-speech-recognition','onnx-community/whisper-base_timestamped',{
      revision:'608c49e61301901684bc36cac8f74b95ff6b5a8e',device:'wasm',dtype:'q8',
      progress_callback:progress=>self.postMessage({type:'PROGRESS',stage:'model',message:progress.status==='progress'?'Downloading audio model…':'Preparing local audio model…',progress:Number(progress.progress)||0})
    });
    self.postMessage({type:'PROGRESS',stage:'analyzing',message:'Finding word positions in the captured audio…',progress:0});
    const audio=new Float32Array(event.data.audio);
    const result=await transcriber(audio,{return_timestamps:'word',chunk_length_s:30,stride_length_s:5,task:'transcribe',
      chunk_callback:()=>self.postMessage({type:'PROGRESS',stage:'analyzing',message:'Analyzing the vocals locally…'})});
    self.postMessage({type:'DONE',chunks:result.chunks||[]});
  }catch(error){self.postMessage({type:'ERROR',message:error.message||'Audio analysis failed. The instant word effect remains available.'});}
};
