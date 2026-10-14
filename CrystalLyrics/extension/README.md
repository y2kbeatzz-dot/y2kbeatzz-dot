# CrystalLyrics 1.4

A free Chrome / Edge desktop extension for YouTube and YouTube Music, with cover or video color matching, word effects, steady glow, custom colors, fonts, and movable transparent lyric boxes.

## Install or update

1. Extract the ZIP into a permanent folder. Open **START-HERE.html** for the visual guide.
2. In Chrome, open `chrome://extensions`. In Edge, open `edge://extensions`.
3. Turn on **Developer mode**, click **Load unpacked**, and select the **CrystalLyrics** folder containing `manifest.json`.
4. Refresh YouTube, play a song, and pin CrystalLyrics using the browser's puzzle-piece Extensions menu.

**Updating an existing version:** Copy the new files and folders into your existing **CrystalLyrics** extension folder, replacing the old files. Click the extension's **Reload** button on the extension page, then refresh YouTube. Keep the same folder to preserve your preferences and song choices. Desktop Chrome / Edge 116 or newer is required.

## Word effects, glow and colors

Open **Style** in the lyric panel, or click the extension icon.

- **Automatic word effect** is on by default. Songs with only line timestamps now get word-by-word karaoke fill. It estimates each word's position within the real line interval; this is labeled **AUTO WORDS**.
- **Prefer word timing** searches for a confidently matching recording with supplied word timestamps. Those timestamps take priority over estimates and audio analysis.
- **Word glow** controls the current word's steady glow. Set it to **0** to turn the glow off. It does not flash or pulse.
- Pick independent colors for the **active word**, **finished words**, **upcoming words**, and **glow**. The colors apply to both lyric boxes and are remembered.

### Choose your lyric effects

Open **Style → Lyric effects** in the panel, or **Lyric effects** in the extension popup. Each effect has its own switch, applies to both lyric boxes, and is remembered. You can combine them.

| Effect | What it does |
| --- | --- |
| Karaoke fill | Fills the current word from left to right. Turn it off for a solid current-word highlight. |
| Word glow | Turns the steady word glow on or off while keeping your strength and color choices. |
| Word lift | Raises the current word slightly. |
| Word emphasis | Makes the current word a little larger. |
| Word underline | Draws a small underline that fills with the word's timing. |
| Line fade | Softly fades a line in and out, and dims surrounding lines. |
| Soft focus | Slightly blurs surrounding lines, keeping the current line clear. |

Word movement, underline progress and line fades follow the video's lyric clock. Pausing and buffering hold them still, and seeking updates their position immediately. Effects use the selected timing source: supplied word times, learned audio times, or clearly labeled estimates.

**Reduce motion** stays on by default. It keeps word lift and emphasis at a still position while each word is active, and makes line fades instant. Turn it off for gentle movement through each word and line. There are no flashing or repeatedly pulsing effects.

Karaoke fill and word glow start on; the five new effects start off. **Reset effects** restores these switches while keeping your colors, fonts, glow strength and box layout. The popup includes a still preview of the selected effects. Word effects need word-timed lyrics or the automatic word effect; line fade and soft focus also work with line-only timing.

### Match colors to the cover art or video

Two optional toggles are available in **Style** and the extension popup:

- **Use cover art colors:** Looks up artwork using the selected lyric recording's song title and artist, preferring its album when available. It checks the recording version and duration before accepting a match. Colors from the artwork become the active, finished, upcoming and glow colors in both boxes. The Style status identifies the album used. Imported lyrics use the video's inferred song metadata.
- **Use video colors:** Reads the current video picture locally and uses its palette for the lyrics and glow. It samples a tiny frame at most once every 2 seconds and blends gently toward new colors. Ads and hidden tabs are skipped; dark frames retain the last palette. It does not need a cover lookup or a recording permission.

Choosing one matching mode switches the other off. Both start off, so your manual colors remain the default. Your manual colors stay saved while matching is on; switch it off to restore or edit them. Glow strength stays adjustable in either mode.

If no confident cover match is found, your manual colors remain in use. Some protected or cross-origin players block reading their video pixels; the status explains this and you can choose cover art colors instead. The extension does not modify the video's media source to work around pixel restrictions.

### Learn timing from the song's audio

For better timing on a line-only song:

1. Load the correct lyric version using automatic lookup, **Find song**, or **Load lyrics**.
2. Click the extension icon, expand **Local audio timing**, then click **Learn this song**.
3. The song restarts and plays at normal speed. Let it finish. The extension captures this tab's audio locally while following the video clock. Keep this song tab open.
4. Wait while it finds word positions. The first use downloads an approximately **80 MB** model; later uses reuse the browser's model cache. Processing can take a while, depending on your computer and song length.
5. Replay the video when the status says timing is saved. Recognized words use the generated timestamps, and missed words keep the estimated effect.

You can use **Finish & analyze** for the captured portion, or **Cancel** to stop learning. Recording supports songs from 3 seconds to 20 minutes. It captures tab audio, not your microphone, and does not upload the audio. Original YouTube playback speed is restored after capture. Learned timing is tied to this video and lyric version; changing the lyrics prevents unrelated learned timings from being applied.

Audio recognition can miss or mistime singing, especially with loud instruments, overlapping vocals, unfamiliar pronunciation, or remixes. Estimated word effects also cannot identify exact vocal onsets. Neither method guarantees perfect word sync for every song. Genuine supplied word timestamps are preferred when available.

## Fonts, transparency, moving and resizing

- Choose **Outfit**, **Space Grotesk**, a Windows/system font, or **Load font file** for your own TTF, OTF, WOFF or WOFF2. Bundled fonts work without a font website. Custom fonts must be under 1.5 MB.
- **Panel background** and **Video background** independently control opacity. **0% is fully transparent** and **100% is solid**. Text stays visible; the video box starts fully transparent.
- Set each box's text size independently.
- Drag the panel's title bar to move it. Pull its upper-left or lower-right corner to resize it.
- Enable **Edit video box** for the video lyric box's drag header and resize handles. Click **Done** to hide the handles and let clicks pass through to the video again.
- Layout, colors, fonts, opacity and sizes are remembered. **Reset positions** restores the original layout. Focus a move/resize handle and use arrow keys for keyboard control; Shift moves farther.

## Playback and timing

Lyrics follow `video.currentTime`, so pauses, buffering, seeks, and YouTube playback-speed changes remain aligned. Click a lyric line to seek to it. Manual scrolling temporarily releases automatic following. Ads suspend the display; audio anchors inside ads are excluded from learned timings. The optional video overlay also works in fullscreen.

Labels distinguish the timing source:

| Label | Timing used |
| --- | --- |
| WORD SYNC | Supplied word timestamps |
| AUTO WORDS | Estimated words within line timestamps |
| MIXED WORDS | Supplied word timestamps plus estimates |
| AUDIO WORDS | Locally recognized word positions |
| AUDIO + AUTO | Audio word positions plus estimated missed words |
| LINE SYNC | Line timestamps with automatic word effect turned off |
| UNTIMED | Plain lyric text; no playback highlighting |

**Lyric delay:** positive values show lyrics later; negative values show them earlier. **First line starts now** aligns an added video intro. Learned audio timing resets delay and lyric speed for this video, because its timestamps already refer to the video clock.

**Lyric speed:** leave at 1.00 for normal videos, including when using YouTube's playback-speed button. Change it only when the upload itself was edited to a different tempo. The formula is `lyricTime = (video.currentTime - delaySeconds) * lyricSpeed`.

Import `.lrc`, enhanced `.lrc`, `.srt`, `.vtt`, and timed `.lyricsfile.yaml` files. Untimed lyrics remain plain text. Reduced motion is enabled by default.

## Troubleshooting

- **No panel?** Open a standard YouTube or YouTube Music watch page, refresh after installing/reloading, then click the extension icon → **Show lyrics**.
- **Wrong song?** Use **Find song** and choose the actual artist, title and recording version. Fan-channel metadata can be misleading.
- **Words feel early or late?** Check the timing label. AUTO WORDS is estimated. Try local audio timing, import word-timed lyrics, or adjust the lyric delay.
- **Audio timing could not find the lyrics?** Select the correct lyric version and retry. The instant estimated effect stays available. Singing may be difficult for the model to recognize.
- **Model cannot download?** Check your connection and access to Hugging Face. Automatic word effects do not need the model.
- **Lyrics drift after video cuts?** A single delay cannot fix new verses or cuts. Use a matching recording, learned audio timing, or a lyric file for that upload.
- **Lyric lookup unavailable?** Retry later or import a timed lyric file. Imported files do not require a lyric-service request.
- **YouTube layout changed?** Selectors may need updating. This release targets standard desktop watch pages, not Shorts, live streams, embedded players, Firefox, or mobile browsers.

## Data and permissions

The extension uses `storage` for preferences and lyrics, `activeTab` for popup controls, and `tabCapture` / `offscreen` for the optional local audio tool. Tab capture starts only when you click **Learn this song**. It accesses neither your microphone nor your camera.

Host access to `lrclib.net` allows lyric lookup. The displayed song title, artist and duration are sent there with ordinary request/network metadata. Imported lyrics, custom fonts, account details and audio are not sent to LRCLIB. Requests do not include YouTube account cookies.

When **Use cover art colors** is on, host access to `itunes.apple.com` and `*.mzstatic.com` allows a song-title/artist search and downloading the matching cover for local palette extraction. No YouTube account cookies, audio, lyric text or font files are included. Only the palette and matched song metadata are cached, with bounded storage. The cover image is discarded after extraction. Switching to manual or video colors prevents new cover requests; a request already in flight may finish and its result is ignored if the mode or song changed.

Video colors read a tiny frame in memory on the YouTube page. Video frames are neither saved nor uploaded. Video mode does not start audio capture, camera capture or screen recording.

Hugging Face host access downloads model files for optional local analysis. The audio and transcription are not uploaded to that service. All executable code is packaged locally; model weights are data. There is no analytics, subscription, login, API key or server to set up.

Song choices, imported lyrics, fonts, timing preferences and bounded lyric/timing caches remain in this browser profile. Captured audio is held temporarily during analysis and discarded afterward; only the resulting word timings are saved. The downloaded model is cached separately by the browser. Nothing is published or shared by the extension.

## Attribution

- Extension code: copyright 2026 CrystalLyrics, MIT license in `LICENSE.txt`.
- Runtime lyrics: [LRCLIB](https://lrclib.net/docs). Lyrics remain subject to their owners' rights.
- Cover color lookup: [Apple's iTunes Search API](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/UnderstandingSearchResults.html). Artwork remains subject to its owners' rights; colors are extracted temporarily and the extension stores only palettes.
- Word timestamp format: [Lyricsfile](https://github.com/tranxuanthang/lyricsfile).
- Audio model: [onnx-community/whisper-base_timestamped](https://huggingface.co/onnx-community/whisper-base_timestamped), revision `608c49e61301901684bc36cac8f74b95ff6b5a8e`; quantized model weights download on demand.
- Bundled Transformers.js 3.8.1: Apache 2.0 license in `vendor/TRANSFORMERS-LICENSE.txt`; its Jinja dependency license is included too.
- Bundled ONNX Runtime Web 1.22 development snapshot: MIT license and third-party notices in `vendor/`. Additional bundled notices are in `vendor/transformers.bundle.js.LEGAL.txt`.
- Bundled js-yaml: MIT license in `vendor/JS-YAML-LICENSE.txt`.
- Outfit and Space Grotesk: SIL Open Font License texts in `fonts/`.
- Installation: [official Chrome Load unpacked instructions](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked).

No build step, Node.js, Python or server is needed to install this extension.
