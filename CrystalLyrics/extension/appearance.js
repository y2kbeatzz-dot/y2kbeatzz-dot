(function (root) {
  'use strict';
  const Effects=root.CrystalEffects||(typeof require==='function'?require('./effects.js'):null);
  const FONTS = [
    {id:'outfit',label:'Outfit',family:'CrystalOutfit, "Segoe UI", sans-serif',file:'fonts/Outfit.ttf',face:'CrystalOutfit',weight:'100 900'},
    {id:'space',label:'Space Grotesk',family:'CrystalSpace, "Segoe UI", sans-serif',file:'fonts/SpaceGrotesk.ttf',face:'CrystalSpace',weight:'300 700'},
    {id:'system',label:'Segoe UI / system',family:'"Segoe UI", Arial, sans-serif'},
    {id:'arial',label:'Arial',family:'Arial, sans-serif'},
    {id:'verdana',label:'Verdana',family:'Verdana, sans-serif'},
    {id:'serif',label:'Georgia / serif',family:'Georgia, "Times New Roman", serif'},
    {id:'mono',label:'Consolas / monospace',family:'Consolas, "Courier New", monospace'},
    {id:'custom',label:'Your font file',family:'CrystalCustom, "Segoe UI", sans-serif'}
  ];
  const DEFAULTS = {enabled:true,overlay:false,fontSize:24,overlayFontSize:28,reduceMotion:true,font:'outfit',
    panelOpacity:55,overlayOpacity:0,editLayout:false,showNext:true,preferWordSync:true,panelRect:null,overlayRect:null,customFont:null,
    autoWordEffect:true,glowStrength:65,activeColor:'#fff1f8',pastColor:'#f6c4df',futureColor:'#ac96b9',glowColor:'#ff8fd5',useCoverColors:false,useVideoColors:false,...Effects.DEFAULTS};
  const clamp = (value,low,high) => Math.max(low,Math.min(high,value));
  function number(value,fallback,low,high) { const parsed=Number(value); return clamp(Number.isFinite(parsed)?parsed:fallback,low,high); }
  function sanitize(raw = {}) {
    const result={...DEFAULTS,...raw};
    for(const key of ['enabled','overlay','reduceMotion','editLayout','showNext','preferWordSync','autoWordEffect','useCoverColors','useVideoColors']) result[key]=typeof raw[key]==='boolean'?raw[key]:DEFAULTS[key];
    if(result.useVideoColors)result.useCoverColors=false;
    for(const option of Effects.OPTIONS)result[option.key]=typeof raw[option.key]==='boolean'?raw[option.key]:option.defaultValue;
    result.fontSize=number(result.fontSize,24,16,48);result.overlayFontSize=number(result.overlayFontSize,28,14,64);
    result.panelOpacity=number(result.panelOpacity,55,0,100);result.overlayOpacity=number(result.overlayOpacity,0,0,100);
    result.glowStrength=number(result.glowStrength,65,0,100);
    for(const field of ['activeColor','pastColor','futureColor','glowColor'])if(!/^#[0-9a-f]{6}$/i.test(result[field]))result[field]=DEFAULTS[field];
    if(!FONTS.some(item=>item.id===result.font))result.font='outfit';
    for(const key of ['panelRect','overlayRect']){
      const rect=result[key];
      result[key]=rect&&typeof rect==='object'?{x:number(rect.x,1,0,1),y:number(rect.y,1,0,1),width:number(rect.width,370,120,3000),height:number(rect.height,640,40,3000)}:null;
    }
    if(!result.customFont||typeof result.customFont.data!=='string'||result.customFont.data.length>2100000)result.customFont=null;
    return result;
  }
  function fitRect(saved,viewport,defaults,minWidth=280,minHeight=350) {
    const margin=8;
    const maxWidth=Math.max(1,viewport.width-margin*2),maxHeight=Math.max(1,viewport.height-margin*2);
    const width=clamp(Number(saved?.width)||defaults.width,Math.min(minWidth,maxWidth),maxWidth);
    const height=clamp(Number(saved?.height)||defaults.height,Math.min(minHeight,maxHeight),maxHeight);
    const x=clamp(Number(saved?.x??defaults.x),0,1),y=clamp(Number(saved?.y??defaults.y),0,1);
    return {left:margin+x*Math.max(0,maxWidth-width),top:margin+y*Math.max(0,maxHeight-height),width,height};
  }
  function saveRect(rect,viewport) {
    return {x:clamp((rect.left-8)/Math.max(1,viewport.width-16-rect.width),0,1),y:clamp((rect.top-8)/Math.max(1,viewport.height-16-rect.height),0,1),width:rect.width,height:rect.height};
  }
  function wordProgress(time,word) {
    if(!Number.isFinite(word.end)||word.end<=word.time)return time>=word.time?100:0;
    return clamp((time-word.time)/(word.end-word.time)*100,0,100);
  }
  const loaded=new Map();let customFace=null;let customData='';
  async function loadFont(settings) {
    const font=FONTS.find(item=>item.id===settings.font)||FONTS[0];
    if(!root.document||typeof root.FontFace!=='function')return font.family;
    if(font.id==='custom'){
      if(!settings.customFont?.data)return '"Segoe UI", Arial, sans-serif';
      if(customData!==settings.customFont.data){
        const decoded=root.atob(settings.customFont.data);const bytes=Uint8Array.from(decoded,char=>char.charCodeAt(0));
        const face=new root.FontFace('CrystalCustom',bytes);
        await face.load();if(customFace)root.document.fonts.delete(customFace);
        root.document.fonts.add(face);customFace=face;customData=settings.customFont.data;
      }
      return font.family;
    }
    if(font.file&&!loaded.has(font.id)){
      const promise=(async()=>{
        const response=await root.fetch(root.chrome.runtime.getURL(font.file));
        if(!response.ok)throw new Error('Could not load '+font.label+'. Refresh the tab after updating the extension.');
        const face=new root.FontFace(font.face,await response.arrayBuffer(),{weight:font.weight});
        await face.load();root.document.fonts.add(face);
      })();
      loaded.set(font.id,promise);
      try{await promise;}catch(error){loaded.delete(font.id);throw error;}
    }else if(font.file)await loaded.get(font.id);
    return font.family;
  }
  async function importFont(file) {
    if(file.size>1500000)throw new Error('Choose a font smaller than 1.5 MB.');
    if(!/\.(ttf|otf|woff2?)$/i.test(file.name))throw new Error('Choose a TTF, OTF, WOFF or WOFF2 font.');
    const buffer=await file.arrayBuffer();const face=new root.FontFace('CrystalFontCheck',buffer);await face.load();
    const bytes=new Uint8Array(buffer);let binary='';
    for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
    return {name:file.name.slice(0,120),data:root.btoa(binary)};
  }
  const api={FONTS,DEFAULTS,sanitize,fitRect,saveRect,clamp,wordProgress,loadFont,importFont};
  root.CrystalAppearance=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
