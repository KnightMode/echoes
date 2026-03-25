export interface TranscriptSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

export interface Transcript {
  id: string;
  fileName: string;
  fileSize: number;
  duration: number;
  text: string;
  createdAt: string;
  language?: string;
  segments?: TranscriptSegment[];
}
