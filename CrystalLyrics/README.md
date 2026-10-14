# Crystal Lyrics

**Let the lyrics set the mood.**

A free desktop Chrome / Edge extension for YouTube and YouTube Music, made by Crystal.

**[Website & interactive preview](https://crystal-lyrics.xqv5xwnjjq.chatgpt.site/)** · **[Download v1.4.0](https://crystal-lyrics.xqv5xwnjjq.chatgpt.site/downloads/CrystalLyrics-v1.4.0.zip)** · **[Installation guide](https://crystal-lyrics.xqv5xwnjjq.chatgpt.site/guide.html)** · **[Privacy](https://crystal-lyrics.xqv5xwnjjq.chatgpt.site/privacy.html)**

![Crystal Lyrics — Let the lyrics set the mood](https://crystal-lyrics.xqv5xwnjjq.chatgpt.site/assets/social-card.png)

## Features

- Synced lyrics following the video clock, including pause, seek and playback-speed changes.
- Word highlighting, karaoke fill, steady glow and individual effect toggles.
- Optional cover-art palette lookup or local video color sampling.
- Movable, resizable lyric panel and video overlay, with independent opacity and text size.
- Outfit, Space Grotesk, system fonts and custom font imports.
- Timed lyric-file imports and optional local audio timing.
- Reduced motion enabled by default.

The extension distinguishes supplied word timestamps, estimated word effects, learned audio timestamps and line-only timing. Exact word sync is not guaranteed for every song.

## Install

1. [Download the complete ZIP](https://crystal-lyrics.xqv5xwnjjq.chatgpt.site/downloads/CrystalLyrics-v1.4.0.zip) and extract it into a permanent folder.
2. Open `chrome://extensions` or `edge://extensions` and enable **Developer mode**.
3. Choose **Load unpacked** and select the inner **CrystalLyrics** folder containing `manifest.json`.
4. Refresh YouTube / YouTube Music, start a song and open the extension.

Desktop Chrome / Edge 116 or newer is required. Firefox, Safari, mobile browsers, Shorts, livestreams and embedded players are not supported in this release. This is a manual installation, not a browser-store listing. No Node.js, Python or server is required to use the extension.

To update, replace the files in the same extension folder, click **Reload** on the browser’s extensions page and refresh YouTube.

## Source and releases

This project lives in the `CrystalLyrics/` folder of Crystal’s public profile repository.

- `extension/`: the complete original v1.4.0 extension, including locally packaged runtime code, fonts and third-party notices.
- `website/`: the landing page, style preview, guide and privacy page. To self-host, copy the release ZIP and checksum file into its `downloads/` directory.
- `release.json`: pinned release URLs and SHA-256 checksums.
- `publish_release.py`: the release workflow’s checksum-verified source import and release publishing helper.

The release workflow imports the extension and website source from the published, checksum-pinned archives and commits them here. The [complete extension ZIP](https://crystal-lyrics.xqv5xwnjjq.chatgpt.site/downloads/CrystalLyrics-v1.4.0.zip) contains all extension source and dependencies even while the first workflow is running.

**[Release downloads](https://github.com/y2kbeatzz-dot/y2kbeatzz-dot/releases/tag/crystal-lyrics-v1.4.0)** · **[SHA-256 checksums](https://crystal-lyrics.xqv5xwnjjq.chatgpt.site/downloads/SHA256SUMS.txt)** · **[Website source ZIP](https://crystal-lyrics.xqv5xwnjjq.chatgpt.site/downloads/CrystalLyrics-Website-Source-v1.4.0.zip)**

## Privacy and permissions

There is no analytics, login, subscription or API key. Settings and lyric data stay in the browser profile. Lyric lookup sends song metadata to LRCLIB. Optional cover colors query Apple’s iTunes Search API and download artwork. Optional local timing downloads an approximately 80 MB model from Hugging Face; tab audio is processed locally after the user starts capture. The microphone and camera are not used. External services receive normal network metadata. [Read the details](https://crystal-lyrics.xqv5xwnjjq.chatgpt.site/privacy.html).

## Support

[Open an issue](https://github.com/y2kbeatzz-dot/y2kbeatzz-dot/issues/new?title=Crystal%20Lyrics%3A%20) with **Crystal Lyrics** in the title. Include the browser and extension version, the timing label, and steps to reproduce the problem. Do not post private information in public issues.

## Validation

The public launch preserves the original v1.4 ZIP byte for byte. JavaScript syntax, manifest references, website local links and archive checksums were checked. Live browser visual testing and end-to-end YouTube playback testing were unavailable during this publishing run.

## License and credits

Extension code: MIT, copyright 2026 CrystalLyrics. The complete license is in `extension/LICENSE.txt` and the release ZIP. Bundled libraries and fonts retain their respective licenses and notices. Lyrics, artwork and videos belong to their respective owners. This project is independent of YouTube, Google, Microsoft and iBaila.
