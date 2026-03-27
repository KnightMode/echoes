export interface TranscriptSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

export interface Folder {
  id: string;
  name: string;
  createdAt: string;
}

export interface Transcript {
  id: string;
  fileName: string;
  fileSize: number;
  duration: number;
  text: string;
  createdAt: string;
  /** Omit or null = Library root (uncategorized). */
  folderId?: string | null;
  language?: string;
  segments?: TranscriptSegment[];
}
