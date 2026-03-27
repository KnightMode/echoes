"use client";

/**
 * One-time migration from localStorage + IndexedDB audio into the on-disk library.
 */

import { getAudioFile } from "./audio-store";
import type { Folder, Transcript } from "./types";
import {
  readLibraryData,
  writeAudioToLibrary,
  writeLibraryData,
  type LibraryFileData,
} from "./fs-library";

const LEGACY_TRANSCRIPTS_KEYS = ["echoes-transcripts", "vox-transcripts"] as const;
const LEGACY_FOLDERS_KEY = "echoes-folders";

function readLegacyTranscripts(): Transcript[] {
  if (typeof window === "undefined") return [];
  for (const key of LEGACY_TRANSCRIPTS_KEYS) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as Transcript[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function readLegacyFolders(): Folder[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(LEGACY_FOLDERS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Folder[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function clearLegacyBrowserStorage(): void {
  for (const key of LEGACY_TRANSCRIPTS_KEYS) {
    localStorage.removeItem(key);
  }
  localStorage.removeItem(LEGACY_FOLDERS_KEY);
}

function deleteLegacyAudioDb(): void {
  indexedDB.deleteDatabase("echoes-audio");
  indexedDB.deleteDatabase("vox-audio");
}

export async function migrateLegacyToDiskIfNeeded(
  root: FileSystemDirectoryHandle
): Promise<boolean> {
  const existing = await readLibraryData(root);
  const hasDiskData =
    existing.transcripts.length > 0 ||
    existing.folders.length > 0;
  if (hasDiskData) return false;

  const transcripts = readLegacyTranscripts();
  const folders = readLegacyFolders();
  if (transcripts.length === 0 && folders.length === 0) return false;

  const data: LibraryFileData = {
    version: 1,
    transcripts: [...transcripts],
    folders: [...folders],
  };

  for (const t of transcripts) {
    const blob = await getAudioFile(t.id);
    if (blob) {
      await writeAudioToLibrary(root, t.id, blob);
    }
  }

  await writeLibraryData(root, data);
  clearLegacyBrowserStorage();
  deleteLegacyAudioDb();
  return true;
}
