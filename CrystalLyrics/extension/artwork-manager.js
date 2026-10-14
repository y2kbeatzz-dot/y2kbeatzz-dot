(() => {
  'use strict';
  const Palette=globalThis.CrystalPalette;const Core=globalThis.CrystalLyricsCore;
  const TTL=14*24*60*60*1000;let queue=Promise.resolve();let lastSearch=0;
  const text=value=>typeof value==='string'?value.trim().slice(0,220):'';
  function imageURL(value){try{const url=new URL(value);return url.protocol==='https:'&&url.hostname.endsWith('.mzstatic.com')&&!url.username&&!url.password&&!url.port?url.href:null;}catch(_){return null;}}
  function select(meta,records){
    return records.filter(raw=>raw.kind==='song'&&imageURL(raw.artworkUrl100)).map(raw=>{
      const record={trackName:text(raw.trackName),artistName:text(raw.artistName),albumName:text(raw.collectionName),duration:Number(raw.trackTimeMillis)/1000,hasWordSync:true};
      const scored=Core.scoreRecord({...meta,rawTitle:[meta.title,meta.album].filter(Boolean).join(' ')},record);
      const albumScore=meta.album?Core.similarity(meta.album,record.albumName):0;
      return {raw,record,...scored,score:scored.score+albumScore*25};
    }).filter(item=>item.confident).sort((a,b)=>b.score-a.score)[0]||null;
  }
  async function request(url,maxBytes,json=false){
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
    try{
      const response=await fetch(url,{credentials:'omit',cache:'no-store',signal:controller.signal,headers:{Accept:json?'application/json':'image/*'}});
      if(response.status===429)throw new Error('Cover service is busy. Try switching cover colors off and on later.');
      if(!response.ok)throw new Error('Cover lookup unavailable (HTTP '+response.status+').');
      if(Number(response.headers.get('Content-Length'))>maxBytes)throw new Error('Cover response was too large.');
      const buffer=await response.arrayBuffer();if(buffer.byteLength>maxBytes)throw new Error('Cover response was too large.');
      return json?JSON.parse(new TextDecoder().decode(buffer)):new Blob([buffer],{type:response.headers.get('Content-Type')||'image/jpeg'});
    }catch(error){if(error.name==='AbortError')throw new Error('Cover lookup timed out.');throw error;}
    finally{clearTimeout(timeout);}
  }
  async function lookup(raw){
    const settings=(await chrome.storage.local.get('settings')).settings;
    if(!settings?.useCoverColors||settings.useVideoColors)return {palette:null,disabled:true};
    const meta={title:text(raw?.title),artist:text(raw?.artist),album:text(raw?.album),duration:Number(raw?.duration)||0};
    if(!meta.title||!meta.artist)return {palette:null};
    const key=JSON.stringify([Core.normalize(meta.title),Core.normalize(meta.artist),Core.normalize(meta.album),Math.round(meta.duration)]);
    const cache=(await chrome.storage.local.get('artworkPaletteCache')).artworkPaletteCache||{};
    if(cache[key]&&Date.now()-cache[key].at<(cache[key].result?.palette?TTL:60*60*1000))return cache[key].result;
    const wait=Math.max(0,3200-(Date.now()-lastSearch));if(wait)await new Promise(resolve=>setTimeout(resolve,wait));
    // A queued lookup may outlive a toggle change; check again before networking.
    const current=(await chrome.storage.local.get('settings')).settings;
    if(!current?.useCoverColors||current.useVideoColors)return {palette:null,disabled:true};
    const url=new URL('https://itunes.apple.com/search');
    for(const [key,value]of Object.entries({term:meta.artist+' '+meta.title,media:'music',entity:'song',country:'US',limit:'20',explicit:'Yes'}))url.searchParams.set(key,value);
    lastSearch=Date.now();const data=await request(url.href,1500000,true);
    const matched=select(meta,Array.isArray(data.results)?data.results.slice(0,20):[]);
    let result={palette:null};
    if(matched){
      const bitmap=await createImageBitmap(await request(imageURL(matched.raw.artworkUrl100),2000000));
      try{
        const canvas=new OffscreenCanvas(48,48),context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(bitmap,0,0,48,48);
        const palette=Palette.fromPixels(context.getImageData(0,0,48,48).data);
        result={palette:palette||{activeColor:'#eeeeee',pastColor:'#cccccc',futureColor:'#ababab',glowColor:'#eeeeee'},title:matched.record.trackName,artist:matched.record.artistName,album:matched.record.albumName,provider:'iTunes'};
      }finally{bitmap.close();}
    }
    cache[key]={at:Date.now(),result};const keys=Object.keys(cache).sort((a,b)=>cache[a].at-cache[b].at);
    while(keys.length>60||new TextEncoder().encode(JSON.stringify(cache)).length>100000){delete cache[keys.shift()];}
    await chrome.storage.local.set({artworkPaletteCache:cache});return result;
  }
  chrome.runtime.onMessage.addListener((message,sender,reply)=>{
    if(message?.type!=='CL_COVER_COLORS')return false;
    let allowed=false;try{const url=new URL(sender.url);allowed=sender.id===chrome.runtime.id&&url.protocol==='https:'&&['www.youtube.com','music.youtube.com'].includes(url.hostname);}catch(_){}
    if(!allowed){reply({ok:false,error:'Cover requests are only accepted from YouTube.'});return false;}
    const job=queue.then(()=>lookup(message.meta),()=>lookup(message.meta));queue=job.catch(()=>{});
    job.then(result=>reply({ok:true,result}),error=>reply({ok:false,error:error.message||'Cover lookup failed.'}));return true;
  });
})();
