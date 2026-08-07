import type { ToolCall, ToolResult } from '@/agent/types';
import { categorizeDomain } from '@/phil/categories';
import type { FocusCategory } from '@/phil/types';
import { executePageTools } from '@/background/tools/page';
import { executeTabTools } from '@/background/tools/tabs';
import { getPhilSettings, uid } from '@/storage/phil';

function argString(call: ToolCall, key: string, fallback = ''): string {
  return String(call.arguments[key] ?? fallback);
}

function argNumber(call: ToolCall, key: string): number | undefined {
  const n = Number(call.arguments[key]);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Open a search tab, scrape links, and open finding tabs.
 * Must use static imports — Chrome MV3 disallows import() in service workers.
 */
export async function runWebResearch(call: ToolCall): Promise<ToolResult> {
  const query = argString(call, 'query');
  if (!query.trim()) {
    return { ok: false, error: 'query is required', toolCall: call };
  }

  const settings = await getPhilSettings();
  const locality = argString(call, 'locality', settings.locality);
  const maxResults = Math.min(5, Math.max(1, argNumber(call, 'maxResults') ?? 3));
  const fullQuery = locality ? `${query} ${locality}` : query;
  const serpUrl = `https://duckduckgo.com/?q=${encodeURIComponent(fullQuery)}`;

  const created = await executeTabTools({
    id: uid('tc'),
    name: 'tabs_create',
    arguments: { url: serpUrl, active: true },
  });
  if (!created.ok) {
    return { ok: false, error: created.error ?? 'Could not open search tab', toolCall: call };
  }
  const tabId = (created.data as { id?: number } | undefined)?.id;

  // Give SERP a moment to render.
  await new Promise((r) => setTimeout(r, 1800));

  const read = await executePageTools({
    id: uid('tc'),
    name: 'page_read',
    arguments: tabId != null ? { tabId } : {},
  });

  const text = String((read.data as { text?: string } | undefined)?.text ?? '');
  const urlMatches = [...text.matchAll(/https?:\/\/[^\s)\]"']+/gi)]
    .map((m) => m[0].replace(/[.,;]+$/, ''))
    .filter(
      (u) =>
        !/duckduckgo\.com|google\.[a-z.]+\/search|bing\.com/i.test(u) &&
        !/\.(png|jpg|gif|svg|css|js)(\?|$)/i.test(u),
    );

  const unique: string[] = [];
  for (const u of urlMatches) {
    try {
      const host = new URL(u).hostname;
      if (unique.some((x) => new URL(x).hostname === host)) continue;
      unique.push(u);
    } catch {
      // skip
    }
    if (unique.length >= maxResults) break;
  }

  // Fallback: open search tabs if SERP scrape is thin.
  if (unique.length === 0) {
    const fallbacks = [
      `https://duckduckgo.com/?q=${encodeURIComponent(fullQuery + ' buy')}`,
      `https://www.google.com/search?q=${encodeURIComponent(fullQuery)}`,
    ].slice(0, maxResults);
    for (const url of fallbacks) {
      await executeTabTools({
        id: uid('tc'),
        name: 'tabs_create',
        arguments: { url, active: false },
      });
    }
    return {
      ok: true,
      data: {
        query: fullQuery,
        serpUrl,
        findings: fallbacks.map((url) => ({ url, note: 'Opened search result tab' })),
        note: 'Could not extract deep links from SERP; left search tabs open for you.',
      },
      toolCall: call,
    };
  }

  const findings: Array<{ url: string; domain: string; category: FocusCategory }> = [];
  for (const url of unique) {
    await executeTabTools({
      id: uid('tc'),
      name: 'tabs_create',
      arguments: { url, active: false },
    });
    findings.push({
      url,
      domain: new URL(url).hostname.replace(/^www\./, ''),
      category: categorizeDomain(url, settings.categoryOverrides),
    });
  }

  return {
    ok: true,
    data: {
      query: fullQuery,
      serpUrl,
      findings,
      note: `Opened ${findings.length} finding tab(s). Review and compare in your browser.`,
    },
    toolCall: call,
  };
}
