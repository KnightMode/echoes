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

const execFileAsync = promisify(execFile);
const WHISPER_MAX_SIZE = 24 * 1024 * 1024;
const CHUNK_DURATION_SECONDS = 600;

export const maxDuration = 300;

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
  const workDir = join(tmpdir(), `echoes-${randomUUID()}`);

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    const apiKey = formData.get("apiKey") as string | null;
    if (!apiKey) {
      return Response.json({ error: "No API key provided" }, { status: 400 });
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

            const transcription = await openai.audio.transcriptions.create({
              file: file,
              model: "whisper-1",
              response_format: "verbose_json",
            });

            send({ type: "status", message: "Processing complete", progress: 100 });
            // Send partial_text same as result for small files
            send({ type: "partial_text", text: transcription.text, chunk: 0 });
            send({
              type: "result",
              text: transcription.text,
              language: transcription.language,
              duration: transcription.duration,
              segments: mapSegments(transcription.segments),
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : "Transcription failed";
            send({ type: "error", error: message });
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: { "Content-Type": "application/x-ndjson" },
      });
    }

    // Large files: split with ffmpeg
    await mkdir(workDir, { recursive: true });
    const ext = file.name.split(".").pop() || "mp3";
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
          const numChunks = Math.ceil(totalDuration / CHUNK_DURATION_SECONDS);

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

            const transcription = await openai.audio.transcriptions.create({
              file: chunkFile,
              model: "whisper-1",
              response_format: "verbose_json",
            });

            const offset = combinedDuration;
            fullText += (fullText ? " " : "") + transcription.text;
            fullSegments.push(...mapSegments(transcription.segments, offset));
            combinedDuration += transcription.duration ?? 0;
            if (!language && transcription.language) {
              language = transcription.language;
            }

            // Stream partial text as each chunk completes
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
          const message = err instanceof Error ? err.message : "Transcription failed";
          send({ type: "error", error: message });
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
      headers: { "Content-Type": "application/x-ndjson" },
    });
  } catch (error: unknown) {
    try {
      await rm(workDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
    const message =
      error instanceof Error ? error.message : "Transcription failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
