export function isValidApiKey(key: string): boolean {
  return /^sk-[a-zA-Z0-9_-]{20,}$/.test(key.trim());
}
