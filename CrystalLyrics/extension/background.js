'use strict';
importScripts('vendor/js-yaml.min.js', 'lyrics-core.js','palette-core.js');

const Core = globalThis.CrystalLyricsCore;
const API = 'https://lrclib.net';
const TTL = 7 * 24 * 60 * 60 * 1000;
const CACHE_BYTES = 2500000;
let queue = Promise.resolve();
let lastFetch = 0;

function schedule(job) {
  const result = queue.then(job, job);
  queue = result.catch(() => {});
  return result;
}

function safeString(value, limit = 220) { return typeof value === 'string' ? value.trim().slice(0, limit) : ''; }

function safeRecord(raw) {
  if (!raw || !Number.isSafeInteger(Number(raw.id)) || Number(raw.id) <= 0) return null;
  return {
    id: Number(raw.id), trackName: safeString(raw.trackName), artistName: safeString(raw.artistName),
    albumName: safeString(raw.albumName), duration: Number(raw.duration) || 0,
    instrumental: raw.instrumental === true, hasWordSync: raw.hasWordSync === true,
    syncedLyrics: safeString(raw.syncedLyrics, 600000) || null,
    plainLyrics: safeString(raw.plainLyrics, 600000) || null,
    lyricsfile: safeString(raw.lyricsfile, 600000) || null
  };
}

async function getJSON(path, parameters = {}) {
  const url = new URL(path, API);
  for (const [key, value] of Object.entries(parameters)) if (value !== '' && value != null) url.searchParams.set(key, String(value));
  const key = url.pathname + url.search;
  const stored = await chrome.storage.local.get(['lyricCache', 'retryAfter']);
  const cache = stored.lyricCache || {};
  if (cache[key] && Date.now() - cache[key].at < TTL) return cache[key].value;
  if (Number(stored.retryAfter) > Date.now()) {
    throw new Error('The lyrics server is busy. Try again in ' + Math.ceil((stored.retryAfter - Date.now()) / 1000) + ' seconds.');
  }
  const wait = Math.max(0, 300 - (Date.now() - lastFetch));
  if (wait) await new Promise(resolve => setTimeout(resolve, wait));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  let response;
  try {
    lastFetch = Date.now();
    response = await fetch(url.href, {
      signal: controller.signal, credentials: 'omit', cache: 'no-store',
      headers: {'Accept': 'application/json', 'Lrclib-Client': 'CrystalLyrics/1.4.0 (YouTube timestamped lyrics extension)'}
    });
    if (response.status === 404) return null;
    if (response.status === 429) {
      const header = response.headers.get('Retry-After');
      const seconds = Number(header);
      const until = header && /^\d+(?:\.\d+)?$/.test(header) ? Date.now() + Math.max(1, seconds) * 1000 : Date.parse(header);
      const retryAfter = Number.isFinite(until) && until > Date.now() ? until : Date.now() + 60000;
      await chrome.storage.local.set({retryAfter});
      throw new Error('The lyrics server is busy. Try again in ' + Math.ceil((retryAfter - Date.now()) / 1000) + ' seconds.');
    }
    if (!response.ok) throw new Error('Lyrics server returned HTTP ' + response.status + '. Try again later or load a lyric file.');
    const text = await response.text();
    if (text.length > 14000000) throw new Error('Lyrics server response was too large.');
    const raw = JSON.parse(text);
    const value = Array.isArray(raw) ? raw.slice(0, 20).map(safeRecord).filter(Boolean) : safeRecord(raw);
    if (!value) throw new Error('Lyrics server returned an unexpected response.');
    cache[key] = {at: Date.now(), value};
    const sorted = Object.keys(cache).sort((a, b) => cache[a].at - cache[b].at);
    let size = new TextEncoder().encode(JSON.stringify(cache)).length;
    while (sorted.length && (size > CACHE_BYTES || sorted.length > 60)) {
      delete cache[sorted.shift()]; size = new TextEncoder().encode(JSON.stringify(cache)).length;
    }
    await chrome.storage.local.set({lyricCache: cache});
    return value;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Lyrics lookup timed out. Try Find song or load an LRC file.');
    if (error instanceof TypeError) throw new Error('Could not reach the lyrics server. Check your connection or load a lyric file.');
    throw error;
  } finally { clearTimeout(timeout); }
}

async function lookup(raw, preferWords = true) {
  const meta = {title: safeString(raw.title), artist: safeString(raw.artist), rawTitle: safeString(raw.rawTitle), duration: Number(raw.duration) || 0};
  if (!meta.title) return {selected: null, candidates: []};
  const candidates = new Map();
  const collect = value => {
    for (const record of Array.isArray(value) ? value : value ? [value] : []) candidates.set(record.id, record);
  };
  const rankedCandidates = () => Core.rankRecords(meta, [...candidates.values()]);
  const wordSelected = () => rankedCandidates().find(item => item.confident && Core.parseRecord(item.record).wordTimed)?.record;
  const selected = () => (preferWords && wordSelected()) || rankedCandidates().find(item => item.confident)?.record;
  if (meta.artist && meta.duration >= 1 && meta.duration <= 3600) {
    collect(await getJSON('/api/get', {track_name: meta.title, artist_name: meta.artist, duration: Math.round(meta.duration)}));
    if (selected() && (!preferWords || wordSelected())) return {selected: selected(), candidates: [...candidates.values()]};
  }
  collect(await getJSON('/api/search', {track_name: meta.title, artist_name: meta.artist}));
  if (selected()) return {selected: selected(), candidates: Core.rankRecords(meta, [...candidates.values()]).map(x => x.record)};
  // Fan uploads often have a channel name unrelated to the artist.
  collect(await getJSON('/api/search', {q: [meta.artist, meta.title].filter(Boolean).join(' ')}));
  if (!selected()) collect(await getJSON('/api/search', {track_name: meta.title}));
  const ranked = Core.rankRecords(meta, [...candidates.values()]).slice(0, 20);
  return {selected: ranked.find(item => item.confident)?.record || null, candidates: ranked.map(item => item.record)};
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (!message || !['CL_LOOKUP', 'CL_SEARCH', 'CL_RECORD'].includes(message.type)) return false;
  let allowed = false;
  try { const url = new URL(sender.url || ''); allowed = sender.id === chrome.runtime.id && ['www.youtube.com', 'music.youtube.com'].includes(url.hostname) && url.protocol === 'https:'; } catch (_) {}
  if (!allowed) { reply({ok: false, error: 'Lyrics requests are only accepted from YouTube.'}); return false; }
  schedule(async () => {
    if (message.type === 'CL_LOOKUP') return lookup(message.meta || {}, message.preferWordSync !== false);
    if (message.type === 'CL_SEARCH') {
      const query = safeString(message.query);
      if (!query) throw new Error('Enter a song title and artist.');
      return getJSON('/api/search', {q: query});
    }
    const id = Number(message.id);
    if (!Number.isSafeInteger(id) || id < 1) throw new Error('Invalid lyrics record.');
    return getJSON('/api/get/' + id);
  }).then(result => reply({ok: true, result}), error => reply({ok: false, error: error.message || 'Lyrics lookup failed.'}));
  return true;
});
importScripts('audio-manager.js');
importScripts('artwork-manager.js');
