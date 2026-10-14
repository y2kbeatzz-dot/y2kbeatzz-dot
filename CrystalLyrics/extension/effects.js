(function(root){
  'use strict';
  const OPTIONS=[
    {key:'effectKaraoke',attribute:'data-effect-karaoke',label:'Karaoke fill',help:'Fill each word as it is sung.',defaultValue:true},
    {key:'effectGlow',attribute:'data-effect-glow',label:'Word glow',help:'Steady glow around the current word.',defaultValue:true},
    {key:'effectLift',attribute:'data-effect-lift',label:'Word lift',help:'Raise the current word slightly.',defaultValue:false},
    {key:'effectEmphasis',attribute:'data-effect-emphasis',label:'Word emphasis',help:'Make the current word a little larger.',defaultValue:false},
    {key:'effectUnderline',attribute:'data-effect-underline',label:'Word underline',help:'An underline fills with the word.',defaultValue:false},
    {key:'effectLineFade',attribute:'data-effect-line-fade',label:'Line fade',help:'Fade line entrances and soften surrounding lines.',defaultValue:false},
    {key:'effectFocus',attribute:'data-effect-focus',label:'Soft focus',help:'Slightly blur surrounding lines.',defaultValue:false}
  ];
  const DEFAULTS=Object.fromEntries(OPTIONS.map(option=>[option.key,option.defaultValue]));
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  function wordMotion(settings,percent){
    const progress=clamp(Number(percent)||0,0,100)/100;
    const phase=settings.reduceMotion?1:Math.sin(progress*Math.PI);
    return {lift:settings.effectLift?-3*phase:0,scale:settings.effectEmphasis?1+.055*phase:1};
  }
  function lineOpacity(settings,line,time){
    if(!settings.effectLineFade||settings.reduceMotion||!line)return 1;
    const entrance=clamp((time-line.time)/.45,0,1);
    const exit=Number.isFinite(line.end)?clamp((line.end-time)/.3,0,1):1;
    return .72+.28*Math.min(entrance,exit);
  }
  function applyFlags(nodes,settings){
    for(const node of nodes){
      for(const option of OPTIONS)node.setAttribute(option.attribute,String(settings[option.key]));
      node.setAttribute('data-effect-word-layout',String(settings.effectLift||settings.effectEmphasis||settings.effectUnderline));
    }
  }
  function applyWord(nodes,settings,percent){
    const values=wordMotion(settings,percent);
    for(const node of nodes)if(node){node.style.setProperty('--effect-lift',values.lift.toFixed(3)+'px');node.style.setProperty('--effect-scale',values.scale.toFixed(4));}
  }
  function css(surface,scope=':host'){
    const panel=surface==='panel',preview=surface==='preview';
    const word=panel?'.line .word':preview?'.preview-line .word':'.current .word';
    const current=panel?'.line.active .word.current':preview?'.preview-line .word.current':'.current .word.current';
    const line=panel?'.line.active':preview?'.preview-line':'.current';
    const inactive=panel?'.line:not(.active)':preview?'.preview-next':'.next';
    const styles=`
      ${scope}[data-effect-word-layout="true"] ${word}{display:inline-block;max-width:100%;position:relative;vertical-align:baseline;white-space:pre-wrap;overflow-wrap:anywhere;transform:none}
      ${scope}[data-effect-word-layout="true"] ${current}{transform:translateY(var(--effect-lift,0px)) scale(var(--effect-scale,1));transform-origin:50% 80%}
      ${scope}[data-effect-karaoke="false"] ${current}{background:none;color:var(--active-color,#fff1f8);text-shadow:0 1px 2px #0008}
      ${scope}[data-effect-glow="false"] ${current}{filter:none}
      ${scope}[data-effect-underline="true"] ${current}::after{content:"";position:absolute;pointer-events:none;left:0;bottom:-.08em;width:var(--word-fill,0%);max-width:100%;height:2px;border-radius:2px;background:var(--active-color,#fff1f8);box-shadow:0 0 var(--glow-small,0px) var(--glow-color,#ff8fd5)}
      ${scope}[data-effect-line-fade="true"] ${line}{opacity:var(--effect-line-opacity,1)}
      ${scope}[data-effect-line-fade="true"] ${inactive}{opacity:.72}
      ${scope}[data-effect-focus="true"] ${inactive}{filter:blur(.6px)}
    `;
    return scope===':host'?styles.replace(/:host\[([^\]]+)\]/g,':host([$1])'):styles;
  }
  const api={OPTIONS,DEFAULTS,wordMotion,lineOpacity,applyFlags,applyWord,css};root.CrystalEffects=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
