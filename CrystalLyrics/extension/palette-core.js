(function(root){
  'use strict';
  const FIELDS=['activeColor','pastColor','futureColor','glowColor'];
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  function sanitize(value){
    if(!value||FIELDS.some(key=>!/^#[0-9a-f]{6}$/i.test(value[key])))return null;
    return Object.fromEntries(FIELDS.map(key=>[key,value[key].toLowerCase()]));
  }
  function hex(rgb){return '#'+rgb.map(value=>Math.round(clamp(value,0,255)).toString(16).padStart(2,'0')).join('');}
  function rgb(color){return [1,3,5].map(at=>parseInt(color.slice(at,at+2),16));}
  function hsl(r,g,b){
    r/=255;g/=255;b/=255;const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,l=(max+min)/2;
    if(!d)return [0,0,l];
    const s=d/(1-Math.abs(2*l-1));let h=max===r?(g-b)/d%6:max===g?(b-r)/d+2:(r-g)/d+4;
    return [(h*60+360)%360,s,l];
  }
  function fromHsl(h,s,l){
    const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs(h/60%2-1)),m=l-c/2;
    const v=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];
    return hex(v.map(value=>(value+m)*255));
  }
  function fromPixels(pixels){
    const bins=new Map();let visible=0;
    for(let at=0;at+3<pixels.length;at+=4){
      if(pixels[at+3]<160)continue;
      const r=pixels[at],g=pixels[at+1],b=pixels[at+2];const [h,s,l]=hsl(r,g,b);visible++;
      // Ignore black bars, white text and tiny highlights when choosing an accent.
      if(l<.06||l>.94)continue;
      const key=(r>>4)*256+(g>>4)*16+(b>>4);const bin=bins.get(key)||{r:0,g:0,b:0,count:0,saturation:s};
      bin.r+=r;bin.g+=g;bin.b+=b;bin.count++;bins.set(key,bin);
    }
    if(!visible||!bins.size)return null;
    let chosen=null,best=-1;
    for(const bin of bins.values()){
      const score=bin.count*(.25+bin.saturation*1.7);
      if(score>best){best=score;chosen=bin;}
    }
    const [h,s]=hsl(chosen.r/chosen.count,chosen.g/chosen.count,chosen.b/chosen.count);
    const sat=s<.12?0:clamp(s,.38,.85);
    return {activeColor:fromHsl(h,sat*.65,.91),pastColor:fromHsl(h,sat*.55,.77),futureColor:fromHsl(h,sat*.27,.66),glowColor:fromHsl(h,sat,.64)};
  }
  function blend(previous,next,amount=.2){
    previous=sanitize(previous);next=sanitize(next);if(!next)return previous;if(!previous)return next;
    amount=clamp(amount,0,1);
    return Object.fromEntries(FIELDS.map(key=>[key,hex(rgb(previous[key]).map((value,index)=>value+(rgb(next[key])[index]-value)*amount))]));
  }
  const api={FIELDS,sanitize,fromPixels,blend,hsl,fromHsl};root.CrystalPalette=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
