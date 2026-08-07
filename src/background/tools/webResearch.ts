import type { ToolCall, ToolResult } from '@/agent/types';
import { weatherPlaceFromQuery } from '@/agent/assistantIntent';
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

function isWeatherQuery(query: string): boolean {
  return /\b(weather|forecast|temperature|humidity|uv index|air quality)\b/i.test(query);
}

type WttrCurrent = {
  temp_F?: string;
  temp_C?: string;
  weatherDesc?: Array<{ value?: string }>;
  windspeedMiles?: string;
  humidity?: string;
  feelsLikeF?: string;
  feelsLikeC?: string;
};

function formatWeatherAnswer(
  place: string,
  line: string,
  current?: WttrCurrent,
): string {
  const desc = current?.weatherDesc?.[0]?.value?.trim();
  const parts: string[] = [];
  if (line.trim()) {
    parts.push(line.trim());
  } else if (desc && current?.temp_F) {
    parts.push(
      `${place || 'Your area'}: ${desc}, ${current.temp_F}°F (${current.temp_C ?? '?'}°C)`,
    );
  }
  if (current?.feelsLikeF) parts.push(`Feels like ${current.feelsLikeF}°F.`);
  if (current?.humidity) parts.push(`Humidity ${current.humidity}%.`);
  if (current?.windspeedMiles) parts.push(`Wind ${current.windspeedMiles} mph.`);
  if (!parts.length) {
    return place
      ? `Could not load a live forecast for ${place}.`
      : 'Could not load a live forecast.';
  }
  const header = place ? `**Weather — ${place}**` : '**Weather**';
  return [header, '', parts.join(' ')].join('\n');
}

async function fetchLiveWeather(place: string): Promise<{
  answer: string;
  pageUrl: string;
  source: string;
} | null> {
  const path = place ? encodeURIComponent(place) : '';
  const pageUrl = `https://wttr.in/${path}`;
  // wttr.in serves the ASCII/HTML site to browsers; curl UA gets plain/json formats.
  const headers = {
    'User-Agent': 'curl/8.4.0',
    Accept: 'text/plain,application/json,*/*',
  };
  try {
    const [lineRes, jsonRes] = await Promise.all([
      fetch(`${pageUrl}?format=4`, { headers }),
      fetch(`${pageUrl}?format=j1`, { headers }),
    ]);
    let line = '';
    if (lineRes.ok) {
      const raw = (await lineRes.text()).trim();
      if (raw && !/^<!DOCTYPE|^<html/i.test(raw)) line = raw;
    }
    let current: WttrCurrent | undefined;
    let areaLabel = place;
    if (jsonRes.ok) {
      const rawJson = (await jsonRes.text()).trim();
      if (rawJson && !/^<!DOCTYPE|^<html/i.test(rawJson)) {
        try {
          const json = JSON.parse(rawJson) as {
            current_condition?: WttrCurrent[];
            nearest_area?: Array<{ areaName?: Array<{ value?: string }> }>;
          };
          current = json.current_condition?.[0];
          areaLabel = place || json.nearest_area?.[0]?.areaName?.[0]?.value || '';
        } catch {
          // ignore bad json
        }
      }
    }
    if (!line && !current) return null;
    const answer = formatWeatherAnswer(areaLabel, line, current);
    if (/<!DOCTYPE|<html/i.test(answer)) return null;
    return { answer, pageUrl, source: 'wttr.in' };
  } catch {
    return null;
  }
}

type Finding = {
  url: string;
  domain: string;
  category: FocusCategory;
  tabId?: number;
  note?: string;
};

/**
 * Research helper for the agent.
 * Weather uses a live forecast fetch (one optional tab). General research opens
 * at most a couple of finding tabs and always returns readable text when possible.
 * Static imports only — Chrome MV3 forbids import() in service workers.
 */
export async function runWebResearch(call: ToolCall): Promise<ToolResult> {
  const query = argString(call, 'query');
  if (!query.trim()) {
    return { ok: false, error: 'query is required', toolCall: call };
  }

  const settings = await getPhilSettings();
  const locality = argString(call, 'locality', settings.locality);
  const maxResults = Math.min(3, Math.max(1, argNumber(call, 'maxResults') ?? 2));

  if (isWeatherQuery(query)) {
    const place = weatherPlaceFromQuery(query, locality);
    const live = await fetchLiveWeather(place);
    if (live) {
      // One useful tab for the user — not three duplicate search pages.
      let tabId: number | undefined;
      const opened = await executeTabTools({
        id: uid('tc'),
        name: 'tabs_create',
        arguments: { url: live.pageUrl, active: true },
      });
      if (opened.ok) {
        tabId = (opened.data as { id?: number } | undefined)?.id;
      }
      const findings: Finding[] = [
        {
          url: live.pageUrl,
          domain: 'wttr.in',
          category: categorizeDomain(live.pageUrl, settings.categoryOverrides),
          tabId,
          note: 'Live forecast',
        },
      ];
      return {
        ok: true,
        data: {
          query: place ? `${query} (${place})` : query,
          answer: live.answer,
          source: live.source,
          serpUrl: live.pageUrl,
          findings,
          note: 'Live weather loaded. Answer the user from `answer` — do not open more tabs.',
        },
        toolCall: call,
      };
    }
    // Fall through to a single search tab if the forecast endpoint is unreachable.
  }

  const fullQuery = locality && !/\bnear me\b/i.test(query) ? `${query} ${locality}` : query;
  const serpUrl = `https://duckduckgo.com/?q=${encodeURIComponent(fullQuery)}&ia=web`;

  const created = await executeTabTools({
    id: uid('tc'),
    name: 'tabs_create',
    arguments: { url: serpUrl, active: true },
  });
  if (!created.ok) {
    return { ok: false, error: created.error ?? 'Could not open search tab', toolCall: call };
  }
  const serpTabId = (created.data as { id?: number } | undefined)?.id;

  await new Promise((r) => setTimeout(r, 1800));

  const read = await executePageTools({
    id: uid('tc'),
    name: 'page_read',
    arguments: serpTabId != null ? { tabId: serpTabId } : {},
  });

  const serpText = String((read.data as { text?: string } | undefined)?.text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  const urlMatches = [...serpText.matchAll(/https?:\/\/[^\s)\]"']+/gi)]
    .map((m) => m[0].replace(/[.,;]+$/, ''))
    .filter(
      (u) =>
        !/duckduckgo\.com|google\.[a-z.]+\/search|bing\.com|microsoft\.com\/?$/i.test(u) &&
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

  const findings: Finding[] = [];
  for (const url of unique) {
    const opened = await executeTabTools({
      id: uid('tc'),
      name: 'tabs_create',
      arguments: { url, active: false },
    });
    findings.push({
      url,
      domain: new URL(url).hostname.replace(/^www\./, ''),
      category: categorizeDomain(url, settings.categoryOverrides),
      tabId: opened.ok ? (opened.data as { id?: number } | undefined)?.id : undefined,
    });
  }

  const snippet = serpText.slice(0, 1200);
  const answer =
    findings.length > 0
      ? [
          `Search results for “${fullQuery}”:`,
          ...findings.map((f, i) => `${i + 1}. ${f.domain} — ${f.url}`),
          snippet ? `\nExcerpt:\n${snippet}` : '',
        ]
          .filter(Boolean)
          .join('\n')
      : snippet
        ? `Search page text for “${fullQuery}”:\n${snippet}`
        : `Opened search for “${fullQuery}” but could not extract result text.`;

  return {
    ok: true,
    data: {
      query: fullQuery,
      answer,
      serpUrl,
      serpTabId,
      findings,
      serpSnippet: snippet,
      note:
        findings.length > 0
          ? 'Answer from the excerpt/links. If you must read a page, use a real tabId from findings.'
          : 'Answer from the search excerpt. Do not invent tab ids. Do not call tabs_list in a loop.',
    },
    toolCall: call,
  };
}
