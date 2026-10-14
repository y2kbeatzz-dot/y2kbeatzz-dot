(function(root){
  'use strict';
  const Core=root.CrystalLyricsCore||(typeof require==='function'?require('./lyrics-core.js'):null);
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  function tokens(text){return [...String(text).matchAll(/\S+/gu)].map(match=>({text:match[0],at:match.index,key:key(match[0])}));}
  function key(text){return String(text).normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');}
  function weight(text){const vowelGroups=(text.toLowerCase().match(/[aeiouyаеёиоуыэюя]+/g)||[]).length;return clamp(.65+vowelGroups*.6+Math.min(10,text.length)*.035,.8,4.5);}
  function signature(lines){let hash=2166136261;for(const line of lines){const text=line.time.toFixed(3)+'|'+line.text+'\n';for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}}return (hash>>>0).toString(16);}
  function distribute(parts,start,end){
    if(!parts.length)return [];
    const span=Math.max(.03*parts.length,end-start);const total=parts.reduce((sum,part)=>sum+weight(part.text),0);let cursor=start;
    return parts.map((part,index)=>{const time=cursor;cursor=index===parts.length-1?start+span:cursor+span*weight(part.text)/total;return {text:part.text,time,end:cursor,timingSource:'estimated'};});
  }
  function estimated(line,next,duration){
    const parts=tokens(line.text);if(!parts.length)return [];
    let end=Number.isFinite(line.end)?line.end:next?.time;
    if(!Number.isFinite(end)||end<=line.time)end=Number.isFinite(duration)&&duration>line.time?Math.min(duration,line.time+8):line.time+8;
    // Long instrumental gaps should not stretch one short sentence across the gap.
    const singingWindow=Math.max(2.4,parts.length*.72+parts.reduce((sum,p)=>sum+weight(p.text),0)*.12);
    if(end-line.time>12)end=Math.min(end,line.time+singingWindow);
    return distribute(parts,line.time,end);
  }
  function enhance(base,settings={},saved=null){
    const matches=saved&&saved.signature===signature(base.lines)&&Array.isArray(saved.lines);
    const selected=matches?saved.lines:base.lines;const lines=[];let supplied=0,audio=0,auto=0;
    for(let i=0;i<selected.length;i++){
      const raw=selected[i];const line={...raw,words:(raw.words||[]).filter(word=>settings.autoWordEffect!==false||word.timingSource!=='estimated').map(word=>({...word}))};
      if(line.words.length){for(const word of line.words){if(word.timingSource==='audio')audio++;else if(word.timingSource==='estimated')auto++;else supplied++;}}
      else if(settings.autoWordEffect!==false&&line.text.trim()){line.words=estimated(line,selected[i+1],base.duration);auto+=line.words.length;}
      lines.push(line);
    }
    return {...base,lines,wordTimed:lines.some(line=>line.words.length),timingStats:{supplied,audio,estimated:auto},timingMode:audio?'audio':auto?'estimated':'source',usingAudio:!!matches};
  }
  function mapClock(seconds,anchors){
    if(!anchors.length)return null;
    let lo=0,hi=anchors.length-1;
    while(lo<hi){const mid=(lo+hi)>>>1;if(anchors[mid].audioTime<seconds)lo=mid+1;else hi=mid;}
    const b=anchors[lo],a=anchors[Math.max(0,lo-1)];
    if(a.ad||b.ad||a.paused||b.paused||a.videoId!==b.videoId)return null;
    if(Math.abs(b.videoTime-a.videoTime)>Math.max(2,(b.audioTime-a.audioTime)*Math.max(a.rate||1,b.rate||1)*2))return null;
    if(b.audioTime===a.audioTime)return a.videoTime+(seconds-a.audioTime)*(a.rate||1);
    return a.videoTime+clamp((seconds-a.audioTime)/(b.audioTime-a.audioTime),0,1)*(b.videoTime-a.videoTime);
  }
  function audioWords(chunks,anchors){
    const result=[];
    for(const chunk of chunks||[]){
      if(!Array.isArray(chunk.timestamp)||!Number.isFinite(chunk.timestamp[0])||!Number.isFinite(chunk.timestamp[1]))continue;
      const time=mapClock(chunk.timestamp[0],anchors),end=mapClock(chunk.timestamp[1],anchors);
      const wordTokens=tokens(chunk.text||'');if(time==null||end==null||time<0||end<=time||wordTokens.length!==1||!wordTokens[0].key)continue;
      result.push({text:wordTokens[0].text,key:wordTokens[0].key,time,end});
    }
    return result.sort((a,b)=>a.time-b.time);
  }
  function align(known,recognized){
    const n=known.length,m=recognized.length;if(n>2200||m>3000)throw new Error('This recording has too many words. Analyze a shorter song.');
    const trace=new Uint8Array((n+1)*(m+1));let previous=new Float32Array(m+1);
    for(let j=0;j<=m;j++){previous[j]=j;trace[j]=2;}
    for(let i=1;i<=n;i++){
      const current=new Float32Array(m+1);current[0]=i;trace[i*(m+1)]=1;
      for(let j=1;j<=m;j++){
        const exact=known[i-1].key&&known[i-1].key===recognized[j-1].key;
        const diagonal=previous[j-1]+(exact?0:1.7),deletion=previous[j]+1,insertion=current[j-1]+1;
        if(diagonal<=deletion&&diagonal<=insertion){current[j]=diagonal;trace[i*(m+1)+j]=0;}
        else if(deletion<=insertion){current[j]=deletion;trace[i*(m+1)+j]=1;}else{current[j]=insertion;trace[i*(m+1)+j]=2;}
      }previous=current;
    }
    const pairs=new Map();let i=n,j=m;
    while(i||j){const move=trace[i*(m+1)+j];if(i&&j&&move===0){if(known[i-1].key===recognized[j-1].key)pairs.set(i-1,recognized[j-1]);i--;j--;}else if(i&&(!j||move===1))i--;else j--;}
    return pairs;
  }
  function fromAudio(baseLines,chunks,anchors,duration){
    const recognized=audioWords(chunks,anchors);if(!recognized.length)throw new Error('No reliable sung words were recognized. The automatic effect is still available.');
    const known=[];const byLine=[];
    for(let index=0;index<baseLines.length;index++){const parts=tokens(baseLines[index].text);byLine.push(parts);for(const part of parts)known.push({...part,line:index,global:known.length});}
    const pairs=align(known,recognized);const accepted=new Map();let cursor=0;
    for(let index=0;index<baseLines.length;index++){
      const parts=byLine[index];const matches=parts.map((_,i)=>pairs.get(cursor+i));cursor+=parts.length;
      const count=matches.filter(Boolean).length;
      if(parts.length&&count>=Math.max(1,Math.ceil(parts.length*.65))){
        const actual=matches.filter(Boolean);const span=actual.at(-1).end-actual[0].time;
        if(span>0&&span<Math.max(20,parts.length*2))accepted.set(index,{matches,count,start:actual[0].time,end:actual.at(-1).end});
      }
    }
    if(!accepted.size)throw new Error('The vocal recognition did not match these lyrics closely enough. Try the correct lyric version.');
    const anchorList=[...accepted].map(([index,value])=>({original:baseLines[index].time,actual:value.start}));
    function shifted(time){
      let a=anchorList[0],b=null;for(const anchor of anchorList){if(anchor.original<=time)a=anchor;else{b=anchor;break;}}
      if(b&&b.original>a.original)return a.actual+(time-a.original)*clamp((b.actual-a.actual)/(b.original-a.original),.4,2.5);
      return a.actual+time-a.original;
    }
    const result=[];let matched=0,estimatedCount=0;
    for(let index=0;index<baseLines.length;index++){
      const original=baseLines[index],parts=byLine[index],entry=accepted.get(index);
      // Preserve supplied word timing; audio analysis fills the line-only parts.
      if(original.words?.length){result.push({...original,words:original.words.map(word=>({...word}))});continue;}
      const nextTime=index+1<baseLines.length?shifted(baseLines[index+1].time):duration;
      let start=shifted(original.time),end=Number.isFinite(nextTime)&&nextTime>start?nextTime:Math.min(duration,start+8);
      let words=[];
      if(entry){
        const firstMatch=entry.matches.findIndex(Boolean),lastMatch=entry.matches.findLastIndex(Boolean);
        start=Math.max(0,entry.start-firstMatch*.28);end=Math.max(entry.end+(parts.length-1-lastMatch)*.28,start+.05);const seeded=distribute(parts,start,end);
        words=seeded.map((word,i)=>entry.matches[i]?{text:parts[i].text,time:entry.matches[i].time,end:entry.matches[i].end,timingSource:'audio'}:word);
        // Unrecognized words use only the interval between neighboring recognized words.
        for(let i=0;i<words.length;){if(entry.matches[i]){matched++;i++;continue;}const first=i;while(i<words.length&&!entry.matches[i])i++;
          const left=first?words[first-1].end:start;const right=i<words.length?words[i].time:end;
          const fill=distribute(parts.slice(first,i),left,Math.max(left+.04*(i-first),right));words.splice(first,i-first,...fill);estimatedCount+=fill.length;
        }
        if(words.length){start=words[0].time;end=Math.max(...words.map(w=>w.end));}
      }else if(parts.length){words=estimated({...original,time:start,end},null,duration);estimatedCount+=words.length;end=words.at(-1)?.end||end;}
      result.push({time:Math.max(0,start),end:Math.min(duration,end),text:original.text,words});
    }
    result.sort((a,b)=>a.time-b.time);
    return {signature:signature(baseLines),lines:result,matchedWords:matched,estimatedWords:estimatedCount,createdAt:Date.now()};
  }
  const api={tokens,key,weight,signature,estimated,enhance,mapClock,audioWords,align,fromAudio};root.CrystalWordTiming=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
