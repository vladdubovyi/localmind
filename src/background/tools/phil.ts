import type { ToolCall, ToolResult } from '@/agent/types';
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
import { runWebResearch } from '@/background/tools/webResearch';
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
      const repeatRaw = argString(call, 'repeat', '');
      const repeat = repeatRaw
        ? (repeatRaw as 'none' | 'daily' | 'weekdays')
        : undefined;
      if (!text.trim()) {
        return { ok: false, error: 'text is required', toolCall: call };
      }
      const whenMs =
        when ??
        (inMinutes != null ? Date.now() + inMinutes * 60_000 : undefined);
      // Omit when/repeat so Phil reminder defaults apply (SET-05).
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
        'notificationFrequency',
        'reminderDefaultLeadMinutes',
        'reminderDefaultRepeat',
        'quietHoursEnabled',
        'quietHoursStartHour',
        'quietHoursEndHour',
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
