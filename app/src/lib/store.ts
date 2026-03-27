"use client";

import { Transcript } from "./types";

const STORAGE_KEY = "echoes-transcripts";
const LEGACY_KEY = "vox-transcripts";

export function getTranscripts(): Transcript[] {
  if (typeof window === "undefined") return [];
  let raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    raw = localStorage.getItem(LEGACY_KEY);
    if (raw) {
      localStorage.setItem(STORAGE_KEY, raw);
      localStorage.removeItem(LEGACY_KEY);
    }
  }
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveTranscript(transcript: Transcript): void {
  const existing = getTranscripts();
  existing.unshift(transcript);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
}

export function deleteTranscript(id: string): void {
  const existing = getTranscripts();
  const filtered = existing.filter((t) => t.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
