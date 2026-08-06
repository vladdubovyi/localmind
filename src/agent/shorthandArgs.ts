/**
 * Parse loose arg bodies from small-model shorthand:
 *   gmail_list {query:"newer_than:14d", maxResults:5}
 *   tabs_navigate {url:"mail.google.com"}
 */
export function parseShorthandArgBody(body: string): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  const cleaned = body.trim().replace(/^\{|}$/g, '').trim();
  if (!cleaned) return args;

  // Split on commas not inside quotes
  const parts: string[] = [];
  let cur = '';
  let inStr: '"' | "'" | null = null;
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inStr) {
      cur += ch;
      if (ch === inStr && cleaned[i - 1] !== '\\') inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inStr = ch;
      cur += ch;
      continue;
    }
    if (ch === ',') {
      parts.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());

  for (const part of parts) {
    const m = part.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let raw = m[2].trim();
    if (
      (raw.startsWith('"') && raw.endsWith('"')) ||
      (raw.startsWith("'") && raw.endsWith("'"))
    ) {
      args[key] = raw.slice(1, -1);
      continue;
    }
    if (/^(true|false)$/i.test(raw)) {
      args[key] = raw.toLowerCase() === 'true';
      continue;
    }
    if (/^-?\d+(\.\d+)?$/.test(raw)) {
      args[key] = Number(raw);
      continue;
    }
    if (raw === 'null') {
      args[key] = null;
      continue;
    }
    args[key] = raw;
  }

  return args;
}

export function normalizeToolArgs(
  name: string,
  args: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...args };
  if (typeof next.url === 'string') {
    const url = next.url.trim();
    if (url && !/^https?:\/\//i.test(url)) {
      next.url = `https://${url.replace(/^\/+/, '')}`;
    }
  }
  if (name === 'gmail_list' && next.maxResults != null) {
    next.maxResults = Number(next.maxResults);
  }
  if (next.tabId != null) {
    next.tabId = Number(next.tabId);
  }
  return next;
}
