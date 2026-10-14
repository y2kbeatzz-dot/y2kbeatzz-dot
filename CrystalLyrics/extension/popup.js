'use strict';
const Appearance=globalThis.CrystalAppearance;
const Effects=globalThis.CrystalEffects;
let settings=Appearance.sanitize();let saving=Promise.resolve();let previewToken=0;let matchedPalette=null;let colorRequest=0;
const status=document.querySelector('#status');
const booleans=['enabled','overlay','reduceMotion','preferWordSync','editLayout','showNext','autoWordEffect','useCoverColors','useVideoColors',...Effects.OPTIONS.map(option=>option.key)];
const ranges=['fontSize','overlayFontSize','panelOpacity','overlayOpacity','glowStrength'];
const colors=['activeColor','pastColor','futureColor','glowColor'];
const fontSelect=document.querySelector('#font');
for(const font of Appearance.FONTS){const option=document.createElement('option');option.value=font.id;option.textContent=font.label;fontSelect.append(option);}
for(const option of Effects.OPTIONS){
  const label=document.createElement('label');label.className='setting';const caption=document.createElement('span'),title=document.createElement('strong'),help=document.createElement('small');
  title.textContent=option.label;help.textContent=option.help;caption.append(title,help);
  const input=document.createElement('input');input.type='checkbox';input.id=option.key;input.setAttribute('role','switch');label.append(caption,input);document.querySelector('#effectOptions').append(label);
}
const effectCSS=document.createElement('style');effectCSS.textContent=Effects.css('preview','#effectPreview');document.head.append(effectCSS);
function render(){
  for(const key of booleans)document.getElementById(key).checked=settings[key];
  for(const key of ranges){document.getElementById(key).value=settings[key];document.getElementById(key+'Value').textContent=settings[key]+(key.includes('Opacity')?'%':'');}
  const matching=settings.useCoverColors||settings.useVideoColors;
  for(const key of colors){document.getElementById(key).value=settings[key];document.getElementById(key).disabled=matching;document.getElementById(key).title=matching?'Your manual color is saved. Turn off color matching to edit it.':'';}
  fontSelect.value=settings.font;document.querySelector('#fontName').textContent=settings.customFont?.name||'TTF, OTF, WOFF / WOFF2';
  document.querySelector('#fontPreview').style.color=matching&&matchedPalette?matchedPalette.activeColor:settings.activeColor;
  document.querySelector('#fontPreview').style.textShadow=settings.effectGlow&&settings.glowStrength?'0 0 '+(settings.glowStrength*.14)+'px '+(matching&&matchedPalette?matchedPalette.glowColor:settings.glowColor):'none';
  const preview=document.querySelector('#effectPreview');Effects.applyFlags([preview],settings);
  for(const[key,variable]of [['activeColor','--active-color'],['pastColor','--past-color'],['futureColor','--future-color'],['glowColor','--glow-color']])preview.style.setProperty(variable,matching&&matchedPalette?matchedPalette[key]:settings[key]);
  preview.style.setProperty('--glow-small',(settings.effectGlow?settings.glowStrength*.105:0)+'px');preview.style.setProperty('--glow-large',(settings.effectGlow?settings.glowStrength*.22:0)+'px');
  const previewWord=preview.querySelector('.word.current');previewWord.style.setProperty('--word-fill','50%');Effects.applyWord([previewWord],settings,50);
  preview.querySelector('.preview-line').style.setProperty('--effect-line-opacity',Effects.lineOpacity(settings,{time:0,end:5},.2).toFixed(3));
  const token=++previewToken;
  Appearance.loadFont(settings).then(family=>{if(token===previewToken){document.querySelector('#fontPreview').style.fontFamily=family;preview.style.fontFamily=family;}})
    .catch(()=>{if(token===previewToken)status.textContent='Font could not load. Try another font file.';});
}
function update(patch,message='Your preferences are saved.'){
  const job=saving.then(async()=>{
    const current=await chrome.storage.local.get('settings');settings=Appearance.sanitize({...current.settings,...patch});
    await chrome.storage.local.set({settings});render();if(message)status.textContent=message;
  });
  saving=job.catch(()=>{status.textContent='Could not save preferences. Try a smaller font file or reopen the extension.';});
  return job;
}
chrome.storage.local.get('settings').then(stored=>{settings=Appearance.sanitize(stored.settings||{});render();loadColorState();});
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.settings){settings=Appearance.sanitize(changes.settings.newValue||{});matchedPalette=null;render();loadColorState();}});
for(const key of booleans)document.getElementById(key).addEventListener('change',event=>{
  const patch={[key]:event.target.checked};if(key==='editLayout'&&patch.editLayout)patch.overlay=true;if(key==='overlay'&&!patch.overlay)patch.editLayout=false;
  if(key==='useCoverColors'&&patch.useCoverColors)patch.useVideoColors=false;
  if(key==='useVideoColors'&&patch.useVideoColors)patch.useCoverColors=false;
  update(patch,key==='enabled'&&!patch.enabled?'Lyrics are turned off.':undefined).catch(()=>{});
});
for(const key of ranges){const input=document.getElementById(key);input.addEventListener('input',()=>{document.getElementById(key+'Value').textContent=input.value+(key.includes('Opacity')?'%':'');});
  input.addEventListener('change',()=>update({[key]:Number(input.value)}).catch(()=>{}));}
for(const key of colors)document.getElementById(key).addEventListener('change',event=>update({[key]:event.target.value},'Lyric colors saved.').catch(()=>{}));
fontSelect.addEventListener('change',()=>update({font:fontSelect.value},fontSelect.value==='custom'&&!settings.customFont?'Choose Load your font to select a font file.':'Font choice saved.').catch(()=>{}));
document.querySelector('#loadFont').addEventListener('click',()=>document.querySelector('#fontFile').click());
document.querySelector('#fontFile').addEventListener('change',async event=>{
  const file=event.target.files?.[0];event.target.value='';if(!file)return;
  try{status.textContent='Loading font…';const customFont=await Appearance.importFont(file);await update({customFont,font:'custom'},'Your font is ready: '+file.name);}
  catch(error){status.textContent=error.message||'This font could not be loaded.';}
});
document.querySelector('#resetLayout').addEventListener('click',()=>update({panelRect:null,overlayRect:null},'Both boxes are back in their default positions.').catch(()=>{}));
document.querySelector('#resetEffects').addEventListener('click',()=>update(Effects.DEFAULTS,'Effects reset. Your colors and layout are saved.').catch(()=>{}));
async function sendToVideo(type){
  try{
    await update({enabled:true},'');const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    if(!tab?.id)throw new Error('No active video tab.');
    await chrome.tabs.sendMessage(tab.id,{type});
    status.textContent=type==='CL_SHOW'?'Lyrics are open on your video.':'Looking for matching word timestamps…';
  }catch(_){status.textContent='Open a YouTube music video and refresh the tab once, then try again.';}
}
document.getElementById('show').addEventListener('click',()=>sendToVideo('CL_SHOW'));
document.getElementById('refresh').addEventListener('click',()=>sendToVideo('CL_REFRESH'));
async function loadColorState(){
  const request=++colorRequest;
  if(!settings.useCoverColors&&!settings.useVideoColors){matchedPalette=null;document.querySelector('#colorState').textContent='Manual colors are saved. Choose one matching mode.';return;}
  try{
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});const result=await chrome.tabs.sendMessage(tab?.id,{type:'CL_COLOR_STATUS'});
    if(request!==colorRequest)return;
    if(!result?.ok||!result.result)throw new Error('Open the YouTube song tab and refresh it after updating.');
    matchedPalette=globalThis.CrystalPalette.sanitize(result.result.palette);document.querySelector('#colorState').textContent=result.result.status;render();
  }catch(_){if(request===colorRequest)document.querySelector('#colorState').textContent='Open the YouTube song tab and refresh it after updating.';}
}
setInterval(()=>{if(settings.useCoverColors||settings.useVideoColors)loadColorState();},2000);

function showAudio(value){
  const busy=['capturing','preparing','model','analyzing'].includes(value?.stage);
  document.querySelector('#audioState').textContent=value?.message||'Ready for local audio timing.';
  document.querySelector('#learnAudio').disabled=busy;document.querySelector('#finishAudio').disabled=value?.stage!=='capturing';document.querySelector('#cancelAudio').disabled=!busy;
}
async function audioAction(type){
  try{const [tab]=await chrome.tabs.query({active:true,currentWindow:true});const result=await chrome.runtime.sendMessage({type,tabId:tab?.id});if(!result?.ok)throw new Error(result?.error||'Audio tool did not respond. Refresh the extension.');showAudio(result.result);}
  catch(error){document.querySelector('#audioState').textContent=error.message;}
}
document.querySelector('#learnAudio').addEventListener('click',()=>audioAction('CL_AUDIO_BEGIN'));
document.querySelector('#finishAudio').addEventListener('click',()=>audioAction('CL_AUDIO_FINISH'));
document.querySelector('#cancelAudio').addEventListener('click',()=>audioAction('CL_AUDIO_CANCEL'));
chrome.runtime.sendMessage({type:'CL_AUDIO_STATUS'}).then(result=>{if(result?.ok)showAudio(result.result);}).catch(()=>{});
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.audioState)showAudio(changes.audioState.newValue);});
