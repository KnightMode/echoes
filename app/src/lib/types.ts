export interface Transcript {
  id: string;
  fileName: string;
  fileSize: number;
  duration: number;
  text: string;
  createdAt: string;
  language?: string;
}
