import type { ToolCall, ToolResult } from '@/agent/types';
import { categorizeDomain } from '@/phil/categories';
import type { FocusCategory, Goal } from '@/phil/types';
import {
  cancelReminder,
  createReminder,
  scheduleMorningBriefingAlarm,
} from '@/background/phil/reminders';
import {
  composeBriefingContent,
  focusSummaryToday,
} from '@/background/phil/focusTracker';
import {
  getPhilSettings,
  listGoals,
  listReminders,
  localDateKey,
  putBriefing,
  putGoal,
  savePhilSettings,
  uid,
} from '@/storage/phil';

// NOTE: Do NOT statically import tabs/page here — they are bundled into the
// service-worker chunk, which creates a phil ↔ SW circular import and breaks
// dynamic loading of executePhilTools (reminder_create shows as Unknown tool).

function argString(call: ToolCall, key: string, fallback = ''): string {
  return String(call.arguments[key] ?? fallback);
}

function argNumber(call: ToolCall, key: string): number | undefined {
  const n = Number(call.arguments[key]);
  return Number.isFinite(n) ? n : undefined;
}

export async function executePhilTools(call: ToolCall): Promise<ToolResult> {
  switch (call.name) {
    case 'focus_summary': {
      const summary = await focusSummaryToday();
      return { ok: true, data: summary, toolCall: call };
    }
    case 'focus_categorize': {
      const domain = argString(call, 'domain');
      const category = argString(call, 'category') as FocusCategory;
      if (!domain || !['productive', 'leisure', 'neutral', 'blocked'].includes(category)) {
        return {
          ok: false,
          error: 'domain and category (productive|leisure|neutral|blocked) required',
          toolCall: call,
        };
      }
      const settings = await savePhilSettings({
        categoryOverrides: { [domain.replace(/^www\./, '')]: category },
      });
      return {
        ok: true,
        data: { domain, category, overrides: settings.categoryOverrides },
        toolCall: call,
      };
    }
    case 'focus_get_today': {
      return { ok: true, data: await focusSummaryToday(), toolCall: call };
    }
    case 'reminder_create': {
      const text = argString(call, 'text');
      const when = argNumber(call, 'when');
      const inMinutes = argNumber(call, 'inMinutes');
      const repeat = (argString(call, 'repeat', 'none') || 'none') as
        | 'none'
        | 'daily'
        | 'weekdays';
      if (!text.trim()) {
        return { ok: false, error: 'text is required', toolCall: call };
      }
      const whenMs =
        when ??
        (inMinutes != null ? Date.now() + inMinutes * 60_000 : undefined);
      if (whenMs == null) {
        return {
          ok: false,
          error: 'Provide when (epoch ms) or inMinutes',
          toolCall: call,
        };
      }
      const reminder = await createReminder({ text, when: whenMs, repeat });
      return { ok: true, data: reminder, toolCall: call };
    }
    case 'reminder_list': {
      const reminders = await listReminders();
      return {
        ok: true,
        data: reminders.filter((r) => r.status === 'scheduled' || r.status === 'fired'),
        toolCall: call,
      };
    }
    case 'reminder_cancel': {
      const id = argString(call, 'id');
      const cancelled = await cancelReminder(id);
      if (!cancelled) {
        return { ok: false, error: `No reminder ${id}`, toolCall: call };
      }
      return { ok: true, data: cancelled, toolCall: call };
    }
    case 'goal_create': {
      const title = argString(call, 'title');
      if (!title.trim()) {
        return { ok: false, error: 'title is required', toolCall: call };
      }
      const allowed = call.arguments.allowedDomains;
      const blocked = call.arguments.blockedDomains;
      const now = Date.now();
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const goal: Goal = {
        id: uid('goal'),
        title: title.trim(),
        deadline: argNumber(call, 'deadline') ?? end.getTime(),
        status: 'active',
        allowedDomains: Array.isArray(allowed)
          ? allowed.map(String)
          : [],
        blockedDomains: Array.isArray(blocked)
          ? blocked.map(String)
          : ['instagram.com', 'facebook.com', 'reddit.com', 'youtube.com', 'tiktok.com'],
        createdAt: now,
        updatedAt: now,
      };
      await putGoal(goal);
      return { ok: true, data: goal, toolCall: call };
    }
    case 'goal_list': {
      return { ok: true, data: await listGoals(), toolCall: call };
    }
    case 'goal_complete': {
      const id = argString(call, 'id');
      const goals = await listGoals();
      const goal = goals.find((g) => g.id === id);
      if (!goal) return { ok: false, error: `No goal ${id}`, toolCall: call };
      const next = { ...goal, status: 'completed' as const, updatedAt: Date.now() };
      await putGoal(next);
      return { ok: true, data: next, toolCall: call };
    }
    case 'goal_update': {
      const id = argString(call, 'id');
      const goals = await listGoals();
      const goal = goals.find((g) => g.id === id);
      if (!goal) return { ok: false, error: `No goal ${id}`, toolCall: call };
      const next: Goal = {
        ...goal,
        title: argString(call, 'title', goal.title) || goal.title,
        status: (argString(call, 'status', goal.status) as Goal['status']) || goal.status,
        updatedAt: Date.now(),
      };
      if (Array.isArray(call.arguments.blockedDomains)) {
        next.blockedDomains = call.arguments.blockedDomains.map(String);
      }
      if (Array.isArray(call.arguments.allowedDomains)) {
        next.allowedDomains = call.arguments.allowedDomains.map(String);
      }
      await putGoal(next);
      return { ok: true, data: next, toolCall: call };
    }
    case 'phil_settings_update': {
      const partial: Record<string, unknown> = {};
      for (const key of [
        'fabEnabled',
        'trackingEnabled',
        'nudgesEnabled',
        'briefingEnabled',
        'briefingHour',
        'briefingMinute',
        'nudgeThresholdMs',
        'locality',
      ] as const) {
        if (call.arguments[key] !== undefined) partial[key] = call.arguments[key];
      }
      const next = await savePhilSettings(partial);
      await scheduleMorningBriefingAlarm();
      return { ok: true, data: next, toolCall: call };
    }
    case 'phil_settings_get': {
      return { ok: true, data: await getPhilSettings(), toolCall: call };
    }
    case 'briefing_today': {
      const composed = await composeBriefingContent();
      const briefing = {
        id: uid('brief'),
        dateKey: localDateKey(),
        content: composed.content,
        createdAt: Date.now(),
        sources: composed.sources,
      };
      await putBriefing(briefing);
      return { ok: true, data: briefing, toolCall: call };
    }
    case 'web_research': {
      return await runWebResearch(call);
    }
    default:
      return { ok: false, error: `Unknown Phil tool ${call.name}`, toolCall: call };
  }
}

async function runWebResearch(call: ToolCall): Promise<ToolResult> {
  const query = argString(call, 'query');
  if (!query.trim()) {
    return { ok: false, error: 'query is required', toolCall: call };
  }
  // Lazy imports keep phil.js free of the SW circular dependency.
  const { executeTabTools } = await import('@/background/tools/tabs');
  const { executePageTools } = await import('@/background/tools/page');

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

  const text = String(
    (read.data as { text?: string } | undefined)?.text ?? '',
  );
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

  // Fallback: open a couple of shopping searches if SERP scrape is thin.
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
