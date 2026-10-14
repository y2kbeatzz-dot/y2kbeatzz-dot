(() => {
  'use strict';
  if (globalThis.__crystalLyricsLoaded) return;
  globalThis.__crystalLyricsLoaded = true;
  const Core = globalThis.CrystalLyricsCore;
  const Appearance = globalThis.CrystalAppearance;
  const WordTiming=globalThis.CrystalWordTiming;
  const Effects=globalThis.CrystalEffects;
  const Matching=globalThis.CrystalColorMatching;
  let automaticPalette=null;
  let settings = Appearance.sanitize();
  let video = null; let videoListeners = []; let frame = 0; let lastFrame = 0;
  let videoId = ''; let epoch = 0; let requestNo = 0; let discoveryTimer = 0;
  let meta = null; let record = null; let parsed = {lines: [], timed: false, wordTimed: false};
  let lineElements = []; let active = -2; let delay = 0; let speed = 1;
  let imported = null; let source = ''; let collapsed = false; let browseUntil = 0; let loaded = false;
  let overlayParent = null; let lastState = ''; let lastOverlay = ''; let lastWord = '';
  let offsetTimer = 0; let overlayWordEls = []; let pendingMeta = null; let manualChoice = false;
  let fontToken = 0; let lastFont = ''; let lastFontData = ''; let interaction = null;
  let baseParsed={lines:[],timed:false,wordTimed:false};let audioTiming=null;let audioClockTimer=0;let audioRecording=false;let originalPlaybackRate=1;let audioToken='';

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function button(label, className = '', title = '') {
    const node = el('button', className, label); node.type = 'button'; if (title) node.title = title; return node;
  }

  const host = el('div'); host.id = 'crystal-lyrics-panel';
  host.style.cssText = 'position:fixed;z-index:2147483600;color-scheme:dark;pointer-events:none;';
  const shadow = host.attachShadow({mode: 'open'});
  const style = el('style');
  style.textContent = `
    :host{all:initial;font-family:Inter,"Segoe UI",Arial,sans-serif;color:#f2edf6;font-size:14px;line-height:1.5;color-scheme:dark}:host([hidden]){display:none!important}
    *{box-sizing:border-box} [hidden]{display:none!important}
    button,input{font:inherit}button{cursor:pointer;color:inherit}button:disabled{opacity:.5;cursor:wait}
    button:focus-visible,input:focus-visible,summary:focus-visible,a:focus-visible{outline:2px solid #f5a2c7;outline-offset:3px}
    button{border:1px solid #3c3147;background:#251e2e;border-radius:9px;padding:8px 11px;line-height:1.2}
    button:hover{background:#34273f;border-color:#8a5377}a{color:#eab3d3;text-decoration:none}a:hover{text-decoration:underline}
    .panel{background:#16121ef7;border:1px solid #514052;border-radius:18px;box-shadow:0 12px 45px #0008;max-height:calc(100vh - 40px);overflow:auto;scrollbar-width:thin}
    .top{padding:16px 18px 13px;border-bottom:1px solid #332a3e;display:flex;align-items:center;gap:10px}
    .logo{width:33px;height:33px;display:grid;place-items:center;background:linear-gradient(135deg,#fcb2cc,#b096fa);color:#22162b;font-size:24px;font-weight:800;border-radius:11px}
    .brand{font-size:15px;font-weight:750;letter-spacing:-.2px}.eyebrow{font-size:9px;letter-spacing:1.6px;color:#b9a6c7;font-weight:650}
    .spacer{flex:1}.icon{padding:5px 9px;background:transparent;font-size:20px;border-color:transparent}
    .track{padding:16px 18px 10px}.title{font-size:17px;font-weight:750;line-height:1.3;max-height:67px;overflow:hidden}.artist{font-size:12px;color:#bcaac9;margin-top:4px}
    .badges{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin-top:10px}.badge{border-radius:5px;padding:3px 7px;background:#332039;color:#f7bada;font-size:9px;font-weight:750;letter-spacing:.6px}.badge.untimed{background:#382d1b;color:#efcb8b}
    .state{color:#baabc7;font-size:11px;font-variant-numeric:tabular-nums}.tools{display:flex;gap:6px;padding:0 18px 12px;flex-wrap:wrap}.tools button{font-size:11px;padding:7px 9px}.tools button[aria-pressed="true"]{background:#51314b;border-color:#d095b8}
    .content{position:relative;border-top:1px solid #302639}.lyrics{height:min(310px,34vh);min-height:120px;overflow:auto;padding:65px 18px 85px;scrollbar-width:thin;scrollbar-color:#66506e transparent;overscroll-behavior:contain;scroll-behavior:auto}
    .line{display:block;text-align:left;width:100%;border:0;padding:11px 0;background:transparent!important;border-radius:0;font-size:var(--font-size,23px);font-weight:650;line-height:1.45;color:#927f9f;white-space:pre-wrap;overflow-wrap:anywhere;}
    .line:hover{color:#d0bbdf}.line.active{color:#ffe8f3}.line.past{color:#ae95ba}.line.empty{font-size:13px;letter-spacing:3px;padding:20px 0;color:#b6a5bd}
    .line .word{color:#a795b3}.line.active .word.sung{color:#f6c4df}.line.active .word.current{color:#fff;background:#573347;border-radius:4px}.line.active .word.future{color:#ac96b9}
    .empty-state{height:min(310px,34vh);min-height:150px;padding:25px 24px;display:flex;flex-direction:column;justify-content:center;gap:10px}.empty-state .note{font-size:30px;color:#dcaccd}.empty-title{font-size:17px;font-weight:700}.empty-copy{color:#bba8c8;font-size:12px;line-height:1.7}.hint{color:#b4a1c0;font-size:11px;margin:0}
    .plain{height:min(310px,34vh);overflow:auto;padding:20px;white-space:pre-wrap;font-size:19px;line-height:1.9;color:#dfcce8}
    .follow{position:absolute;bottom:9px;left:50%;transform:translateX(-50%);font-size:11px;background:#46293f;border-color:#b580a4;box-shadow:0 4px 12px #0008;white-space:nowrap}
    .search{padding:14px 18px;border-top:1px solid #302639}.search form{display:flex;gap:7px}.search input{min-width:0;flex:1;background:#211a2a;color:#f6edf8;border:1px solid #4d3b58;border-radius:9px;padding:9px 11px;font-size:12px}.search-note{font-size:11px;color:#c8b4d5;margin:10px 0}.results{max-height:225px;overflow:auto;scrollbar-width:thin}.result{display:block;text-align:left;width:100%;padding:11px;margin-top:7px;background:#241c2c;border-color:#3d2e48}.result-name{font-size:13px;font-weight:700}.result-info{color:#bfa7cc;font-size:11px;margin:3px 0}.result-kind{font-size:9px;letter-spacing:.6px;color:#e9b4d2}
    .timing{padding:12px 18px;border-top:1px solid #302639}.timing-row{display:flex;align-items:center;gap:7px}.timing-label{font-size:11px;color:#bca8c9;flex:1}.timing input{width:63px;background:#211929;color:#f4eaf6;border:1px solid #4b3853;border-radius:7px;padding:6px;font-size:12px;text-align:center}.timing button{font-size:11px;padding:7px 8px}.timing .unit{font-size:11px;color:#ac99b8}.timing details{margin-top:9px;font-size:11px;color:#bda9ca}.timing summary{cursor:pointer}.advanced{display:flex;flex-direction:column;gap:9px;margin-top:10px}.advanced-row{display:flex;gap:8px;align-items:center}.advanced-row label{flex:1}
    .foot{padding:9px 18px 11px;font-size:10px;color:#b09abe;display:flex;align-items:center;justify-content:space-between;gap:9px}.foot button{font-size:10px;padding:4px 7px;background:transparent}.launcher{float:right;display:flex;align-items:center;gap:7px;padding:12px 16px;border-radius:25px;background:#251a2cf2;border-color:#ae7ba1;box-shadow:0 5px 20px #0007;font-weight:650}
    .loading .note{opacity:.8}.error{color:#edc89c}.mini-toast{font-size:11px;color:#e6c6dc;padding:8px 18px;background:#322236}
    @media(max-height:680px){.lyrics,.empty-state,.plain{height:22vh}.top{padding:10px 16px}.track{padding:10px 16px}.timing{padding:9px 16px}}
    @media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
  `;
  style.textContent += `
    .panel{height:100%;max-height:none;display:flex;flex-direction:column;pointer-events:auto;background:rgba(22,18,30,var(--panel-alpha,.55));border-color:rgba(173,130,177,var(--edge-alpha,.45));box-shadow:0 12px 45px rgba(0,0,0,var(--shadow-alpha,.3))}
    .top,.track,.tools,.timing,.foot,.appearance,.search,.mini-toast{flex-shrink:0}.top{cursor:grab;touch-action:none;user-select:none}.top:active{cursor:grabbing}.drag-handle{flex:1;border-radius:5px;outline-offset:4px}
    .content{flex:1;min-height:90px;overflow:hidden}.lyrics,.plain,.empty-state{height:100%;min-height:0}.lyrics{padding-top:45px;padding-bottom:65px}.empty-state{padding:18px 22px}
    .line,.plain{font-family:var(--lyric-font,"Segoe UI",sans-serif);text-shadow:0 1px 3px #000b}.line.active .word.current{background:linear-gradient(90deg,#fff1f8 var(--word-fill,0%),#ac96b9 var(--word-fill,0%));background-clip:text;-webkit-background-clip:text;color:transparent;text-shadow:none;border-radius:0}.line.active .word.sung{color:#ffe5f1}.line .word{box-decoration-break:clone}
    .line.active .word-gap{color:#ffe8f3}.foot{padding-right:32px}.launcher{position:absolute;top:0;left:0;float:none;pointer-events:auto}
    .resize-grip{position:absolute;right:3px;bottom:3px;width:24px;height:24px;padding:0;border:0;background:transparent!important;color:#e1b8d3;font-size:21px;z-index:5;cursor:nwse-resize;touch-action:none;pointer-events:auto}
    .appearance{padding:12px 18px;border-top:1px solid #514052;max-height:260px;overflow:auto;background:rgba(23,15,31,var(--panel-alpha,.55))}.style-row{display:flex;align-items:center;gap:9px;margin:7px 0;font-size:11px;color:#d5c0df}.style-row label{flex:1}.style-row select{max-width:160px;min-width:0;background:#261c30;border:1px solid #604369;border-radius:6px;color:#f7e9f5;padding:6px;font-size:11px}.style-row input[type=range]{width:135px;accent-color:#edbbd6}.style-row output{width:31px;font-variant-numeric:tabular-nums;font-size:10px}.style-row input[type=checkbox]{accent-color:#e6b3d0}.style-actions{display:flex;gap:7px;margin-top:10px;flex-wrap:wrap}.style-actions button{font-size:10px;padding:6px 8px}.style-hint{margin:9px 0 0;font-size:10px;color:#c9afd3}
    .word-note{margin:0 18px 10px;color:#ddbdd0;font-size:10px;flex-shrink:0}
    @media(max-height:680px){.lyrics,.empty-state,.plain{height:100%}.top{padding:10px 14px}.track{padding:8px 14px}.timing{padding:8px 14px}}
  `;
  shadow.append(style);

  const panel = el('section', 'panel'); panel.setAttribute('aria-label', 'CrystalLyrics synced lyrics');
  const top = el('div', 'top'); const logo = el('div', 'logo', '♪'); logo.setAttribute('aria-hidden', 'true');
  const nameBlock = el('div', 'drag-handle'); nameBlock.tabIndex=0;nameBlock.setAttribute('role','button');nameBlock.setAttribute('aria-label','Move lyrics panel. Drag or use arrow keys.');nameBlock.append(el('div', 'eyebrow', 'YOUTUBE · SYNCED LYRICS'), el('div', 'brand', 'CrystalLyrics'));
  const close = button('−', 'icon', 'Minimize lyrics'); close.setAttribute('aria-label', 'Minimize lyrics');
  top.append(logo, nameBlock, el('div', 'spacer'), close);
  const track = el('div', 'track'); const title = el('div', 'title', 'Open a music video'); const artist = el('div', 'artist', 'YouTube + YouTube Music');
  const badges = el('div', 'badges'); const badge = el('span', 'badge', 'READY'); const state = el('span', 'state', ''); badges.append(badge, state); track.append(title, artist, badges);
  const tools = el('div', 'tools'); const find = button('Find song'); const load = button('Load lyrics'); const styleButton = button('Style'); const overlayButton = button('On video'); overlayButton.setAttribute('aria-pressed', 'false');
  tools.append(find, load, styleButton, overlayButton);
  const appearance = el('div','appearance');appearance.hidden=true;
  const fontSelect=el('select');fontSelect.setAttribute('aria-label','Lyrics font');
  for(const font of Appearance.FONTS){const option=el('option','',font.label);option.value=font.id;fontSelect.append(option);}
  const styleRow=(label,node)=>{const row=el('div','style-row');const caption=el('label','',label);row.append(caption,node);return row;};
  const rangeControl=(label,key,min,max)=>{
    const input=el('input');input.type='range';input.min=String(min);input.max=String(max);input.setAttribute('aria-label',label);
    const output=el('output');const row=styleRow(label,input);row.append(output);
    input.addEventListener('input',()=>{settings[key]=Number(input.value);applyAppearance();applyLayout();syncStyleControls();tick(true);});
    input.addEventListener('change',saveSettings);
    return {input,output,row,key};
  };
  const panelAlpha=rangeControl('Panel background','panelOpacity',0,100);
  const videoAlpha=rangeControl('Video background','overlayOpacity',0,100);
  const fontSizeControl=rangeControl('Panel text size','fontSize',16,48);
  const overlaySizeControl=rangeControl('Video text size','overlayFontSize',14,64);
  const glowControl=rangeControl('Word glow','glowStrength',0,100);
  const effectsSection=el('details','effects-settings');effectsSection.append(el('summary','','Lyric effects'));
  const effectControls=Effects.OPTIONS.map(option=>{
    const input=el('input');input.type='checkbox';input.setAttribute('aria-label',option.label);
    const row=styleRow(option.label,input);row.querySelector('label').append(el('small','effect-help',option.help));effectsSection.append(row);
    input.addEventListener('change',()=>{settings[option.key]=input.checked;applyAppearance();tick(true);saveSettings();});
    return {...option,input};
  });
  const reduceEffectsMotion=el('input');reduceEffectsMotion.type='checkbox';reduceEffectsMotion.setAttribute('aria-label','Reduce motion');
  const resetEffects=button('Reset effects');
  effectsSection.append(styleRow('Reduce motion',reduceEffectsMotion),el('p','style-hint','Reduce motion keeps word lift and emphasis still while active. Line fades become instant. Combine any effects; your choices are remembered.'),resetEffects);
  const autoWords=el('input');autoWords.type='checkbox';autoWords.setAttribute('aria-label','Automatic word effect for line-only lyrics');
  const coverColors=el('input');coverColors.type='checkbox';coverColors.setAttribute('aria-label','Use cover art colors');
  const videoColors=el('input');videoColors.type='checkbox';videoColors.setAttribute('aria-label','Use video colors');
  const colorStatus=el('p','style-hint');colorStatus.setAttribute('role','status');
  const colorControls=[];
  for(const [key,label]of [['activeColor','Active word color'],['pastColor','Finished words color'],['futureColor','Upcoming words color'],['glowColor','Glow color']]){
    const input=el('input');input.type='color';input.setAttribute('aria-label',label);input.addEventListener('input',()=>{settings[key]=input.value;applyAppearance();});input.addEventListener('change',saveSettings);
    colorControls.push({key,input,row:styleRow(label,input)});
  }
  const editBox=el('input');editBox.type='checkbox';editBox.setAttribute('aria-label','Move and resize video lyrics');
  const nextBox=el('input');nextBox.type='checkbox';nextBox.setAttribute('aria-label','Show next lyric on video');
  const preferWords=el('input');preferWords.type='checkbox';preferWords.setAttribute('aria-label','Prefer word timestamps');
  const resetLayout=button('Reset positions');const resetStyle=button('Reset style');const customFontButton=button('Load font file');
  const styleActions=el('div','style-actions');styleActions.append(customFontButton,resetLayout,resetStyle);
  const customFontInput=el('input');customFontInput.type='file';customFontInput.accept='.ttf,.otf,.woff,.woff2';customFontInput.hidden=true;
  appearance.append(effectsSection,styleRow('Font',fontSelect),panelAlpha.row,videoAlpha.row,fontSizeControl.row,overlaySizeControl.row,glowControl.row,styleRow('Use cover art colors',coverColors),styleRow('Use video colors',videoColors),colorStatus,...colorControls.map(control=>control.row),styleRow('Auto word effect',autoWords),
    styleRow('Edit video box',editBox),styleRow('Next line on video',nextBox),styleRow('Prefer word timing',preferWords),styleActions,
    el('p','style-hint','Drag the panel’s title bar. Pull its corner to resize. Edit video box reveals its handles. Background 0% is fully transparent.'),customFontInput);
  const wordNote=el('p','word-note');wordNote.hidden=true;
  const audioStatus=el('p','word-note');audioStatus.hidden=true;audioStatus.setAttribute('role','status');
  const inputFile = el('input'); inputFile.type = 'file'; inputFile.accept = '.lrc,.srt,.vtt,.yaml,.yml'; inputFile.hidden = true;
  const search = el('div', 'search'); search.hidden = true;
  const form = el('form'); const query = el('input'); query.type = 'search'; query.placeholder = 'Artist + song title'; query.setAttribute('aria-label', 'Search song lyrics');
  const searchButton = button('Search'); searchButton.type = 'submit'; form.append(query, searchButton);
  const searchNote = el('p', 'search-note', 'Choose the version that matches your video.'); const results = el('div', 'results'); search.append(form, searchNote, results);
  const content = el('div', 'content'); const lyrics = el('div', 'lyrics'); lyrics.hidden = true; lyrics.setAttribute('aria-label', 'Timed lyrics. Click a line to seek.');
  const empty = el('div', 'empty-state'); const emptyNote = el('div', 'note', '♪'); const emptyTitle = el('div', 'empty-title', 'Waiting for a song');
  const emptyCopy = el('div', 'empty-copy', 'Play a music video. Lyrics follow the video’s actual playback time.'); empty.append(emptyNote, emptyTitle, emptyCopy);
  const plain = el('div', 'plain'); plain.hidden = true;
  const follow = button('↓ Follow playback', 'follow'); follow.hidden = true; content.append(empty, lyrics, plain, follow);
  const timing = el('div', 'timing'); const timingRow = el('div', 'timing-row');
  const earlier = button('−0.25', '', 'Show lyrics 0.25 seconds earlier'); const later = button('+0.25', '', 'Show lyrics 0.25 seconds later');
  const offsetInput = el('input'); offsetInput.type = 'number'; offsetInput.step = '0.25'; offsetInput.min = '-600'; offsetInput.max = '600'; offsetInput.value = '0'; offsetInput.setAttribute('aria-label', 'Lyric delay in seconds');
  timingRow.append(el('span', 'timing-label', 'Lyric delay'), earlier, offsetInput, el('span', 'unit', 's'), later);
  const advanced = el('details'); const summary = el('summary', '', 'More timing controls'); const advancedContent = el('div', 'advanced');
  const align = button('First line starts now', '', 'Press when you hear the first lyric being sung'); const reset = button('Reset timing'); const alignRow = el('div', 'advanced-row'); alignRow.append(align, reset);
  const speedRow = el('div', 'advanced-row'); const speedInput = el('input'); speedInput.type = 'number'; speedInput.min = '0.5'; speedInput.max = '2'; speedInput.step = '0.01'; speedInput.value = '1'; speedInput.setAttribute('aria-label', 'Lyric timeline speed');
  speedRow.append(el('label', '', 'Lyric speed (for edited videos)'), speedInput, el('span', 'unit', '×'));
  advancedContent.append(el('p', 'hint', 'Lyrics early? Increase delay. Lyrics late? Decrease it. Saved for this video.'), alignRow, speedRow); advanced.append(summary, advancedContent); timing.append(timingRow, advanced);
  const foot = el('div', 'foot'); const sourceLabel = el('a', '', 'Timed lyrics: LRCLIB'); sourceLabel.href = 'https://lrclib.net'; sourceLabel.target = '_blank'; sourceLabel.rel = 'noopener noreferrer';
  const retry = button('Auto match'); foot.append(sourceLabel, retry);
  const toast = el('div', 'mini-toast'); toast.hidden = true;
  panel.append(top, track, tools, appearance, wordNote,audioStatus, search, content, timing, foot, toast, inputFile);
  const launcher = button('♪ Lyrics', 'launcher'); launcher.hidden = true;
  const panelResize=button('◢','resize-grip','Drag to resize the lyrics panel');panelResize.setAttribute('aria-label','Resize lyrics panel. Drag or use arrow keys.');
  shadow.append(panel, launcher,panelResize);

  const overlayHost = el('div'); overlayHost.id = 'crystal-lyrics-overlay';
  overlayHost.style.cssText = 'position:absolute;z-index:40;pointer-events:none;text-align:center;';
  const overlayShadow = overlayHost.attachShadow({mode: 'open'}); const overlayStyle = el('style');
  overlayStyle.textContent = `:host{all:initial;color-scheme:dark}:host([hidden]){display:none!important}*{box-sizing:border-box}.box{display:inline-block;max-width:100%;background:#110b17d9;border:1px solid #dab6d13d;border-radius:13px;padding:12px 24px;box-shadow:0 2px 16px #0007;font-family:"Segoe UI",Arial,sans-serif}.current{color:#fff0f8;font-size:clamp(19px,2.2vw,34px);font-weight:700;line-height:1.4;white-space:pre-wrap;text-wrap:balance}.next{color:#cbb7d3;font-size:clamp(12px,1.2vw,18px);margin-top:5px}.word.future{color:#aa91b5}.word.sung{color:#f3c7df}.word.current{color:white;text-decoration:underline;text-decoration-color:#eeafd2;text-underline-offset:5px}[hidden]{display:none!important}`;
  overlayStyle.textContent+=`:host{font-family:var(--lyric-font,"Segoe UI",sans-serif)}.box{width:100%;height:100%;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:9px 16px;background:rgba(17,11,23,var(--overlay-alpha,0));border-color:rgba(218,182,209,var(--overlay-edge,0));box-shadow:0 2px 16px rgba(0,0,0,var(--overlay-shadow,0));font-family:inherit;overflow:hidden}.current{font-size:var(--overlay-size,28px);line-height:1.35;text-shadow:0 2px 5px #000,0 1px 2px #000;max-width:100%;overflow-wrap:anywhere}.next{font-size:var(--next-size,15px);line-height:1.3;text-shadow:0 1px 4px #000;max-width:100%}.word.current{background:linear-gradient(90deg,#fff1f8 var(--word-fill,0%),#aa91b5 var(--word-fill,0%));background-clip:text;-webkit-background-clip:text;color:transparent;text-decoration:none;text-shadow:none;filter:drop-shadow(0 1px 2px #000)}.word.sung{color:#ffe5f1}.word{box-decoration-break:clone}.edit-toolbar{position:absolute;left:4px;top:-26px;display:flex;gap:5px;pointer-events:auto;font:11px "Segoe UI",sans-serif}.edit-toolbar button{font:inherit;background:#24132deb;border:1px solid #c18bab;color:#ffe8f4;border-radius:7px;padding:5px 8px;cursor:grab;touch-action:none;user-select:none}.edit-toolbar button:focus-visible,.resize-grip:focus-visible{outline:2px solid #f5b9d7;outline-offset:2px}.resize-grip{position:absolute;right:2px;bottom:2px;width:26px;height:26px;font-size:22px;border:0;background:#28172bdc;border-radius:5px;color:#fac6e2;cursor:nwse-resize;touch-action:none;pointer-events:auto}.edit-outline{position:absolute;inset:0;border:1px dashed #e6afce;border-radius:12px;pointer-events:none}.current.preview{font-size:17px;color:#edd0e4}.next.preview{font-size:11px}`;
  const overlayBox = el('div', 'box'); const overlayCurrent = el('div', 'current'); const overlayNext = el('div', 'next'); overlayBox.append(overlayCurrent, overlayNext); overlayShadow.append(overlayStyle, overlayBox);
  const overlayToolbar=el('div','edit-toolbar');const overlayDrag=button('↔ Drag lyrics');overlayDrag.setAttribute('aria-label','Move video lyrics. Drag or use arrow keys.');
  const finishEdit=button('Done');overlayToolbar.append(overlayDrag,finishEdit);
  const overlayResize=button('◢','resize-grip');overlayResize.setAttribute('aria-label','Resize video lyrics. Drag or use arrow keys.');
  const overlayOutline=el('div','edit-outline');overlayShadow.append(overlayToolbar,overlayResize,overlayOutline);

  const panelResizeNW=button('◤','resize-grip resize-nw','Drag to resize from the upper left');panelResizeNW.setAttribute('aria-label','Resize lyrics panel from upper left');shadow.append(panelResizeNW);
  const overlayResizeNW=button('◤','resize-grip resize-nw');overlayResizeNW.setAttribute('aria-label','Resize video lyrics from upper left');overlayShadow.append(overlayResizeNW);
  style.textContent+=`.resize-nw{left:1px;top:1px;right:auto;bottom:auto;color:#c49abf;font-size:17px}.top,.content,.timing{border-color:rgba(121,91,134,var(--edge-alpha,.4))}.drag-handle{min-width:0}.top .spacer{display:none}.top .eyebrow{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`;
  overlayStyle.textContent+=`.edit-toolbar{top:3px;left:30px}.resize-nw{left:1px;top:1px;right:auto;bottom:auto;font-size:17px}.box.editing{padding-top:28px}`;
  const glowCSS=`.word.current{filter:drop-shadow(0 0 var(--glow-small,6px) var(--glow-color,#ff8fd5)) drop-shadow(0 0 var(--glow-large,13px) var(--glow-color,#ff8fd5));}.word.sung{color:var(--past-color,#f6c4df)!important}.word.future{color:var(--future-color,#ac96b9)!important}.word-gap{color:inherit}`;
  style.textContent+=`.line.active{color:var(--active-color,#fff1f8)}.line.past{color:var(--past-color,#f6c4df)}.line{color:var(--future-color,#ac96b9)}.line.active .word.current{background-image:linear-gradient(90deg,var(--active-color,#fff1f8) var(--word-fill,0%),var(--future-color,#ac96b9) var(--word-fill,0%));}.line.active .word-gap{color:var(--active-color,#fff1f8)}.line.active ${glowCSS}.style-row input[type=color]{width:46px;height:25px;border:1px solid #765276;background:transparent;border-radius:5px;padding:2px;cursor:pointer}`;
  // Individual selectors keep glow confined to the active lyric line.
  style.textContent+=`.line:not(.active) .word{filter:none!important;color:inherit!important}.line.active .word.current{filter:drop-shadow(0 0 var(--glow-small) var(--glow-color)) drop-shadow(0 0 var(--glow-large) var(--glow-color))}`;
  overlayStyle.textContent+=`${glowCSS}.current{color:var(--active-color,#fff1f8)}.next{color:var(--future-color,#ac96b9)}.word.current{background-image:linear-gradient(90deg,var(--active-color,#fff1f8) var(--word-fill,0%),var(--future-color,#ac96b9) var(--word-fill,0%));}`;
  style.textContent+=`.plain{color:var(--active-color,#fff1f8)}.style-row input:disabled{opacity:.55;cursor:default}`;
  style.textContent+=Effects.css('panel')+`.effects-settings{border:1px solid #55415f;border-radius:8px;padding:9px 11px;margin:0 0 10px}.effects-settings summary{cursor:pointer;color:#efd0e5;font-weight:650;font-size:12px}.effect-help{display:block;font-size:10px;color:#b8a1c4;margin-top:2px}.effects-settings button{font-size:10px;padding:6px 8px;margin-top:8px}`;
  overlayStyle.textContent+=Effects.css('overlay');
  const colorMatcher=new Matching.ColorMatcher({
    getSettings:()=>settings,getVideo:()=>video,
    getTrack:()=>!loaded||(!record&&!imported)?{videoId}:{videoId,title:record?.trackName||meta?.title||'',artist:record?.artistName||meta?.artist||'',album:record?.albumName||'',duration:Number(record?.duration)||Number(video?.duration)||0},
    canSample:()=>settings.enabled&&!!videoId&&loaded&&!document.hidden&&!isAd(),
    lookup:track=>message({type:'CL_COVER_COLORS',meta:track}),
    onPalette:palette=>{automaticPalette=palette;applyAppearance();},onStatus:message=>{colorStatus.textContent=message;}
  });

  function viewportFor(key) {
    if(key==='overlayRect'&&overlayParent){const rect=overlayParent.getBoundingClientRect();return {width:overlayParent.clientWidth||rect.width,height:overlayParent.clientHeight||rect.height};}
    return {width:window.innerWidth,height:window.innerHeight};
  }
  function rectangleFor(key) {
    const bounds=viewportFor(key);
    return Appearance.fitRect(settings[key],bounds,key==='panelRect'?{width:370,height:650,x:1,y:1}:{width:Math.min(640,bounds.width*.85),height:112,x:.5,y:.76},key==='panelRect'?280:160,key==='panelRect'?350:56);
  }
  function applyLayout() {
    const panelRect=rectangleFor('panelRect');
    for(const [key,value]of Object.entries(panelRect))host.style[key]=value+'px';
    if(overlayParent){const rect=rectangleFor('overlayRect');for(const[key,value]of Object.entries(rect))overlayHost.style[key]=value+'px';
      const size=Appearance.clamp(settings.overlayFontSize*rect.height/112,12,120);
      overlayHost.style.setProperty('--overlay-size',size+'px');overlayHost.style.setProperty('--next-size',Math.max(11,size*.55)+'px');}
    panelResize.hidden=panelResizeNW.hidden=collapsed;
    overlayToolbar.hidden=overlayResize.hidden=overlayResizeNW.hidden=overlayOutline.hidden=!settings.editLayout;
    overlayBox.classList.toggle('editing',settings.editLayout);
  }
  function syncStyleControls() {
    fontSelect.value=settings.font;
    for(const control of [panelAlpha,videoAlpha,fontSizeControl,overlaySizeControl,glowControl]){control.input.value=settings[control.key];control.output.textContent=settings[control.key]+(control.key.includes('Opacity')?'%':'');}
    for(const control of colorControls){control.input.value=settings[control.key];control.input.disabled=settings.useCoverColors||settings.useVideoColors;control.input.title=control.input.disabled?'Your manual color is saved. Turn off color matching to edit it.':'';}autoWords.checked=settings.autoWordEffect;
    coverColors.checked=settings.useCoverColors;videoColors.checked=settings.useVideoColors;
    for(const control of effectControls)control.input.checked=settings[control.key];reduceEffectsMotion.checked=settings.reduceMotion;
    editBox.checked=settings.editLayout;nextBox.checked=settings.showNext;preferWords.checked=settings.preferWordSync;
  }
  function applyAppearance() {
    Effects.applyFlags([host,overlayHost],settings);
    host.style.setProperty('--font-size',settings.fontSize+'px');
    host.style.setProperty('--panel-alpha',settings.panelOpacity/100);
    host.style.setProperty('--edge-alpha',settings.panelOpacity/100*.65);
    host.style.setProperty('--shadow-alpha',settings.panelOpacity/100*.55);
    overlayHost.style.setProperty('--overlay-alpha',settings.overlayOpacity/100);
    overlayHost.style.setProperty('--overlay-edge',settings.overlayOpacity/100*.3);
    overlayHost.style.setProperty('--overlay-shadow',settings.overlayOpacity/100*.5);
    for(const node of [host,overlayHost]){
      for(const [field,css]of [['activeColor','--active-color'],['pastColor','--past-color'],['futureColor','--future-color'],['glowColor','--glow-color']])node.style.setProperty(css,automaticPalette?.[field]||settings[field]);
      const glow=settings.effectGlow?settings.glowStrength:0;
      node.style.setProperty('--glow-small',(glow*.105).toFixed(2)+'px');node.style.setProperty('--glow-large',(glow*.22).toFixed(2)+'px');
    }
    const requested=Appearance.FONTS.find(item=>item.id===settings.font)||Appearance.FONTS[0];
    for(const node of [host,overlayHost])node.style.setProperty('--lyric-font',requested.family);
    const data=settings.font==='custom'?settings.customFont?.data||'':'';
    if(lastFont!==settings.font||lastFontData!==data){
      lastFont=settings.font;lastFontData=data;const token=++fontToken;
      Appearance.loadFont(settings).then(family=>{if(token!==fontToken)return;for(const node of [host,overlayHost])node.style.setProperty('--lyric-font',family);if(active>=0&&!collapsed)scrollToLine(active);})
        .catch(error=>{if(token!==fontToken)return;for(const node of [host,overlayHost])node.style.setProperty('--lyric-font','"Segoe UI",Arial,sans-serif');showToast(error.message||'Font could not load. Try a different font file.');});
    }
    syncStyleControls();
  }
  async function saveSettings() {
    settings=Appearance.sanitize(settings);
    try{await chrome.storage.local.set({settings});}catch(_){showToast('Could not save appearance. Your changes still work in this tab.');}
  }
  function adjustBox(key,mode,start,dx,dy) {
    const viewport=viewportFor(key);const minimumWidth=key==='panelRect'?280:160;const minimumHeight=key==='panelRect'?350:56;
    const maxWidth=Math.max(1,viewport.width-16),maxHeight=Math.max(1,viewport.height-16);let rect={...start};
    if(mode==='move'){rect.left=Appearance.clamp(start.left+dx,8,Math.max(8,viewport.width-8-start.width));rect.top=Appearance.clamp(start.top+dy,8,Math.max(8,viewport.height-8-start.height));}
    else if(mode==='resize-nw'){
      rect.width=Appearance.clamp(start.width-dx,Math.min(minimumWidth,maxWidth),Math.min(maxWidth,start.left+start.width-8));
      rect.height=Appearance.clamp(start.height-dy,Math.min(minimumHeight,maxHeight),Math.min(maxHeight,start.top+start.height-8));
      rect.left=start.left+start.width-rect.width;rect.top=start.top+start.height-rect.height;
    }else{
      rect.width=Appearance.clamp(start.width+dx,Math.min(minimumWidth,maxWidth),maxWidth);rect.height=Appearance.clamp(start.height+dy,Math.min(minimumHeight,maxHeight),maxHeight);
      rect.left=Math.min(start.left,viewport.width-8-rect.width);rect.top=Math.min(start.top,viewport.height-8-rect.height);
    }
    settings[key]=Appearance.saveRect(rect,viewport);applyLayout();
  }
  function bindBox(handle,key,mode,keyboardHandle=handle) {
    handle.addEventListener('pointerdown',event=>{
      if(event.button!==0||interaction||(handle===top&&event.target.closest('button,input,select')))return;
      event.preventDefault();event.stopPropagation();
      const bounds=key==='overlayRect'?overlayParent?.getBoundingClientRect():null;const viewport=viewportFor(key);
      interaction={handle,key,mode,pointer:event.pointerId,x:event.clientX,y:event.clientY,start:rectangleFor(key),original:settings[key],scaleX:bounds?.width/viewport.width||1,scaleY:bounds?.height/viewport.height||1};
      handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener('pointermove',event=>{
      if(!interaction||interaction.handle!==handle||interaction.pointer!==event.pointerId)return;
      event.preventDefault();event.stopPropagation();const drag=interaction;
      adjustBox(key,mode,drag.start,(event.clientX-drag.x)/drag.scaleX,(event.clientY-drag.y)/drag.scaleY);
    });
    const finish=event=>{if(!interaction||interaction.handle!==handle||interaction.pointer!==event.pointerId)return;event.stopPropagation();
      if(event.type==='pointercancel'){settings[key]=interaction.original;applyLayout();}else saveSettings();interaction=null;
      if(handle.hasPointerCapture(event.pointerId))handle.releasePointerCapture(event.pointerId);
    };
    handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',finish);
    handle.addEventListener('click',event=>{if(handle===top&&event.target.closest('button'))return;event.stopPropagation();});
    keyboardHandle.addEventListener('keydown',event=>{
      const steps={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(!steps[event.key])return;
      event.preventDefault();event.stopPropagation();const amount=event.shiftKey?25:10;const [x,y]=steps[event.key];
      adjustBox(key,mode,rectangleFor(key),x*amount,y*amount);saveSettings();
    });
  }
  bindBox(top,'panelRect','move',nameBlock);bindBox(panelResize,'panelRect','resize');bindBox(panelResizeNW,'panelRect','resize-nw');
  bindBox(overlayDrag,'overlayRect','move');bindBox(overlayResize,'overlayRect','resize');bindBox(overlayResizeNW,'overlayRect','resize-nw');

  function mount() {
    const parent = document.fullscreenElement || document.body;
    if (parent && host.parentNode !== parent) parent.append(host);
    host.hidden = !settings.enabled || !videoId;
    panel.hidden = collapsed; launcher.hidden = !collapsed;
    const player = document.querySelector('#movie_player') || video?.parentElement;
    if (player && player !== overlayParent) { player.append(overlayHost); overlayParent = player; }
    overlayHost.hidden = !settings.enabled || !settings.overlay || !parsed.timed || !videoId || isAd() || (active < 0&&!settings.editLayout);
    overlayButton.setAttribute('aria-pressed', String(settings.overlay));
    applyLayout();applyAppearance();
  }

  async function message(payload) {
    try {
      const result = await chrome.runtime.sendMessage(payload);
      if (!result?.ok) throw new Error(result?.error || 'No response from lyrics lookup. Reload this YouTube tab.');
      return result.result;
    } catch (error) {
      if (/Extension context invalidated/i.test(error.message)) throw new Error('Extension was updated. Refresh this YouTube tab.');
      throw error;
    }
  }

  async function savedVideo() { const stored = await chrome.storage.local.get('videos'); return stored.videos?.[videoId] || {}; }
  async function persistVideo() {
    if (!videoId || !loaded) return;
    const id = videoId; const snapshot = {recordId: record?.id || null, imported, manualChoice, delay, speed, updatedAt: Date.now()};
    try {
      const stored = await chrome.storage.local.get('videos'); const videos = stored.videos || {};
      videos[id] = snapshot;
      const keys = Object.keys(videos).sort((a, b) => videos[a].updatedAt - videos[b].updatedAt);
      let size = new TextEncoder().encode(JSON.stringify(videos)).length;
      while (keys.length > 80 || size > 4000000) { delete videos[keys.shift()]; size = new TextEncoder().encode(JSON.stringify(videos)).length; }
      await chrome.storage.local.set({videos});
    } catch (_) { showToast('Could not save this video’s timing. It will still work in this tab.'); }
  }

  function showToast(text) {
    toast.textContent = text; toast.hidden = false;
    clearTimeout(showToast.timer); showToast.timer = setTimeout(() => { toast.hidden = true; }, 5000);
  }

  function setEmpty(heading, copy, mode = 'empty') {
    empty.hidden = false; lyrics.hidden = true; plain.hidden = true; follow.hidden = true;
    emptyTitle.textContent = heading; emptyCopy.textContent = copy; empty.className = 'empty-state ' + mode;
  }

  function updateTiming() {
    offsetInput.value = String(Math.round(delay * 100) / 100); speedInput.value = String(speed);
    earlier.disabled = later.disabled = offsetInput.disabled = speedInput.disabled = align.disabled = reset.disabled = !parsed.timed;
  }

  function changeTiming(newDelay, newSpeed = speed) {
    delay = Math.max(-600, Math.min(600, Number(newDelay) || 0)); speed = Math.max(0.5, Math.min(2, Number(newSpeed) || 1));
    updateTiming(); active = -2; tick(true); clearTimeout(offsetTimer); offsetTimer = setTimeout(persistVideo, 250);
  }

  function renderLyrics() {
    parsed=WordTiming.enhance(baseParsed,settings,audioTiming);
    lyrics.replaceChildren(); lineElements = []; active = -2; lastWord = ''; lastOverlay = '';
    wordNote.hidden=true;
    if (!parsed.timed) {
      if (record?.plainLyrics) { empty.hidden = true; lyrics.hidden = true; plain.hidden = false; plain.textContent = record.plainLyrics; badge.textContent = 'UNTIMED'; badge.className = 'badge untimed'; }
      else setEmpty(record?.instrumental ? 'Instrumental track' : 'No timed lyrics found', record?.instrumental ? 'This version is listed as instrumental.' : 'Try Find song, or load an LRC / SRT / Lyricsfile with timestamps.');
      updateTiming(); mount(); return;
    }
    empty.hidden = true; plain.hidden = true; lyrics.hidden = false;
    const stats=parsed.timingStats;
    badge.textContent=stats.audio?(stats.estimated?'AUDIO + AUTO':'AUDIO WORDS'):stats.estimated?(stats.supplied?'MIXED WORDS':'AUTO WORDS'):parsed.wordTimed?'WORD SYNC':'LINE SYNC';badge.className='badge';
    wordNote.hidden=!(stats.audio||stats.estimated)||!parsed.timed;
    wordNote.textContent=stats.audio?stats.audio+' words timed from audio'+(stats.estimated?' · '+stats.estimated+' estimated.':'.'):stats.supplied?stats.supplied+' supplied word timings · '+stats.estimated+' estimated.':'Word positions are estimated inside each timed line. Use Local audio timing in the extension popup to improve them.';
    const fragment = document.createDocumentFragment();
    parsed.lines.forEach((line, index) => {
      const node = button('', 'line' + (line.text.trim() ? '' : ' empty'));
      node.dataset.index = String(index); node.title = 'Jump to ' + Core.formatTime(line.time / speed + delay);
      node.setAttribute('aria-label', (line.text || 'Instrumental break') + ', jump to this line');
      const wordEls=renderWords(node,line);
      if(!wordEls.length)node.textContent=line.text||'· · ·';
      node.addEventListener('click', () => {
        if (!video || isAd()) return;
        video.currentTime = Math.max(0, Math.min(Number.isFinite(video.duration) ? video.duration : Infinity, line.time / speed + delay));
        browseUntil = 0; follow.hidden = true; tick(true);
      });
      fragment.append(node); lineElements.push({node, wordEls});
    });
    lyrics.append(fragment); updateTiming(); mount(); tick(true);
  }

  function applyRecord(next, isManual = false) {
    record = next; imported = null; baseParsed = Core.parseRecord(next);baseParsed.duration=Number(next.duration)||video?.duration; source = 'LRCLIB'; loaded = true;
    title.textContent = next.trackName; artist.textContent = next.artistName + (next.albumName ? ' · ' + next.albumName : '');
    sourceLabel.textContent = 'Lyrics: LRCLIB'; sourceLabel.href = 'https://lrclib.net';
    if (isManual) { manualChoice=true;delay = 0; speed = 1; search.hidden = true; }
    renderLyrics(); persistVideo();colorMatcher.sync();
    if (parsed.timed && meta?.duration && next.duration && Math.abs(meta.duration - next.duration) > 6) showToast('Video and song lengths differ. Use lyric delay to align extra intros.');
  }

  function applyImport(file, text, restore = false) {
    const next = Core.parseTimed(text, file.name, video?.duration);
    if (!next.timed) throw new Error('No timestamps found. Use LRC, SRT, VTT, or a timed Lyricsfile YAML.');
    record = null; imported = {name: file.name, text};baseParsed=next;baseParsed.duration=video?.duration; source = 'Your file'; loaded = true;manualChoice=true;
    title.textContent = meta?.title || 'Imported lyrics'; artist.textContent = file.name;
    sourceLabel.textContent = 'Lyrics: your file'; sourceLabel.removeAttribute('href');
    if (!restore) { delay = 0; speed = 1; search.hidden = true; }
    renderLyrics(); persistVideo();colorMatcher.sync();
  }

  function renderResults(records) {
    results.replaceChildren();
    const ranked = meta ? Core.rankRecords(meta, records).map(x => x.record) : records;
    for (const item of ranked.slice(0, 20)) {
      const node = button('', 'result');
      node.append(el('div', 'result-name', item.trackName), el('div', 'result-info', item.artistName + ' · ' + Core.formatTime(item.duration)),
        el('div', 'result-kind', item.hasWordSync ? 'WORD TIMESTAMPS' : Core.recordHasTiming(item) ? 'LINE TIMESTAMPS' : item.instrumental ? 'INSTRUMENTAL' : 'UNTIMED TEXT'));
      node.addEventListener('click', () => { requestNo++; applyRecord(item, true); });
      results.append(node);
    }
    searchNote.textContent = ranked.length ? 'Choose the song version you hear in this video.' : 'No matches. Try artist + title, or load a timed lyric file.';
  }

  function getMeta() {
    const music = location.hostname === 'music.youtube.com';
    const firstText = selectors => {
      for (const selector of selectors) { const text = document.querySelector(selector)?.textContent?.trim(); if (text) return text; }
      return '';
    };
    if (music) {
      const rawTitle = firstText(['ytmusic-player-bar .title', 'ytmusic-player-bar [class~="title"]']);
      const channel = firstText(['ytmusic-player-bar .byline a', 'ytmusic-player-bar .byline'])?.split('•')[0]?.trim();
      return {...Core.inferTrack(rawTitle, channel), duration: Number.isFinite(video?.duration) ? video.duration : 0};
    }
    const rawTitle = firstText(['ytd-watch-metadata h1 yt-formatted-string', 'ytd-watch-metadata h1', '#title h1 yt-formatted-string', 'h1.title']) || document.title.replace(/ - YouTube$/, '');
    const channel = firstText(['ytd-watch-metadata #owner #channel-name a', '#owner #channel-name a', 'ytd-video-owner-renderer #channel-name']);
    const next = Core.inferTrack(rawTitle, channel);
    // The Music section, when YouTube supplies it, describes the actual recording.
    const musicSection = document.querySelector('ytd-video-description-music-section-renderer');
    if (musicSection) {
      for (const row of musicSection.querySelectorAll('ytd-info-row-renderer')) {
        const label = row.querySelector('#title')?.textContent?.trim().toLowerCase();
        const value = row.querySelector('#default-metadata')?.textContent?.trim();
        if (value && (label === 'song' || label === 'песня')) next.title = Core.cleanTitle(value);
        if (value && (label === 'artist' || label === 'исполнитель')) next.artist = Core.cleanArtist(value);
      }
    }
    return {...next, duration: Number.isFinite(video?.duration) ? video.duration : 0};
  }

  function isAd() { return !!document.querySelector('#movie_player.ad-showing, #movie_player.ad-interrupting'); }

  function renderWords(node,line) {
    if(!line.words.length)return [];
    const segments=Core.wordSegments(line);if(!segments.length)return [];
    const elements=new Array(line.words.length);
    for(const segment of segments){const span=el('span',segment.wordIndex<0?'word-gap':'word future',segment.text);node.append(span);if(segment.wordIndex>=0)elements[segment.wordIndex]=span;}
    return elements;
  }

  function updateOverlay(index) {
    const line = parsed.lines[index];
    const visible = !!(settings.enabled && settings.overlay && parsed.timed && (line?.text.trim()||settings.editLayout) && !isAd());
    overlayHost.hidden = !visible;
    if (!visible) return;
    const key = videoId + ':' + index+':'+settings.editLayout+':'+settings.showNext;
    if (lastOverlay !== key) {
      overlayCurrent.replaceChildren(); overlayWordEls = [];
      const preview=!line?.text.trim();overlayCurrent.classList.toggle('preview',preview);overlayNext.classList.toggle('preview',preview);
      if(!preview){overlayWordEls=renderWords(overlayCurrent,line);if(!overlayWordEls.length)overlayCurrent.textContent=line.text;}
      else overlayCurrent.textContent='Your lyric box';
      overlayNext.textContent=preview?'Drag its header or resize its corners':settings.showNext?parsed.lines[index+1]?.text||'':'';
      overlayNext.hidden=!preview&&!settings.showNext;lastOverlay = key;
    }
  }

  function tick(force = false) {
    if (!video || !videoId || !settings.enabled) return;
    const ad = isAd();
    const mediaState = (ad ? 'Ad · sync paused' : video.ended ? 'Ended' : video.seeking ? 'Seeking' : video.paused ? 'Paused' : video.readyState < 3 ? 'Buffering' : 'Playing')
      + ' · ' + Core.formatTime(video.currentTime);
    if (mediaState !== lastState) { state.textContent = mediaState; lastState = mediaState; }
    if (ad) { overlayHost.hidden = true; return; }
    if (!parsed.timed) return;
    const time = Core.lyricTime(video.currentTime, delay, speed);
    const index = Core.activeIndex(parsed.lines, time);
    if (index !== active) {
      for (let i = 0; i < lineElements.length; i++) {
        lineElements[i].node.classList.toggle('active', i === index);
        lineElements[i].node.classList.toggle('past', index >= 0 && i < index);
        if (i === index) lineElements[i].node.setAttribute('aria-current', 'true'); else lineElements[i].node.removeAttribute('aria-current');
      }
      active = index; lastWord = '';
      if (index >= 0 && !collapsed && search.hidden && Date.now() >= browseUntil) scrollToLine(index);
    }
    if (!follow.hidden && browseUntil <= Date.now() && index >= 0 && !collapsed && search.hidden) scrollToLine(index);
    follow.hidden = !(browseUntil > Date.now() && parsed.timed);
    updateOverlay(index);
    if(index>=0){const opacity=Effects.lineOpacity(settings,parsed.lines[index],time).toFixed(3);lineElements[index]?.node.style.setProperty('--effect-line-opacity',opacity);overlayCurrent.style.setProperty('--effect-line-opacity',opacity);}
    if (index >= 0 && parsed.lines[index].words.length) {
      const words = parsed.lines[index].words;
      const classes = words.map(w => time >= w.end ? 'sung' : time >= w.time ? 'current' : 'future');
      const key = index + ':' + classes.join(',') + ':' + settings.overlay;
      if (key !== lastWord || force) {
        for (const [i, kind] of classes.entries()) {
          const node = lineElements[index]?.wordEls[i]; if (node) node.className = 'word ' + kind;
          if (overlayWordEls[i]) overlayWordEls[i].className = 'word ' + kind;
        }
        lastWord = key;
      }
      for(let i=0;i<words.length;i++)if(classes[i]==='current'){
        const progress=Appearance.wordProgress(time,words[i]);const fill=progress.toFixed(1)+'%';
        lineElements[index]?.wordEls[i]?.style.setProperty('--word-fill',fill);
        overlayWordEls[i]?.style.setProperty('--word-fill',fill);
        Effects.applyWord([lineElements[index]?.wordEls[i],overlayWordEls[i]],settings,progress);
      }
    }
  }

  function scrollToLine(index) {
    const node = lineElements[index]?.node;
    if (!node || lyrics.hidden) return;
    const target = node.offsetTop - lyrics.offsetTop - lyrics.clientHeight * 0.42 + node.offsetHeight / 2;
    lyrics.scrollTo({top: Math.max(0, target), behavior: settings.reduceMotion ? 'instant' : 'smooth'});
  }

  function animate(now) {
    frame = 0;
    if (!video || video.paused || video.ended || !settings.enabled || document.hidden) return;
    if (now - lastFrame >= (parsed.wordTimed?32:65)) { tick(); lastFrame = now; }
    frame = requestAnimationFrame(animate);
  }
  function startClock() { if (!frame && video && !video.paused && settings.enabled && !document.hidden) frame = requestAnimationFrame(animate); }
  function stopClock() { if (frame) cancelAnimationFrame(frame); frame = 0; }

  function attachVideo(next) {
    if (next === video) return;
    stopClock(); for (const [event, handler] of videoListeners) video?.removeEventListener(event, handler); videoListeners = []; video = next;
    colorMatcher.sync();if (!video) return;
    for (const event of ['play', 'playing', 'pause', 'waiting', 'stalled', 'ended', 'seeking', 'seeked', 'timeupdate', 'ratechange', 'loadedmetadata', 'durationchange', 'emptied']) {
      const handler = () => {
        tick(event === 'seeked');
        if(['seeked','loadedmetadata','play'].includes(event))colorMatcher.sample();
        if (event === 'pause' || event === 'ended') stopClock(); else startClock();
        if (event === 'loadedmetadata' || event === 'durationchange' || event === 'emptied') scheduleDiscovery();
      };
      video.addEventListener(event, handler); videoListeners.push([event, handler]);
    }
    startClock();
  }

  async function fetchLyrics(myEpoch, auto = false) {
    const myRequest = ++requestNo;
    const stillHere = () => myEpoch === epoch && myRequest === requestNo && settings.enabled;
    setEmpty('Finding timed lyrics…', 'Matching this video to a recording with real timestamps.', 'loading'); badge.textContent = 'LOOKING UP'; badge.className = 'badge';
    try {
      if (!auto) {
        const saved = await savedVideo(); if (!stillHere()) return;
        delay = Number(saved.delay) || 0; speed = Number(saved.speed) || 1;
        if (saved.imported?.text) { applyImport({name: saved.imported.name}, saved.imported.text, true); return; }
        if (saved.recordId) {
          const savedRecord = await message({type: 'CL_RECORD', id: saved.recordId}); if (!stillHere()) return;
          if (savedRecord) {
            manualChoice=saved.manualChoice===true;applyRecord(savedRecord);
            if(settings.preferWordSync&&!manualChoice&&!baseParsed.wordTimed&&!parsed.usingAudio){
              try{const upgrade=await message({type:'CL_LOOKUP',meta,preferWordSync:true});if(stillHere()&&upgrade.selected&&Core.parseRecord(upgrade.selected).wordTimed)applyRecord(upgrade.selected);}
              catch(error){if(stillHere())showToast('Using saved lyrics. '+error.message);}
            }
            return;
          }
        }
      }
      const result = await message({type: 'CL_LOOKUP', meta,preferWordSync:settings.preferWordSync}); if (!stillHere()) return;
      if (result.selected) { applyRecord(result.selected); search.hidden = true; }
      else {
        badge.textContent = 'CHOOSE A SONG'; record = null; imported = null; parsed = {lines: [], timed: false, wordTimed: false}; loaded = true;
        colorMatcher.sync();
        setEmpty('Pick the right song', result.candidates?.length ? 'Automatic matching was uncertain. Choose a recording below to keep the lyrics accurate.' : 'Try the artist + song title, or load a timed lyric file.');
        search.hidden = false; renderResults(result.candidates || []); updateTiming(); mount();
      }
    } catch (error) {
      if (!stillHere()) return;
      badge.textContent = 'LOOKUP UNAVAILABLE'; setEmpty('Couldn’t load lyrics', error.message, 'error'); updateTiming();
    }
  }

  function currentId() {
    const url = new URL(location.href);
    if (url.pathname !== '/watch') return '';
    return url.searchParams.get('v') || '';
  }

  function resetTrack(id) {
    epoch++; requestNo++; videoId = id; loaded = false; meta = null; record = null; imported = null; source = '';manualChoice=false;
    parsed = {lines: [], timed: false, wordTimed: false};baseParsed={lines:[],timed:false,wordTimed:false};audioTiming=null; lineElements = []; active = -2; delay = 0; speed = 1;
    browseUntil = 0; lastOverlay = ''; lastState = ''; pendingMeta = null; lyrics.replaceChildren(); plain.replaceChildren(); results.replaceChildren(); search.hidden = true;
    overlayHost.hidden = true;wordNote.hidden=true; updateTiming();
    title.textContent = id ? 'Reading this video…' : 'Open a music video'; artist.textContent = 'YouTube + YouTube Music'; badge.textContent = 'READY';
    setEmpty('Waiting for the video', 'Lyrics will appear once the song title and playback duration are ready.'); mount();colorMatcher.sync();
    if(id){const currentEpoch=epoch;chrome.storage.local.get('audioTimings').then(stored=>{if(currentEpoch!==epoch)return;audioTiming=stored.audioTimings?.[id]||null;if(loaded)renderLyrics();});}
  }

  async function discover() {
    const id = currentId();
    if (id !== videoId) resetTrack(id);
    attachVideo(document.querySelector('#movie_player video.html5-main-video') || document.querySelector('video.html5-main-video') || document.querySelector('video'));
    mount();
    if (!settings.enabled || !id || !video || isAd()) return;
    if (!meta) {
      const candidate = getMeta();
      if (!candidate.title || !candidate.duration || document.querySelector('ytd-watch-flexy[is-loading]')) return;
      const pageId = document.querySelector('ytd-watch-flexy')?.getAttribute('video-id');
      if (pageId && pageId !== id) return;
      const fingerprint = candidate.title + '\u0000' + candidate.artist + '\u0000' + Math.round(candidate.duration);
      if (pendingMeta?.fingerprint !== fingerprint) { pendingMeta = {fingerprint, at: Date.now()}; scheduleDiscovery(); return; }
      if (Date.now() - pendingMeta.at < 400) { scheduleDiscovery(); return; }
      meta = candidate; title.textContent = meta.title; artist.textContent = meta.artist || 'Choose artist in Find song'; query.value = [meta.artist, meta.title].filter(Boolean).join(' ');
      if (!loaded) fetchLyrics(epoch);
    }
    tick(); startClock();
  }

  function scheduleDiscovery() { clearTimeout(discoveryTimer); discoveryTimer = setTimeout(discover, 450); }
  close.addEventListener('click', () => { collapsed = true; mount(); });
  launcher.addEventListener('click', () => { collapsed = false; mount(); if (active >= 0) scrollToLine(active); });
  find.addEventListener('click', () => { search.hidden = !search.hidden; if (!search.hidden) query.focus(); });
  load.addEventListener('click', () => inputFile.click());
  styleButton.addEventListener('click',()=>{appearance.hidden=!appearance.hidden;styleButton.setAttribute('aria-pressed',String(!appearance.hidden));});
  overlayButton.addEventListener('click', async () => { settings.overlay = !settings.overlay;if(!settings.overlay)settings.editLayout=false; mount(); tick(true); await saveSettings(); });
  fontSelect.addEventListener('change',()=>{settings.font=fontSelect.value;if(settings.font==='custom'&&!settings.customFont)showToast('Use Load font file to choose a TTF, OTF, WOFF or WOFF2.');applyAppearance();saveSettings();});
  customFontButton.addEventListener('click',()=>customFontInput.click());
  customFontInput.addEventListener('change',async()=>{const file=customFontInput.files?.[0];customFontInput.value='';if(!file)return;
    try{settings.customFont=await Appearance.importFont(file);settings.font='custom';applyAppearance();saveSettings();showToast('Font loaded: '+file.name);}catch(error){showToast(error.message||'This font could not be read.');}});
  editBox.addEventListener('change',()=>{settings.editLayout=editBox.checked;if(settings.editLayout)settings.overlay=true;mount();tick(true);saveSettings();});
  nextBox.addEventListener('change',()=>{settings.showNext=nextBox.checked;tick(true);saveSettings();});
  preferWords.addEventListener('change',()=>{settings.preferWordSync=preferWords.checked;saveSettings();if(meta&&settings.preferWordSync&&!baseParsed.wordTimed&&!imported&&!manualChoice)fetchLyrics(epoch,true);});
  autoWords.addEventListener('change',()=>{settings.autoWordEffect=autoWords.checked;renderLyrics();saveSettings();});
  reduceEffectsMotion.addEventListener('change',()=>{settings.reduceMotion=reduceEffectsMotion.checked;applyAppearance();tick(true);saveSettings();});
  resetEffects.addEventListener('click',()=>{Object.assign(settings,Effects.DEFAULTS);applyAppearance();tick(true);saveSettings();});
  coverColors.addEventListener('change',async()=>{settings.useCoverColors=coverColors.checked;if(coverColors.checked)settings.useVideoColors=false;automaticPalette=null;applyAppearance();await saveSettings();colorMatcher.sync();});
  videoColors.addEventListener('change',async()=>{settings.useVideoColors=videoColors.checked;if(videoColors.checked)settings.useCoverColors=false;automaticPalette=null;applyAppearance();await saveSettings();colorMatcher.sync();});
  finishEdit.addEventListener('click',event=>{event.stopPropagation();settings.editLayout=false;mount();tick(true);saveSettings();});
  resetLayout.addEventListener('click',()=>{settings.panelRect=settings.overlayRect=null;applyLayout();saveSettings();});
  resetStyle.addEventListener('click',()=>{for(const key of ['font','fontSize','overlayFontSize','panelOpacity','overlayOpacity','showNext','editLayout','glowStrength','activeColor','pastColor','futureColor','glowColor','useCoverColors','useVideoColors',...Effects.OPTIONS.map(option=>option.key)])settings[key]=Appearance.DEFAULTS[key];colorMatcher.sync();mount();tick(true);saveSettings();});
  form.addEventListener('submit', async event => {
    event.preventDefault(); const value = query.value.trim(); if (!value) { query.focus(); return; }
    const myEpoch = epoch; const myRequest = ++requestNo; searchButton.disabled = true; searchNote.textContent = 'Searching timed lyrics…';
    try { const found = await message({type: 'CL_SEARCH', query: value}); if (myEpoch === epoch && myRequest === requestNo) renderResults(found || []); }
    catch (error) { if (myEpoch === epoch && myRequest === requestNo) searchNote.textContent = error.message; }
    finally { searchButton.disabled = false; }
  });
  inputFile.addEventListener('change', async () => {
    const file = inputFile.files?.[0]; inputFile.value = ''; if (!file) return;
    const myEpoch = epoch;
    try {
      if (file.size > 600000) throw new Error('Choose a lyric file smaller than 600 KB.');
      const text = await file.text(); if (myEpoch !== epoch) return;
      requestNo++; applyImport(file, text); showToast('Imported real timestamps. Click a line to jump to it.');
    } catch (error) { showToast(error.message); }
  });
  earlier.addEventListener('click', () => changeTiming(delay - 0.25)); later.addEventListener('click', () => changeTiming(delay + 0.25));
  offsetInput.addEventListener('change', () => changeTiming(offsetInput.value)); speedInput.addEventListener('change', () => changeTiming(delay, speedInput.value));
  align.addEventListener('click', () => { const first = parsed.lines.find(line => line.text.trim()); if (video && first && !isAd()) changeTiming(video.currentTime - first.time / speed); });
  reset.addEventListener('click', () => changeTiming(0, 1));
  retry.addEventListener('click', () => { if (!meta || isAd()) return; delay = 0; speed = 1;manualChoice=false;parsed=baseParsed={lines:[],timed:false,wordTimed:false}; loaded = false; renderLyrics(); fetchLyrics(epoch, true); });
  for (const event of ['wheel', 'touchmove', 'pointerdown']) lyrics.addEventListener(event, () => { browseUntil = Date.now() + 8000; follow.hidden = false; }, {passive: true});
  follow.addEventListener('click', () => { browseUntil = 0; follow.hidden = true; if (active >= 0) scrollToLine(active); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopClock(); else { tick(true); startClock();colorMatcher.sample(); scheduleDiscovery(); } });
  document.addEventListener('fullscreenchange', () => { mount(); tick(true); });
  document.addEventListener('yt-navigate-start', () => {if(audioRecording){chrome.runtime.sendMessage({type:'CL_AUDIO_CLOCK',token:audioToken,clock:{...clockSnapshot(),videoId:''}}).catch(()=>{});stopAudioClock();}resetTrack(''); stopClock(); });
  document.addEventListener('yt-navigate-finish', scheduleDiscovery);
  document.addEventListener('yt-page-data-updated', scheduleDiscovery);
  window.addEventListener('popstate', scheduleDiscovery);
  window.addEventListener('resize',()=>{applyLayout();if(active>=0&&!collapsed)scrollToLine(active);},{passive:true});

  function clockSnapshot(){return {videoId,videoTime:Number(video?.currentTime)||0,wallTime:Date.now(),rate:Number(video?.playbackRate)||1,paused:!!video?.paused,ad:isAd(),ended:!!video?.ended};}
  function stopAudioClock(){clearInterval(audioClockTimer);audioClockTimer=0;if(audioRecording&&video)video.playbackRate=originalPlaybackRate;audioRecording=false;}
  function sendAudioClock(){chrome.runtime.sendMessage({type:'CL_AUDIO_CLOCK',token:audioToken,clock:clockSnapshot()}).catch(()=>{});if(video?.ended)stopAudioClock();}

  chrome.runtime.onMessage.addListener((message, _sender, reply) => {
    if(message?.type==='CL_COLOR_STATUS'){reply({ok:true,result:colorMatcher.state()});return false;}
    if(message?.type==='CL_AUDIO_CONTEXT'){
      reply(video&&baseParsed.timed&&!isAd()?{ok:true,videoId,duration:video.duration,lines:baseParsed.lines.map(line=>({time:line.time,end:Number.isFinite(line.end)?line.end:null,text:line.text,words:line.words}))}:{ok:false,error:'Load line-timed lyrics and wait for any ad to finish first.'});return false;
    }
    if(message?.type==='CL_AUDIO_RECORD'){
      (async()=>{if(!video||isAd())throw new Error('Wait for the song video to be ready.');originalPlaybackRate=video.playbackRate;video.pause();video.currentTime=0;video.playbackRate=1;
        audioToken=message.token;audioRecording=true;await video.play();sendAudioClock();audioClockTimer=setInterval(sendAudioClock,200);
      })().then(()=>reply({ok:true}),error=>{stopAudioClock();reply({ok:false,error:error.message});});return true;
    }
    if(message?.type==='CL_AUDIO_UPDATE'){
      if(message.stage!=='capturing'&&message.stage!=='preparing')stopAudioClock();
      audioStatus.hidden=message.stage==='idle';audioStatus.textContent=message.message+(message.stage==='model'&&message.progress?' '+Math.round(message.progress)+'%':'');reply({ok:true});return false;
    }
    if(message?.type==='CL_AUDIO_TIMING'){
      if(message.videoId===videoId){audioTiming=message.timing;delay=0;speed=1;renderLyrics();persistVideo();showToast('Audio timing is ready. Replay this video to use it.');}reply({ok:true});return false;
    }
    if (message?.type === 'CL_SHOW') { collapsed = false; mount(); scheduleDiscovery(); reply({ok: true}); }
    if (message?.type === 'CL_REFRESH') { if (meta) {manualChoice=false; parsed = {lines: [], timed: false, wordTimed: false}; fetchLyrics(epoch, true); } else scheduleDiscovery(); reply({ok: true}); }
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.settings) return;
    const wasEnabled = settings.enabled;const previousAuto=settings.autoWordEffect; settings = Appearance.sanitize(changes.settings.newValue||{});
    if(previousAuto!==settings.autoWordEffect&&loaded)renderLyrics();
    colorMatcher.sync();mount(); if (!settings.enabled) { stopClock(); requestNo++; } else {
      if (!wasEnabled && meta && !loaded) fetchLyrics(epoch); tick(true); startClock(); scheduleDiscovery();
    }
  });
  chrome.storage.local.get('settings').then(stored => {
    settings = Appearance.sanitize(stored.settings||{});colorMatcher.sync();mount(); discover();
  }).catch(() => discover());
  // A light watchdog covers YouTube swapping the video element and SPA layouts.
  setInterval(discover, 1400);
})();
