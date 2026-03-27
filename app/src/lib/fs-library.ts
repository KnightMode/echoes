"use client";

/**
 * Library lives on disk in a user-chosen folder:
 *   library.json   — transcripts + folder metadata
 *   audio/         — original audio files (named by transcript id)
 *
 * A FileSystemDirectoryHandle is stored in IndexedDB only so the browser can
 * restore permission to that folder between visits — not transcript/audio data.
 */

import type { Folder, Transcript } from "./types";

const HANDLE_IDB = "echoes-library-permission";
const HANDLE_STORE = "handles";
const HANDLE_KEY = "library-root";
const LIBRARY_FILE = "library.json";
const AUDIO_DIR = "audio";

export const LIBRARY_VERSION = 1 as const;

export interface LibraryFileData {
  version: typeof LIBRARY_VERSION;
  transcripts: Transcript[];
  folders: Folder[];
}

function openHandleDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(HANDLE_IDB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(HANDLE_STORE)) {
        db.createObjectStore(HANDLE_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

export async function saveLibraryDirectoryHandle(
  handle: FileSystemDirectoryHandle
): Promise<void> {
  const db = await openHandleDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE, "readwrite");
    tx.objectStore(HANDLE_STORE).put(handle, HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getLibraryDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openHandleDb();
  const handle = await new Promise<FileSystemDirectoryHandle | undefined>(
    (resolve, reject) => {
      const tx = db.transaction(HANDLE_STORE, "readonly");
      const r = tx.objectStore(HANDLE_STORE).get(HANDLE_KEY);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    }
  );
  db.close();
  return handle ?? null;
}

export async function clearLibraryDirectoryHandle(): Promise<void> {
  const db = await openHandleDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE, "readwrite");
    tx.objectStore(HANDLE_STORE).delete(HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/** TS lib may not expose permission helpers on directory handles; they exist at runtime. */
type FsPerm = {
  queryPermission?: (d: { mode: "readwrite" }) => Promise<PermissionState>;
  requestPermission?: (d: { mode: "readwrite" }) => Promise<PermissionState>;
};

export async function ensureReadWritePermission(
  handle: FileSystemDirectoryHandle
): Promise<boolean> {
  const h = handle as FileSystemDirectoryHandle & FsPerm;
  const opts = { mode: "readwrite" as const };
  if (!h.queryPermission || !h.requestPermission) return true;
  let perm = await h.queryPermission(opts);
  if (perm === "granted") return true;
  perm = await h.requestPermission(opts);
  return perm === "granted";
}

export async function pickLibraryDirectory(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const picker = (
      window as unknown as {
        showDirectoryPicker?: (o?: { mode: string }) => Promise<FileSystemDirectoryHandle>;
      }
    ).showDirectoryPicker;
    if (!picker) return null;
    const handle = await picker.call(window, { mode: "readwrite" });
    const ok = await ensureReadWritePermission(handle);
    if (!ok) return null;
    await saveLibraryDirectoryHandle(handle);
    return handle;
  } catch {
    return null;
  }
}

export async function restoreLibraryDirectory(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const handle = await getLibraryDirectoryHandle();
    if (!handle) return null;
    // Only query (never request) permission here — requestPermission requires a
    // user gesture and will hang or throw when called on page load.
    const h = handle as FileSystemDirectoryHandle & FsPerm;
    if (!h.queryPermission) return handle;
    const perm = await h.queryPermission({ mode: "readwrite" });
    if (perm === "granted") return handle;
    // 'denied' — clear the stale handle; 'prompt' — user must reconnect via button
    if (perm === "denied") await clearLibraryDirectoryHandle();
    return null;
  } catch {
    return null;
  }
}

export function audioFileName(id: string, originalFileName: string): string {
  const ext = /\.[a-zA-Z0-9]+$/.test(originalFileName)
    ? originalFileName.slice(originalFileName.lastIndexOf("."))
    : "";
  return `${id}${ext}`;
}

async function getAudioDir(root: FileSystemDirectoryHandle) {
  return root.getDirectoryHandle(AUDIO_DIR, { create: true });
}

export async function readLibraryData(
  root: FileSystemDirectoryHandle
): Promise<LibraryFileData> {
  try {
    const fh = await root.getFileHandle(LIBRARY_FILE);
    const file = await fh.getFile();
    const text = await file.text();
    if (!text.trim()) {
      return { version: LIBRARY_VERSION, transcripts: [], folders: [] };
    }
    const parsed = JSON.parse(text) as Partial<LibraryFileData>;
    return {
      version: LIBRARY_VERSION,
      transcripts: Array.isArray(parsed.transcripts) ? parsed.transcripts : [],
      folders: Array.isArray(parsed.folders) ? parsed.folders : [],
    };
  } catch {
    return { version: LIBRARY_VERSION, transcripts: [], folders: [] };
  }
}

export async function writeLibraryData(
  root: FileSystemDirectoryHandle,
  data: LibraryFileData
): Promise<void> {
  const fh = await root.getFileHandle(LIBRARY_FILE, { create: true });
  const writable = await fh.createWritable();
  const body = JSON.stringify(
    { ...data, version: LIBRARY_VERSION },
    null,
    2
  );
  await writable.write(new Blob([body], { type: "application/json" }));
  await writable.close();
}

export async function writeAudioToLibrary(
  root: FileSystemDirectoryHandle,
  id: string,
  file: File
): Promise<void> {
  const dir = await getAudioDir(root);
  const name = audioFileName(id, file.name);
  const fh = await dir.getFileHandle(name, { create: true });
  const writable = await fh.createWritable();
  await writable.write(await file.arrayBuffer());
  await writable.close();
}

export async function readAudioFromLibrary(
  root: FileSystemDirectoryHandle,
  transcript: Transcript
): Promise<File | null> {
  try {
    const dir = await getAudioDir(root);
    const name = audioFileName(transcript.id, transcript.fileName);
    const fh = await dir.getFileHandle(name);
    return fh.getFile();
  } catch {
    return null;
  }
}

export async function deleteAudioFromLibrary(
  root: FileSystemDirectoryHandle,
  transcript: Transcript
): Promise<void> {
  try {
    const dir = await getAudioDir(root);
    const name = audioFileName(transcript.id, transcript.fileName);
    await dir.removeEntry(name);
  } catch {
    // already gone
  }
}
