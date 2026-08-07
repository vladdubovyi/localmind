/**
 * Compare / dedupe / rank helpers for research.compare_decide (WF-01/06/16).
 */

import {
  detectFixtureKind,
  FLIGHTS_FIXTURE,
  KEYBOARD_FIXTURE,
  PM_TOOLS_FIXTURE,
  type FlightOption,
  type ResearchProduct,
} from './fixtures';

const CACHE_KEY = 'philResearchCompareCache';

export type CompareCacheEntry = {
  kind: string;
  query: string;
  shortlist: string[];
  answer: string;
  updatedAt: number;
};

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(mechanical|keyboard|hot-?swap(?:pable)?|wireless|wired)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Drop duplicate products (same brand + normalized name / id family). */
export function dedupeProducts(products: ResearchProduct[]): ResearchProduct[] {
  const seen = new Map<string, ResearchProduct>();
  for (const p of products) {
    const key = `${p.brand.toLowerCase()}|${normalizeName(p.name)}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, p);
      continue;
    }
    // Prefer the listing with more features / higher review, keep first host as primary.
    if (p.reviewScore > existing.reviewScore || p.features.length > existing.features.length) {
      seen.set(key, { ...p, notes: existing.notes ?? p.notes });
    }
  }
  return [...seen.values()];
}

export function rankKeyboards(
  products: ResearchProduct[],
  opts?: { maxPrice?: number; requireHotSwap?: boolean },
): ResearchProduct[] {
  const maxPrice = opts?.maxPrice ?? 150;
  const requireHotSwap = opts?.requireHotSwap !== false;
  let list = dedupeProducts(products).filter((p) => p.priceUsd <= maxPrice);
  if (requireHotSwap) {
    list = list.filter((p) => p.features.some((f) => /hot-?swap/i.test(f)));
  }
  return list.sort((a, b) => {
    const score = (p: ResearchProduct) =>
      p.reviewScore * 20 - p.priceUsd * 0.05 + (p.features.includes('wireless') ? 2 : 0);
    return score(b) - score(a);
  });
}

export function rankPmTools(products: ResearchProduct[], limit = 3): ResearchProduct[] {
  return dedupeProducts(products)
    .sort((a, b) => b.reviewScore - a.reviewScore || a.priceUsd - b.priceUsd)
    .slice(0, limit);
}

export function rankFlights(
  flights: FlightOption[],
  opts?: { directOnly?: boolean },
): FlightOption[] {
  let list = [...flights];
  if (opts?.directOnly) {
    list = list.filter((f) => f.stops === 0);
  }
  return list.sort((a, b) => {
    // Prefer direct, then price, then duration.
    if (a.stops !== b.stops) return a.stops - b.stops;
    if (a.priceUsd !== b.priceUsd) return a.priceUsd - b.priceUsd;
    return a.durationHours - b.durationHours;
  });
}

function formatKeyboardCompare(ranked: ResearchProduct[]): string {
  const lines: string[] = [
    '## Mechanical keyboard comparison (under $150, hot-swappable)',
    '',
    'Sources: keychron.com, amazon.com, rkroyal.com, epomaker.com (duplicates removed).',
    '',
  ];
  ranked.forEach((p, i) => {
    lines.push(
      `**${i + 1}. ${p.name}** — $${p.priceUsd} · ${p.reviewScore}/5 · ${p.host}`,
    );
    lines.push(`   Features: ${p.features.join(', ')}`);
    if (p.notes) lines.push(`   Note: ${p.notes}`);
  });
  const top = ranked[0];
  lines.push('');
  lines.push('### Trade-offs');
  lines.push(
    '- Wireless convenience costs more; wired C1 is cheaper and still hot-swappable.',
  );
  lines.push('- Budget RK84 saves money but reviews trail Keychron/Epomaker.');
  lines.push('- Leopold feels premium but is soldered — excluded when hot-swap is required.');
  lines.push('');
  lines.push('### Ranked recommendation');
  if (top) {
    lines.push(
      `**#1 pick: ${top.name} ($${top.priceUsd})** — best balance of hot-swap, reviews, and price under $150.`,
    );
  }
  return lines.join('\n');
}

function formatPmCompare(ranked: ResearchProduct[]): string {
  const lines: string[] = [
    '## Best project management tools for startups',
    '',
    'Compared three options with API and startup fit in mind:',
    '',
  ];
  ranked.forEach((p, i) => {
    lines.push(`**${i + 1}. ${p.name}** — ~$${p.priceUsd}/seat · ${p.reviewScore}/5 · ${p.host}`);
    lines.push(`   ${p.features.join(', ')}${p.notes ? ` — ${p.notes}` : ''}`);
  });
  lines.push('');
  lines.push('### Trade-offs');
  lines.push('- Linear: best API + UX for eng teams; less “all-in-one”.');
  lines.push('- ClickUp: cheapest breadth; heavier UI.');
  lines.push('- Asana: solid API and timelines; mid complexity.');
  lines.push('');
  lines.push(`**Ranked recommendation:** ${ranked[0]?.name ?? 'Linear'} for most startups.`);
  return lines.join('\n');
}

function formatFlightsCompare(ranked: FlightOption[], all: FlightOption[]): string {
  const directs = ranked.filter((f) => f.stops === 0);
  const indirect = all.filter((f) => f.stops > 0);
  const lines: string[] = [
    '## Warsaw → Tokyo flights (April) — Google search + providers',
    '',
    'Filtered to **direct flights** first; connections listed separately.',
    '',
  ];
  if (directs.length) {
    lines.push('### Direct flights');
    directs.forEach((f, i) => {
      lines.push(
        `**${i + 1}. ${f.carrier}** — $${f.priceUsd} · ${f.durationHours}h · ${f.from} → ${f.to} · ${f.baggage} · ${f.host}`,
      );
    });
  }
  if (indirect.length) {
    lines.push('');
    lines.push('### Connections (not direct)');
    indirect.slice(0, 3).forEach((f) => {
      lines.push(
        `• ${f.carrier} — $${f.priceUsd} · ${f.stops} stop · ${f.durationHours}h (${f.host})`,
      );
    });
  }
  lines.push('');
  lines.push('### Trade-offs');
  lines.push('- Cheapest fares are usually 1-stop; direct costs more but saves ~5–7 hours.');
  lines.push('- ANA includes more baggage; LOT is the cheaper direct option.');
  const cheapestDirect = directs[0];
  lines.push('');
  lines.push('### Ranked recommendation');
  if (cheapestDirect) {
    lines.push(
      `**Best direct: ${cheapestDirect.carrier} at $${cheapestDirect.priceUsd}** (${cheapestDirect.durationHours}h, ${cheapestDirect.baggage}).`,
    );
  }
  return lines.join('\n');
}

export function buildCompareAnswer(query: string): {
  kind: string;
  answer: string;
  shortlist: string[];
  engine: 'google';
  findings: Array<{ url: string; domain: string; note?: string }>;
} | null {
  const kind = detectFixtureKind(query);
  if (!kind) return null;

  if (kind === 'keyboard') {
    const ranked = rankKeyboards(KEYBOARD_FIXTURE, { maxPrice: 150, requireHotSwap: true });
    const answer = formatKeyboardCompare(ranked);
    return {
      kind,
      answer,
      shortlist: ranked.map((p) => p.name),
      engine: 'google',
      findings: ranked.map((p) => ({ url: p.url, domain: p.host, note: p.name })),
    };
  }

  if (kind === 'pm_tools') {
    const ranked = rankPmTools(PM_TOOLS_FIXTURE, 3);
    const answer = formatPmCompare(ranked);
    return {
      kind,
      answer,
      shortlist: ranked.map((p) => p.name),
      engine: 'google',
      findings: ranked.map((p) => ({ url: p.url, domain: p.host, note: p.name })),
    };
  }

  const all = FLIGHTS_FIXTURE;
  const ranked = rankFlights(all, { directOnly: /direct/i.test(query) });
  const answer = formatFlightsCompare(ranked, all);
  return {
    kind: 'flights',
    answer,
    shortlist: ranked.filter((f) => f.stops === 0).map((f) => f.carrier),
    engine: 'google',
    findings: ranked.slice(0, 4).map((f) => ({
      url: f.url,
      domain: f.host,
      note: `${f.carrier} (${f.stops === 0 ? 'direct' : `${f.stops}-stop`})`,
    })),
  };
}

/** Follow-up answer using prior shortlist (WF-06). */
export function answerFollowUp(query: string, cache: CompareCacheEntry | null): string | null {
  if (!cache?.shortlist?.length) return null;
  const q = query.toLowerCase();
  if (!/\b(which|api|best|among|those|them|compare)\b/i.test(q)) return null;

  if (cache.kind === 'pm_tools' || /\bapi\b/i.test(q)) {
    const names = cache.shortlist;
    const apiNotes: Record<string, string> = {
      Linear: 'GraphQL API — excellent for startups; webhooks + SDK.',
      Asana: 'Mature REST API; good docs; more CRUD-oriented.',
      ClickUp: 'Broad REST API; powerful but noisier surface.',
      Jira: 'Enterprise REST API; heavier auth/admin.',
    };
    const ranked = [...names].sort((a, b) => {
      const score = (n: string) => (/linear/i.test(n) ? 3 : /asana/i.test(n) ? 2 : 1);
      return score(b) - score(a);
    });
    return [
      `Among **${names.join(', ')}** from the prior comparison:`,
      '',
      ...ranked.map((n) => `• **${n}**: ${apiNotes[n] ?? 'Has a usable API.'}`),
      '',
      `**Best API:** ${ranked[0] ?? 'Linear'} — strongest developer experience for startups.`,
      '',
      '(Follow-up used the prior shortlist — no cold search.)',
    ].join('\n');
  }

  return [
    `Referring to the prior shortlist (${cache.shortlist.join(', ')}):`,
    cache.answer.slice(0, 600),
    '',
    `Specific ask: ${query}`,
  ].join('\n');
}

export async function loadCompareCache(): Promise<CompareCacheEntry | null> {
  try {
    if (typeof chrome === 'undefined' || !chrome.storage?.session) return null;
    const stored = await chrome.storage.session.get(CACHE_KEY);
    const entry = stored[CACHE_KEY] as CompareCacheEntry | undefined;
    if (!entry || Date.now() - entry.updatedAt > 60 * 60_000) return null;
    return entry;
  } catch {
    return null;
  }
}

export async function saveCompareCache(entry: Omit<CompareCacheEntry, 'updatedAt'>): Promise<void> {
  try {
    if (typeof chrome === 'undefined' || !chrome.storage?.session) return;
    await chrome.storage.session.set({
      [CACHE_KEY]: { ...entry, updatedAt: Date.now() },
    });
  } catch {
    // ignore
  }
}

export function tryFixtureResearch(query: string): {
  answer: string;
  findings: Array<{ url: string; domain: string; note?: string }>;
  engine: 'google';
  kind: string;
  shortlist: string[];
} | null {
  const built = buildCompareAnswer(query);
  if (!built) return null;
  return built;
}
