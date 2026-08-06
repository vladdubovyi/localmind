/**
 * Best-effort repairs for common local-model JSON typos in tool calls.
 * Seen in the wild: {"url:"https://..."}  (key quote closed before colon)
 */
export function repairToolJson(raw: string): string {
  let s = raw.trim();

  // "key:"value" → "key":"value"
  s = s.replace(/"([A-Za-z0-9_]+):"([^"]*)"/g, '"$1":"$2"');

  // "key:"123 → "key":123 / "key:"true → "key":true
  s = s.replace(/"([A-Za-z0-9_]+):"(true|false|null|-?\d+(?:\.\d+)?)/g, '"$1":$2');

  // Trailing commas
  s = s.replace(/,\s*([}\]])/g, '$1');

  // Single-quoted keys/strings (very rough)
  if ((s.match(/'/g) ?? []).length >= 2 && !/"name"\s*:/.test(s)) {
    s = s.replace(/'([A-Za-z0-9_]+)'\s*:/g, '"$1":').replace(/:\s*'([^']*)'/g, ':"$1"');
  }

  return s;
}

export function parseJsonLenient(raw: string): unknown {
  const attempts = [raw.trim(), repairToolJson(raw)];
  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt);
    } catch (e) {
      lastError = e;
    }
  }
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(repairToolJson(raw.slice(start, end + 1)));
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Invalid JSON');
}
