# Vox

Vox is a polished Next.js app for turning audio files into readable transcripts with OpenAI Whisper. It supports direct uploads up to 200MB, streams status updates during transcription, stores transcript history locally in the browser, and presents finished transcripts in a cleaner reading view instead of a raw text dump.

## Highlights

- Upload audio up to 200MB
- OpenAI Whisper transcription through a server route
- Live progress updates while files are processed
- Automatic chunking for large files using `ffmpeg`
- Local transcript history with search and delete
- Copy and download transcript actions
- Premium transcript reading UI built with Next.js, Tailwind CSS, shadcn/ui, and Framer Motion

## Project Structure

The application lives in [`app/`](/Users/shreeghanesh/conductor/workspaces/transcribe-audio/lima/app).

- `app/src/app/page.tsx`: main workspace and app shell
- `app/src/app/api/transcribe/route.ts`: upload handling, Whisper calls, chunking, and streaming progress
- `app/src/components/*`: upload flow, live transcript view, transcript viewer, history sidebar, waveform UI
- `app/src/lib/store.ts`: localStorage persistence helpers

## Requirements

- Node.js 20+
- npm
- `ffmpeg` and `ffprobe` available on your `PATH`
- An OpenAI API key with access to Whisper

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

Open `http://localhost:3456`.

The app asks the user for an OpenAI API key in the UI and stores it in local browser storage. There is no server-side secret management in this repo.

## How Transcription Works

### Files up to 24MB

Smaller files are sent directly to the Whisper transcription API and streamed back to the client with status updates.

### Files over 24MB

Larger files are:

1. Written to a temporary directory on the server
2. Probed with `ffprobe`
3. Split into 10-minute MP3 segments with `ffmpeg`
4. Transcribed segment by segment with Whisper
5. Reassembled into one final transcript

The UI receives progress and partial transcript updates as each segment completes.

## Scripts

From `app/`:

```bash
npm run dev
npm run lint
npm run build
```

## Notes

- Transcript history is stored in browser `localStorage`, not a database.
- API keys are also stored in `localStorage`.
- The app is currently optimized for local development and demo use.
- If port `3456` is already in use, either reuse the existing server or start Next.js on a different port.

## Verification

The current implementation has been verified with:

```bash
cd app
npm run lint
npm run build
```
