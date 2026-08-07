import type { ToolCall, ToolResult } from '@/agent/types';
import type { FocusCategory, Goal } from '@/phil/types';
import {
  cancelReminder,
  createReminder,
  scheduleDailyReviewAlarms,
} from '@/background/phil/reminders';
import {
  buildEveningBriefingRecord,
  buildMorningBriefingRecord,
} from '@/background/phil/dailyReview';
import { focusSummaryToday } from '@/background/phil/focusTracker';
import { runWebResearch } from '@/background/tools/webResearch';
import {
  getPhilSettings,
  listGoals,
  listReminders,
  putBriefing,
  putGoal,
  savePhilSettings,
  uid,
} from '@/storage/phil';
import {
  addKnowledgeEntry,
  createProject,
  formatProjectProgress,
  getActiveProject,
  getActiveProjectId,
  getProject,
  inferProjectTemplate,
  isProjectTemplate,
  linkGoalToProject,
  listProjects,
  setActiveProjectId,
  templateLabel,
} from '@/storage/projects';
import {
  forgetMemory,
  listMemories,
  rememberMemory,
  searchMemories,
} from '@/storage/memory';
import { getSettings } from '@/storage/db';

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
      return { ok: true, data: await focusSummaryToday(), toolCall: call };
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
      // Omit when so Phil reminder defaults apply (SET-05); still link active project (B2).
      const projectId = argString(call, 'projectId') || undefined;
      const reminder = await createReminder({ text, when: whenMs, repeat, projectId });
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
      if (!cancelled) return { ok: false, error: `No reminder ${id}`, toolCall: call };
      return { ok: true, data: cancelled, toolCall: call };
    }
    case 'goal_create': {
      const title = argString(call, 'title');
      if (!title.trim()) return { ok: false, error: 'title is required', toolCall: call };
      const allowed = call.arguments.allowedDomains;
      const blocked = call.arguments.blockedDomains;
      const now = Date.now();
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const projectId =
        argString(call, 'projectId') || (await getActiveProjectId()) || undefined;
      const goal: Goal = {
        id: uid('goal'),
        title: title.trim(),
        deadline: argNumber(call, 'deadline') ?? end.getTime(),
        status: 'active',
        allowedDomains: Array.isArray(allowed) ? allowed.map(String) : [],
        blockedDomains: Array.isArray(blocked)
          ? blocked.map(String)
          : ['instagram.com', 'facebook.com', 'reddit.com', 'youtube.com', 'tiktok.com'],
        createdAt: now,
        updatedAt: now,
        projectId,
      };
      await putGoal(goal);
      if (projectId) await linkGoalToProject(projectId, goal.id);
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
      const projectId = argString(call, 'projectId');
      if (projectId) {
        next.projectId = projectId;
        await linkGoalToProject(projectId, next.id);
      }
      await putGoal(next);
      return { ok: true, data: next, toolCall: call };
    }
    case 'project_create': {
      const title = argString(call, 'title');
      if (!title.trim()) return { ok: false, error: 'title is required', toolCall: call };
      const templateArg = argString(call, 'template');
      const template = isProjectTemplate(templateArg)
        ? templateArg
        : inferProjectTemplate(title);
      const utterance = argString(call, 'utterance') || title;
      const project = await createProject({
        title: title.trim(),
        template,
        targetDate: argNumber(call, 'targetDate'),
        makeActive: call.arguments.makeActive !== false,
        utterance,
      });
      const now = Date.now();
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const goal: Goal = {
        id: uid('goal'),
        title: title.trim(),
        deadline: end.getTime(),
        status: 'active',
        allowedDomains: [],
        blockedDomains: [
          'instagram.com',
          'facebook.com',
          'reddit.com',
          'youtube.com',
          'tiktok.com',
        ],
        createdAt: now,
        updatedAt: now,
        projectId: project.id,
      };
      await putGoal(goal);
      await linkGoalToProject(project.id, goal.id);
      return {
        ok: true,
        data: {
          project,
          goal,
          message: project.statusSummary ?? `I've set up your ${project.title} project (${templateLabel(project.template)}).`,
        },
        toolCall: call,
      };
    }
    case 'project_list': {
      const projects = await listProjects();
      const activeId = await getActiveProjectId();
      return {
        ok: true,
        data: {
          activeProjectId: activeId,
          projects: projects.map((p) => ({
            id: p.id,
            title: p.title,
            template: p.template,
            status: p.status,
            milestoneCount: p.milestones.length,
            linkedReminderCount: p.linkedReminderIds.length,
            linkedGoalCount: p.linkedGoalIds.length,
            knowledgeCount: p.knowledgeEntries.length,
          })),
        },
        toolCall: call,
      };
    }
    case 'project_set_active': {
      const id = argString(call, 'id') || argString(call, 'projectId');
      if (!id) return { ok: false, error: 'id (project id) is required', toolCall: call };
      const project = await getProject(id);
      if (!project) return { ok: false, error: `No project ${id}`, toolCall: call };
      const selection = await setActiveProjectId(id);
      return { ok: true, data: { selection, project }, toolCall: call };
    }
    case 'project_get': {
      const id = argString(call, 'id') || argString(call, 'projectId');
      const project = id ? await getProject(id) : await getActiveProject();
      if (!project) {
        return {
          ok: false,
          error: id ? `No project ${id}` : 'No active project',
          toolCall: call,
        };
      }
      return {
        ok: true,
        data: { project, progress: formatProjectProgress(project) },
        toolCall: call,
      };
    }
    case 'project_progress': {
      const id = argString(call, 'id') || argString(call, 'projectId');
      const project = id ? await getProject(id) : await getActiveProject();
      if (!project) {
        return {
          ok: false,
          error: id ? `No project ${id}` : 'No active project',
          toolCall: call,
        };
      }
      return {
        ok: true,
        data: {
          projectId: project.id,
          title: project.title,
          progress: formatProjectProgress(project),
        },
        toolCall: call,
      };
    }
    case 'project_add_knowledge': {
      const projectId =
        argString(call, 'projectId') ||
        argString(call, 'id') ||
        (await getActiveProjectId()) ||
        '';
      const title = argString(call, 'title');
      const summary = argString(call, 'summary');
      if (!projectId || !title.trim()) {
        return { ok: false, error: 'projectId and title are required', toolCall: call };
      }
      const tags = Array.isArray(call.arguments.tags)
        ? call.arguments.tags.map(String)
        : [];
      const updated = await addKnowledgeEntry(projectId, {
        title: title.trim(),
        summary: summary.trim() || title.trim(),
        url: argString(call, 'url') || undefined,
        tags,
        source: argString(call, 'source', 'agent') || 'agent',
      });
      if (!updated) return { ok: false, error: `No project ${projectId}`, toolCall: call };
      return { ok: true, data: updated, toolCall: call };
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
        'eveningRecapEnabled',
        'eveningRecapHour',
        'eveningRecapMinute',
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
      await scheduleDailyReviewAlarms();
      return { ok: true, data: next, toolCall: call };
    }
    case 'phil_settings_get': {
      return { ok: true, data: await getPhilSettings(), toolCall: call };
    }
    case 'briefing_today': {
      const briefing = await buildMorningBriefingRecord();
      await putBriefing(briefing);
      return { ok: true, data: briefing, toolCall: call };
    }
    case 'briefing_evening': {
      const recap = await buildEveningBriefingRecord();
      await putBriefing(recap);
      return { ok: true, data: recap, toolCall: call };
    }
    case 'web_research': {
      return await runWebResearch(call);
    }
    case 'memory_remember': {
      const settings = await getSettings();
      if (!settings.memoryEnabled) {
        return {
          ok: false,
          error: 'Memory is off. Enable Memory in Privacy / Settings to store new facts.',
          toolCall: call,
        };
      }
      const text = argString(call, 'text').trim();
      if (!text) return { ok: false, error: 'text is required', toolCall: call };
      const entry = await rememberMemory(text, {
        projectId: argString(call, 'projectId') || undefined,
        source: 'tool',
      });
      return {
        ok: true,
        data: { ...entry, answer: `Got it — I’ll remember that: ${entry.text}` },
        toolCall: call,
      };
    }
    case 'memory_forget': {
      const id = argString(call, 'id');
      const text = argString(call, 'text');
      const removed = await forgetMemory(id || text);
      if (!removed) {
        return { ok: false, error: 'No matching memory found to forget.', toolCall: call };
      }
      return {
        ok: true,
        data: { removed, answer: `Forgotten: ${removed.text}` },
        toolCall: call,
      };
    }
    case 'memory_search': {
      const query = argString(call, 'query');
      const limit = argNumber(call, 'limit') ?? 10;
      const hits = await searchMemories(query, limit);
      const answer = hits.length
        ? hits.map((m, i) => `${i + 1}. ${m.text}`).join('\n')
        : query
          ? `No memories matched “${query}”.`
          : 'No memories stored yet.';
      return { ok: true, data: { memories: hits, answer }, toolCall: call };
    }
    case 'memory_list': {
      const limit = argNumber(call, 'limit') ?? 20;
      const memories = (await listMemories()).slice(0, limit);
      const answer = memories.length
        ? memories.map((m, i) => `${i + 1}. ${m.text}`).join('\n')
        : 'No memories stored yet.';
      return { ok: true, data: { memories, answer }, toolCall: call };
    }
        default:
      return { ok: false, error: `Unknown Phil tool ${call.name}`, toolCall: call };
  }
}
