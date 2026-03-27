"use client";

const DB_NAME = "echoes-audio";
const LEGACY_DB_NAME = "vox-audio";
const STORE_NAME = "files";
const DB_VERSION = 1;

function openDbByName(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function openDb(): Promise<IDBDatabase> {
  return openDbByName(DB_NAME);
}

export async function saveAudioFile(id: string, file: File): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(file, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getAudioFile(id: string): Promise<File | null> {
  const db = await openDb();
  const result = await new Promise<File | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve((request.result as File | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  if (result) return result;

  // Fallback: check legacy database
  try {
    const legacyDb = await openDbByName(LEGACY_DB_NAME);
    const legacyResult = await new Promise<File | null>((resolve, reject) => {
      const tx = legacyDb.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).get(id);
      request.onsuccess = () => resolve((request.result as File | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
    legacyDb.close();
    return legacyResult;
  } catch {
    return null;
  }
}

export async function deleteAudioFile(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
