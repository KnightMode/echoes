export function isValidApiKey(key: string): boolean {
  // OpenAI keys: legacy sk-<48 chars> or project keys sk-proj-<...>
  return /^sk-[a-zA-Z0-9_-]{48,}$/.test(key.trim());
}
