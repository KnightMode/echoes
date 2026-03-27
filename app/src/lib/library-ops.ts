"use client";

import type { Folder, Transcript } from "./types";
import { ECHOES_STORAGE_EVENT } from "./store";
import {
  deleteAudioFromLibrary,
  readLibraryData,
  writeAudioToLibrary,
  writeLibraryData,
} from "./fs-library";

function notifyLibraryChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ECHOES_STORAGE_EVENT));
}

export async function addTranscript(
  root: FileSystemDirectoryHandle,
  transcript: Transcript,
  audioFile: File
): Promise<void> {
  await writeAudioToLibrary(root, transcript.id, audioFile);
  const data = await readLibraryData(root);
  data.transcripts.unshift(transcript);
  await writeLibraryData(root, data);
  notifyLibraryChanged();
}

export async function removeTranscript(
  root: FileSystemDirectoryHandle,
  transcript: Transcript
): Promise<void> {
  await deleteAudioFromLibrary(root, transcript);
  const data = await readLibraryData(root);
  data.transcripts = data.transcripts.filter((t) => t.id !== transcript.id);
  await writeLibraryData(root, data);
  notifyLibraryChanged();
}

export async function removeTranscriptsBulk(
  root: FileSystemDirectoryHandle,
  transcripts: Transcript[]
): Promise<void> {
  if (transcripts.length === 0) return;
  const idSet = new Set(transcripts.map((t) => t.id));
  await Promise.all(
    transcripts.map((t) => deleteAudioFromLibrary(root, t))
  );
  const data = await readLibraryData(root);
  data.transcripts = data.transcripts.filter((t) => !idSet.has(t.id));
  await writeLibraryData(root, data);
  notifyLibraryChanged();
}

export async function setFolderForTranscripts(
  root: FileSystemDirectoryHandle,
  ids: string[],
  folderId: string | null
): Promise<void> {
  if (ids.length === 0) return;
  const idSet = new Set(ids);
  const data = await readLibraryData(root);
  data.transcripts = data.transcripts.map((t) =>
    idSet.has(t.id)
      ? { ...t, folderId: folderId === null ? null : folderId }
      : t
  );
  await writeLibraryData(root, data);
  notifyLibraryChanged();
}

export async function patchTranscript(
  root: FileSystemDirectoryHandle,
  id: string,
  patch: Partial<Transcript>
): Promise<void> {
  const data = await readLibraryData(root);
  data.transcripts = data.transcripts.map((t) =>
    t.id === id ? { ...t, ...patch } : t
  );
  await writeLibraryData(root, data);
  notifyLibraryChanged();
}

export async function removeFolderAndUnassign(
  root: FileSystemDirectoryHandle,
  folderId: string
): Promise<void> {
  const data = await readLibraryData(root);
  data.folders = data.folders.filter((f) => f.id !== folderId);
  data.transcripts = data.transcripts.map((t) =>
    t.folderId === folderId ? { ...t, folderId: null } : t
  );
  await writeLibraryData(root, data);
  notifyLibraryChanged();
}

export async function saveFoldersOnly(
  root: FileSystemDirectoryHandle,
  folders: Folder[]
): Promise<void> {
  const data = await readLibraryData(root);
  data.folders = folders;
  await writeLibraryData(root, data);
  notifyLibraryChanged();
}

export async function createFolderEntry(
  root: FileSystemDirectoryHandle,
  folder: Folder
): Promise<void> {
  const data = await readLibraryData(root);
  data.folders.unshift(folder);
  await writeLibraryData(root, data);
  notifyLibraryChanged();
}
