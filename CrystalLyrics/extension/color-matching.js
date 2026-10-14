(function(root){
  'use strict';
  const Palette=root.CrystalPalette;
  class ColorMatcher{
    constructor(hooks){this.hooks=hooks;this.mode='manual';this.key='';this.generation=0;this.palette=null;this.status='Manual colors are saved.';this.timer=0;this.video=null;this.canvas=null;this.blocked=false;this.lastSample=-Infinity;}
    state(){return {mode:this.mode,status:this.status,palette:this.palette};}
    say(message){if(this.status===message)return;this.status=message;this.hooks.onStatus(message);}
    colors(value){this.palette=Palette.sanitize(value);this.hooks.onPalette(this.palette);}
    sync(){
      const settings=this.hooks.getSettings();const track=this.hooks.getTrack();const video=this.hooks.getVideo();
      const mode=!settings.enabled?'manual':settings.useVideoColors?'video':settings.useCoverColors?'cover':'manual';
      const key=mode+'|'+(track?.videoId||'')+'|'+JSON.stringify(track||null);
      if(key===this.key&&(mode!=='video'||video===this.video))return;
      this.key=key;this.mode=mode;this.video=video;this.generation++;clearInterval(this.timer);this.timer=0;this.blocked=false;this.canvas=null;this.lastSample=-Infinity;this.colors(null);
      if(mode==='manual'){this.say('Manual colors are saved. Turn on a matching mode to use automatic colors.');return;}
      if(mode==='cover'){
        if(!track?.title||!track?.artist){this.say('Waiting for the song title and artist. Choose the correct lyrics in Find song.');return;}
        const generation=this.generation;this.say('Looking up matching cover art…');
        this.hooks.lookup(track).then(result=>{
          if(generation!==this.generation)return;
          const palette=Palette.sanitize(result?.palette);
          if(!palette){this.say('No matching cover art found. Using your manual colors.');return;}
          this.colors(palette);this.say('Cover colors: '+result.artist+(result.album?' · '+result.album:''));
        }).catch(error=>{if(generation===this.generation)this.say((error.message||'Cover lookup unavailable.')+' Using your manual colors.');});
        return;
      }
      this.say('Waiting for the video picture…');this.sample();this.timer=setInterval(()=>this.sample(),2000);
    }
    sample(){
      if(this.mode!=='video'||this.blocked||!this.hooks.canSample())return;
      const video=this.hooks.getVideo();if(!video||video.readyState<2||!video.videoWidth||!video.videoHeight)return;
      const now=Date.now();if(now-this.lastSample<2000)return;this.lastSample=now;
      try{
        if(!this.canvas){this.canvas=document.createElement('canvas');this.canvas.width=48;this.canvas.height=36;}
        const context=this.canvas.getContext('2d',{willReadFrequently:true});
        context.drawImage(video,video.videoWidth*.08,video.videoHeight*.08,video.videoWidth*.84,video.videoHeight*.84,0,0,48,36);
        const next=Palette.fromPixels(context.getImageData(0,0,48,36).data);
        if(next){this.colors(Palette.blend(this.palette,next,.2));this.say('Video colors active · gentle updates every 2 seconds.');}
        else this.say('Dark frame · keeping the last colors until the picture changes.');
      }catch(error){
        if(error.name==='SecurityError'){this.blocked=true;this.canvas=null;this.colors(null);this.say('This player blocks video color sampling. Using manual colors; cover art colors are also available.');}
        else this.say('Waiting for a readable video frame…');
      }
    }
    stop(){this.generation++;clearInterval(this.timer);this.timer=0;}
  }
  root.CrystalColorMatching={ColorMatcher};
  if(typeof module!=='undefined'&&module.exports)module.exports={ColorMatcher};
})(typeof globalThis!=='undefined'?globalThis:this);
