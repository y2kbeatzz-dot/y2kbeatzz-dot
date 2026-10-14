(function (root) {
  'use strict';

  const MAX_TEXT = 600000;
  const MAX_LINES = 4000;
  const VARIANTS = /\b(live|remix|cover|slowed|sped|nightcore|acoustic|instrumental)\b/gi;
  const NOISE = /\b(official\s*(music\s*)?(video|audio|visuali[sz]er|lyric\s*video)?|music\s*video|lyric\s*video|lyrics?|audio|visuali[sz]er|hd|hq|4k|8k|explicit)\b/gi;

  function normalize(value) {
    return String(value || '').normalize('NFKD').replace(/\p{M}/gu, '')
      .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  }

  function cleanTitle(value) {
    return String(value || '').replace(/\s*-\s*YouTube(?: Music)?\s*$/i, '')
      .replace(/[\[(]([^\])]+)[\])]/g, (all, inside) => {
        const cleaned = inside.replace(NOISE, '').replace(/[^\p{L}\p{N}]+/gu, '').trim();
        return cleaned ? all : ' ';
      })
      .replace(NOISE, ' ').replace(/\s*[|•]\s*$/g, '')
      .replace(/\s{2,}/g, ' ').replace(/^[-–—|\s]+|[-–—|\s]+$/g, '').trim();
  }

  function cleanArtist(value) {
    return String(value || '').replace(/\s*[-–—]\s*Topic\s*$/i, '')
      .replace(/VEVO\s*$/i, '').replace(/\s+Official(?:\s+Channel)?\s*$/i, '').trim();
  }

  function inferTrack(rawTitle, channel) {
    const title = cleanTitle(rawTitle);
    const parts = title.split(/\s+[-–—|:]\s+/);
    if (parts.length > 1) return {title: parts.slice(1).join(' - ').trim(), artist: cleanArtist(parts[0]), rawTitle: title};
    return {title, artist: cleanArtist(channel), rawTitle: title};
  }

  function similarity(a, b) {
    a = normalize(a); b = normalize(b);
    if (!a || !b) return 0;
    if (a === b) return 1;
    const left = new Set(a.split(' ')); const right = new Set(b.split(' '));
    let count = 0;
    for (const word of left) if (right.has(word)) count++;
    return (2 * count) / (left.size + right.size);
  }

  function variantList(value) { return [...String(value || '').toLowerCase().matchAll(VARIANTS)].map(x => x[0]); }

  function recordHasTiming(record) {
    return !!(record?.syncedLyrics && /\[\d+:\d+(?:[.,]\d+)?\]/.test(record.syncedLyrics)) || !!record?.hasWordSync;
  }

  function scoreRecord(meta, record) {
    const titleScore = similarity(cleanTitle(meta.title), cleanTitle(record.trackName));
    const artistScore = similarity(cleanArtist(meta.artist), cleanArtist(record.artistName));
    const hasArtist = !!normalize(meta.artist);
    const delta = Number.isFinite(meta.duration) && Number(record.duration) > 0 ? Math.abs(meta.duration - record.duration) : null;
    let score = titleScore * 65 + artistScore * 25;
    if (delta !== null) score += Math.max(-18, 10 - delta * 0.45);
    if (record.hasWordSync) score += 2;
    if (!recordHasTiming(record)) score -= 35;
    const wanted = variantList(meta.rawTitle || meta.title);
    const found = variantList(record.trackName + ' ' + record.albumName);
    const versionMismatch = wanted.some(v => !found.includes(v)) || found.some(v => !wanted.includes(v));
    if (versionMismatch) score -= 20;
    const durationFits = delta === null || delta <= Math.max(35, Number(record.duration) * 0.16);
    const confident = recordHasTiming(record) && !versionMismatch && durationFits && titleScore >= 0.8
      && ((!hasArtist && delta !== null && delta <= 3 && titleScore === 1) || (hasArtist && artistScore >= 0.65 && score >= 75));
    return {score, titleScore, artistScore, delta, confident};
  }

  function rankRecords(meta, records) {
    return records.map(record => ({record, ...scoreRecord(meta, record)})).sort((a, b) => b.score - a.score);
  }

  function parseClock(value) {
    const match = String(value).trim().match(/^(?:(\d+):)?(\d{1,3}):(\d{2})(?:[.,](\d{1,3}))?$/);
    if (!match || Number(match[3]) >= 60) return NaN;
    return Number(match[1] || 0) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number('0.' + (match[4] || '0'));
  }

  function wordSegments(line) {
    const result=[];let cursor=0;
    for(let i=0;i<line.words.length;i++){
      const word=line.words[i];let text=word.text;let at=line.text.indexOf(text,cursor);
      if(at<0){text=text.trim();at=text?line.text.indexOf(text,cursor):-1;}
      if(at<0)return [];
      if(at>cursor)result.push({text:line.text.slice(cursor,at),wordIndex:-1});
      result.push({text,wordIndex:i});cursor=at+text.length;
    }
    if(cursor<line.text.length)result.push({text:line.text.slice(cursor),wordIndex:-1});
    return result;
  }

  function finishLines(input, duration) {
    const lines = input.filter(line => Number.isFinite(line.time) && line.time >= 0 && line.time < 86400)
      .sort((a, b) => a.time - b.time).slice(0, MAX_LINES);
    // Identical timestamped lines are duplicates; different text at the same time can be a duet.
    const seen = new Set();
    const unique = lines.filter(line => { const key = line.time + '\u0000' + line.text; if (seen.has(key)) return false; seen.add(key); return true; });
    for (let i = 0; i < unique.length; i++) {
      const line = unique[i];
      const next = unique.slice(i + 1).find(x => x.time > line.time)?.time;
      if (!Number.isFinite(line.end) || line.end <= line.time) line.end = next ?? (Number.isFinite(duration) && duration > line.time ? duration : Infinity);
      line.words = (line.words || []).filter(w => Number.isFinite(w.time) && w.time >= line.time && w.text)
        .sort((a, b) => a.time - b.time);
      for (let j = 0; j < line.words.length; j++) {
        const word = line.words[j];
        if (!Number.isFinite(word.end) || word.end < word.time) word.end = line.words[j + 1]?.time ?? line.end;
      }
      if(line.words.length&&!wordSegments(line).length)line.words=[];
    }
    return {lines: unique, timed: unique.some(x => x.text.trim()), wordTimed: unique.some(x => x.words.length > 0)};
  }

  function parseLRC(text, duration) {
    if (typeof text !== 'string' || text.length > MAX_TEXT) throw new Error('Lyric file is too large. Use a file smaller than 600 KB.');
    const tag = text.match(/\[offset:\s*(-?\d+)\s*\]/i);
    const offset = tag ? Number(tag[1]) / 1000 : 0;
    const lines = [];
    for (const raw of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
      const stamps = [...raw.matchAll(/\[(\d{1,3}:\d{2}(?:[.,]\d{1,3})?)\]/g)];
      if (!stamps.length) continue;
      const body = raw.replace(/\[\d{1,3}:\d{2}(?:[.,]\d{1,3})?\]/g, '').trim();
      const wordTags = [...body.matchAll(/<(\d{1,3}:\d{2}(?:[.,]\d{1,3})?)>/g)];
      for (const stamp of stamps) {
        const time = parseClock(stamp[1]) + offset;
        const shift = parseClock(stamp[1]) - parseClock(stamps[0][1]);
        const words = [];
        const prefix = wordTags.length ? body.slice(0, wordTags[0].index) : '';
        if (prefix) words.push({time, text: prefix});
        for (let i = 0; i < wordTags.length; i++) {
          const current = wordTags[i];
          const next = wordTags[i + 1];
          const wordText = body.slice(current.index + current[0].length, next?.index ?? body.length);
          if (wordText) words.push({time: parseClock(current[1]) + offset + shift,
            end: next ? parseClock(next[1]) + offset + shift : undefined, text: wordText});
        }
        const endMarker = wordTags.length && !body.slice(wordTags.at(-1).index + wordTags.at(-1)[0].length).trim()
          ? parseClock(wordTags.at(-1)[1]) + offset + shift : undefined;
        lines.push({time, end: endMarker, text: body.replace(/<\d{1,3}:\d{2}(?:[.,]\d{1,3})?>/g, ''), words});
      }
    }
    return finishLines(lines, duration);
  }

  function parseSubtitles(text, duration) {
    const lines = [];
    for (const block of text.replace(/^\uFEFF/, '').replace(/\r/g, '').split(/\n\s*\n/)) {
      const rows = block.split('\n');
      const index = rows.findIndex(row => row.includes('-->'));
      if (index < 0) continue;
      const match = rows[index].match(/([\d:.,]+)\s*-->\s*([\d:.,]+)/);
      if (!match) continue;
      const time = parseClock(match[1]); const end = parseClock(match[2]);
      const body = rows.slice(index + 1).join('\n');
      const text = body.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
      lines.push({time, end, text, words: []});
    }
    return finishLines(lines, duration);
  }

  function parseLyricsfile(text, duration) {
    const yaml = root.jsyaml || (typeof require === 'function' ? require('./vendor/js-yaml.min.js') : null);
    if (!yaml) throw new Error('Lyricsfile reader is unavailable. Try an LRC file instead.');
    const doc = yaml.load(text, {schema: yaml.JSON_SCHEMA});
    if (!doc || !Array.isArray(doc.lines)) return {lines: [], timed: false, wordTimed: false};
    const lines = doc.lines.slice(0, MAX_LINES).map(line => ({
      time: typeof line.start_ms === 'number' ? line.start_ms / 1000 : NaN,
      end: typeof line.end_ms === 'number' ? line.end_ms / 1000 : undefined,
      text: typeof line.text === 'string' ? line.text : '',
      words: Array.isArray(line.words) ? line.words.slice(0, 600).map(word => ({
        time: typeof word.start_ms === 'number' ? word.start_ms / 1000 : NaN,
        end: typeof word.end_ms === 'number' ? word.end_ms / 1000 : undefined,
        text: typeof word.text === 'string' ? word.text : ''
      })) : []
    }));
    return finishLines(lines, duration || (typeof doc.metadata?.duration_ms === 'number' ? doc.metadata.duration_ms / 1000 : undefined));
  }

  function parseTimed(text, fileName = '', duration) {
    if (typeof text !== 'string' || text.length > MAX_TEXT) throw new Error('Use a lyric file smaller than 600 KB.');
    if (/\.ya?ml$/i.test(fileName) || /^\s*version:/.test(text)) return parseLyricsfile(text, duration);
    if (text.includes('-->')) return parseSubtitles(text, duration);
    return parseLRC(text, duration);
  }

  function parseRecord(record) {
    if (record.lyricsfile && record.lyricsfile.length <= MAX_TEXT) {
      try { const parsed = parseLyricsfile(record.lyricsfile, Number(record.duration)); if (parsed.timed && (parsed.wordTimed || !record.syncedLyrics)) return parsed; } catch (_) { /* LRC is a portable fallback. */ }
    }
    if (record.syncedLyrics) return parseLRC(record.syncedLyrics, Number(record.duration));
    return {lines: [], timed: false, wordTimed: false};
  }

  function lyricTime(videoTime, delay = 0, speed = 1) {
    return (Number(videoTime) - Number(delay || 0)) * Math.max(0.25, Math.min(4, Number(speed) || 1));
  }

  function activeIndex(lines, time) {
    let low = 0; let high = lines.length - 1; let result = -1;
    while (low <= high) {
      const middle = (low + high) >>> 1;
      if (lines[middle].time <= time) { result = middle; low = middle + 1; } else high = middle - 1;
    }
    return result >= 0 && time < lines[result].end ? result : -1;
  }

  function formatTime(value) {
    if (!Number.isFinite(Number(value))) return '—:—';
    value = Math.max(0, Math.floor(Number(value)));
    return Math.floor(value / 60) + ':' + String(value % 60).padStart(2, '0');
  }

  const api = {normalize, cleanTitle, cleanArtist, inferTrack, similarity, recordHasTiming, scoreRecord, rankRecords,
    parseClock, parseLRC, parseSubtitles, parseLyricsfile, parseTimed, parseRecord, wordSegments, lyricTime, activeIndex, formatTime};
  root.CrystalLyricsCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
