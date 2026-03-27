# Echoes

Echoes is a polished Next.js audio transcription app powered by OpenAI Whisper. Upload any recording, watch it transcribe in real time, and read the result in a clean, immersive interface with synced audio playback.

## Features

### Transcription

- **Drag-and-drop upload** — drop an audio file or click to browse. Supports MP3, WAV, M4A, FLAC, OGG, WebM, and WMV up to 250 MB.
- **Real-time streaming** — progress updates and partial transcript text stream to the UI as Whisper processes each segment.
- **Automatic chunking** — files over 24 MB are split into 10-minute MP3 segments with `ffmpeg`, transcribed in parallel, and reassembled into one transcript with correct timestamps.
- **Background transcription** — start a transcription, then freely navigate to other screens. The process continues in the background with a persistent indicator bar showing filename, progress, and a button to jump back to the live view.

### Reading & Playback

- **Custom audio player** — a built-in player with play/pause, skip forward/back, scrub bar, playback speed control (0.75x–2x), and mute toggle. Sticks below the header so it stays accessible while scrolling.
- **Synced transcript blocks** — timed segments highlight as audio plays. Click any block to jump to that moment in the recording.
- **Serif reading typography** — transcript content renders in Crimson Pro for comfortable long-form reading, distinct from the interface font.
- **Copy & export** — copy the full transcript to clipboard, or download as plain text or Markdown.

### Library & History

- **Local persistence** — transcripts are saved to `localStorage` and audio files to IndexedDB. Everything stays in the browser with no server-side storage.
- **Library drawer** — a slide-over panel lists all saved transcripts with search by filename or content. Accessible from any screen.
- **Delete management** — remove individual transcripts and their associated audio files.

### UI & UX

- **Centered single-column layout** — focused, distraction-free interface with clear visual hierarchy.
- **Scroll-to-top button** — a floating button appears after scrolling, available on every view.
- **Animated transitions** — smooth page transitions, staggered entry animations, and progress indicators built with Framer Motion.
- **Dark theme** — deep blue-black backgrounds with warm apricot accents. Manrope for interface, IBM Plex Mono for timestamps and data.
- **API key management** — enter your OpenAI key once in the UI. It's stored in `localStorage` and masked after entry.

## Project Structure

The application lives in [`app/`](app/).

- `app/src/app/page.tsx` — main app shell, view routing, background transcription indicator
- `app/src/app/api/transcribe/route.ts` — server route handling uploads, Whisper API calls, chunking, and streaming
- `app/src/lib/use-transcription.ts` — custom hook that owns the fetch/streaming lifecycle, persists across view changes
- `app/src/lib/store.ts` — localStorage helpers for transcripts
- `app/src/lib/audio-store.ts` — IndexedDB helpers for audio file storage
- `app/src/components/upload-zone.tsx` — file selection, drag-and-drop, API key input
- `app/src/components/live-transcript.tsx` — real-time transcription progress and streaming text
- `app/src/components/transcript-viewer.tsx` — reading view with custom audio player and synced segments
- `app/src/components/history-sidebar.tsx` — searchable library drawer
- `app/src/components/scroll-to-top.tsx` — floating scroll-to-top button
- `app/src/components/waveform.tsx` — animated waveform visualization

## Requirements

- Node.js 20+
- npm
- `ffmpeg` and `ffprobe` on your `PATH` (only needed for files over 24 MB)
- An OpenAI API key with Whisper access

On macOS:

```bash
brew install ffmpeg
```

## Getting Started

```bash
cd app
npm install
npm run dev -- -p 3456
```

Open `http://localhost:3456`. Enter your OpenAI API key when prompted.

## How Transcription Works

### Files up to 24 MB

Sent directly to the Whisper API. Status updates and the full result stream back via NDJSON.

### Files over 24 MB

1. Written to a temporary directory on the server
2. Probed with `ffprobe` for duration
3. Split into 10-minute MP3 segments with `ffmpeg`
4. Each segment transcribed with Whisper, streaming partial text as segments complete
5. Reassembled into one transcript with offset-corrected timestamps
6. Temporary files cleaned up

### Background Processing

The transcription fetch runs inside a React hook (`useTranscription`) at the page level. Because the hook lives above the view layer, navigating between home, library, or other transcripts does not interrupt the stream. A sticky indicator bar appears below the header showing real-time progress.

## Scripts

From `app/`:

```bash
npm run dev      # start dev server
npm run build    # production build
npm run lint     # run ESLint
```

## Notes

- All data is stored client-side (localStorage + IndexedDB). There is no database.
- API keys are stored in `localStorage`. This app is designed for local/demo use.
- The server route streams NDJSON events, not WebSockets, for simplicity.
