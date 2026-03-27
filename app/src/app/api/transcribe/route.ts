import OpenAI from "openai";
import { NextRequest } from "next/server";
import { writeFile, mkdir, readFile, rm } from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { existsSync } from "fs";
import type { TranscriptionSegment } from "openai/resources/audio/transcriptions";
import { isValidApiKey } from "@/lib/validate-api-key";

const execFileAsync = promisify(execFile);
const WHISPER_MAX_SIZE = 24 * 1024 * 1024;
const MAX_UPLOAD_SIZE = 250 * 1024 * 1024;
const CHUNK_DURATION_SECONDS = 600;
const MAX_CHUNKS = 150; // ~25 hours of audio
const OPENAI_TIMEOUT_MS = 270_000; // 4.5 min — well under maxDuration of 5 min

// ── In-memory rate limiter (per IP, resets on deploy) ──
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 5; // max requests per window per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}, 300_000);

const ALLOWED_EXTENSIONS = new Set(["mp3", "mp4", "wav", "webm", "ogg", "flac", "m4a", "wmv"]);
const ALLOWED_MIME_PREFIXES = ["audio/", "video/"];

export const maxDuration = 300;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("OpenAI request timed out")), ms)
    ),
  ]);
}

function sanitizeError(err: unknown): string {
  if (err instanceof OpenAI.APIError) {
    if (err.status === 401) return "Invalid API key. Please check your OpenAI API key.";
    if (err.status === 429) return "Rate limit exceeded. Please wait and try again.";
    if (err.status === 413) return "File too large for Whisper API.";
    return "OpenAI API error. Please try again.";
  }
  if (err instanceof Error) {
    if (err.message.includes("ENOENT") || err.message.includes("ffmpeg") || err.message.includes("ffprobe")) {
      return "Audio processing failed. Ensure ffmpeg is installed.";
    }
  }
  return "Transcription failed. Please try again.";
}

function getExtension(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "";
  return ALLOWED_EXTENSIONS.has(ext) ? ext : "mp3";
}

function isAllowedFile(file: File): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (ALLOWED_EXTENSIONS.has(ext)) return true;
  return ALLOWED_MIME_PREFIXES.some((prefix) => file.type.startsWith(prefix));
}

function mapSegments(
  segments: Array<TranscriptionSegment> | undefined,
  offsetSeconds = 0
) {
  return (segments ?? []).map((segment) => ({
    id: segment.id,
    start: segment.start + offsetSeconds,
    end: segment.end + offsetSeconds,
    text: segment.text.trim(),
  }));
}

export async function POST(request: NextRequest) {
  // CSRF: reject cross-origin requests (browser always sends Origin on cross-origin POST)
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
    } catch {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Use platform-provided IP (Vercel sets request.ip from actual connection),
  // falling back to proxy headers. Rate limiting is best-effort; primary
  // protection is the API key requirement.
  const ip = request.ip
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";

  if (isRateLimited(ip)) {
    return Response.json(
      { error: "Too many requests. Please wait a minute before trying again." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const workDir = join(tmpdir(), `echoes-${randomUUID()}`);

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return Response.json({ error: "No file provided." }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_SIZE) {
      return Response.json({ error: "File too large. Maximum size is 250MB." }, { status: 413 });
    }

    if (!isAllowedFile(file)) {
      return Response.json({ error: "Unsupported file format." }, { status: 400 });
    }

    const apiKey = (formData.get("apiKey") as string | null)?.trim();
    if (!apiKey) {
      return Response.json({ error: "No API key provided." }, { status: 400 });
    }

    if (!isValidApiKey(apiKey)) {
      return Response.json({ error: "Invalid API key format. Keys start with sk- followed by at least 20 characters." }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey });

    if (file.size <= WHISPER_MAX_SIZE) {
      const stream = new ReadableStream({
        async start(controller) {
          const send = (data: Record<string, unknown>) => {
            controller.enqueue(
              new TextEncoder().encode(JSON.stringify(data) + "\n")
            );
          };

          try {
            send({ type: "status", message: "Sending to Whisper API...", progress: 20 });

            const transcription = await withTimeout(
              openai.audio.transcriptions.create({
                file: file,
                model: "whisper-1",
                response_format: "verbose_json",
              }),
              OPENAI_TIMEOUT_MS
            );

            send({ type: "status", message: "Processing complete", progress: 100 });
            send({ type: "partial_text", text: transcription.text, chunk: 0 });
            send({
              type: "result",
              text: transcription.text,
              language: transcription.language,
              duration: transcription.duration,
              segments: mapSegments(transcription.segments),
            });
          } catch (err) {
            send({ type: "error", error: sanitizeError(err) });
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "application/x-ndjson",
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "no-store",
        },
      });
    }

    // Large files: split with ffmpeg
    await mkdir(workDir, { recursive: true });
    const ext = getExtension(file.name);
    const inputPath = join(workDir, `input.${ext}`);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(inputPath, buffer);

    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: Record<string, unknown>) => {
          controller.enqueue(
            new TextEncoder().encode(JSON.stringify(data) + "\n")
          );
        };

        try {
          send({ type: "status", message: "Analyzing audio file...", progress: 5 });

          const { stdout: probeOut } = await execFileAsync("ffprobe", [
            "-v", "quiet",
            "-show_entries", "format=duration",
            "-of", "csv=p=0",
            inputPath,
          ]);
          const totalDuration = parseFloat(probeOut.trim());

          if (isNaN(totalDuration) || totalDuration <= 0) {
            send({ type: "error", error: "Could not determine audio duration. The file may be corrupted." });
            controller.close();
            return;
          }

          const numChunks = Math.ceil(totalDuration / CHUNK_DURATION_SECONDS);

          if (numChunks > MAX_CHUNKS) {
            send({ type: "error", error: "Audio file exceeds maximum supported duration." });
            controller.close();
            return;
          }

          send({
            type: "status",
            message: `Splitting into ${numChunks} segments...`,
            progress: 8,
          });

          const chunkPattern = join(workDir, `chunk-%03d.mp3`);
          await execFileAsync("ffmpeg", [
            "-i", inputPath,
            "-f", "segment",
            "-segment_time", String(CHUNK_DURATION_SECONDS),
            "-c:a", "libmp3lame",
            "-q:a", "4",
            "-y",
            chunkPattern,
          ]);

          const chunkFiles: string[] = [];
          for (let i = 0; i < numChunks + 1; i++) {
            const chunkPath = join(workDir, `chunk-${String(i).padStart(3, "0")}.mp3`);
            if (existsSync(chunkPath)) {
              chunkFiles.push(chunkPath);
            }
          }

          const totalChunks = chunkFiles.length;
          send({
            type: "status",
            message: `Processing ${totalChunks} segments with Whisper...`,
            progress: 10,
          });

          let fullText = "";
          let combinedDuration = 0;
          let language: string | undefined;
          const fullSegments: ReturnType<typeof mapSegments> = [];

          for (let i = 0; i < totalChunks; i++) {
            const chunkProgress = Math.round(10 + ((i / totalChunks) * 85));
            send({
              type: "status",
              message: `Transcribing segment ${i + 1} of ${totalChunks}...`,
              progress: chunkProgress,
            });

            const chunkBuffer = await readFile(chunkFiles[i]);
            const chunkFile = new File([chunkBuffer], `chunk-${i}.mp3`, {
              type: "audio/mpeg",
            });

            const transcription = await withTimeout(
              openai.audio.transcriptions.create({
                file: chunkFile,
                model: "whisper-1",
                response_format: "verbose_json",
              }),
              OPENAI_TIMEOUT_MS
            );

            const offset = combinedDuration;
            fullText += (fullText ? " " : "") + transcription.text;
            fullSegments.push(...mapSegments(transcription.segments, offset));
            combinedDuration += transcription.duration ?? 0;
            if (!language && transcription.language) {
              language = transcription.language;
            }

            send({
              type: "partial_text",
              text: transcription.text,
              chunk: i,
            });

            send({
              type: "status",
              message: `Segment ${i + 1} of ${totalChunks} complete`,
              progress: Math.round(10 + (((i + 1) / totalChunks) * 85)),
            });
          }

          send({ type: "status", message: "Finalizing transcript...", progress: 98 });
          send({
            type: "result",
            text: fullText,
            language,
            duration: combinedDuration,
            segments: fullSegments,
          });
        } catch (err) {
          send({ type: "error", error: sanitizeError(err) });
        } finally {
          try {
            await rm(workDir, { recursive: true, force: true });
          } catch {
            // ignore
          }
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    try {
      await rm(workDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
    return Response.json({ error: "Transcription failed. Please try again." }, { status: 500 });
  }
}
