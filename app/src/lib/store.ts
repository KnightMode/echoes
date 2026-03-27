"use client";

import { Folder } from "./types";

/** Fired after on-disk library data changes (same tab + other tabs via storage event for API key etc.). */
export const ECHOES_STORAGE_EVENT = "echoes-storage";

export function folderLabel(
  folderId: string | null | undefined,
  folders: Folder[]
): string {
  if (folderId == null) return "Root";
  return folders.find((f) => f.id === folderId)?.name ?? "Folder";
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
