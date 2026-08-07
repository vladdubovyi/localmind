import type { AgentToolDefinition } from '@/agent/types';

/** Canonical tool registry for the local browser agent. */
export const AGENT_TOOLS: AgentToolDefinition[] = [
  {
    name: 'tabs_list',
    description: 'List open tabs (id, title, url, active).',
    risk: 'safe',
    parameters: {},
  },
  {
    name: 'tabs_create',
    description: 'Open a new tab to the given URL.',
    risk: 'moderate',
    confirmLabel: 'Open a new tab',
    parameters: {
      url: { type: 'string', description: 'Absolute http(s) URL', required: true },
      active: { type: 'boolean', description: 'Focus the new tab (default true)' },
    },
  },
  {
    name: 'tabs_activate',
    description: 'Focus an existing tab by id.',
    risk: 'safe',
    parameters: {
      tabId: { type: 'number', description: 'Tab id from tabs_list', required: true },
    },
  },
  {
    name: 'tabs_navigate',
    description: 'Navigate the active (or given) tab to a URL.',
    risk: 'moderate',
    confirmLabel: 'Navigate this tab',
    parameters: {
      url: { type: 'string', description: 'Absolute http(s) URL', required: true },
      tabId: { type: 'number', description: 'Optional tab id; defaults to active tab' },
    },
  },
  {
    name: 'page_read',
    description: 'Read cleaned text/content from the active tab (or tabId).',
    risk: 'safe',
    parameters: {
      tabId: { type: 'number', description: 'Optional tab id' },
    },
  },
  {
    name: 'page_query',
    description: 'Query DOM elements matching a CSS selector; returns text/href samples.',
    risk: 'safe',
    parameters: {
      selector: { type: 'string', description: 'CSS selector', required: true },
      tabId: { type: 'number', description: 'Optional tab id' },
      limit: { type: 'number', description: 'Max matches (default 10)' },
    },
  },
  {
    name: 'page_click',
    description: 'Click an element matching a CSS selector on the page.',
    risk: 'moderate',
    confirmLabel: 'Click an element on the page',
    parameters: {
      selector: { type: 'string', description: 'CSS selector', required: true },
      tabId: { type: 'number', description: 'Optional tab id' },
    },
  },
  {
    name: 'page_type',
    description: 'Type text into an input/textarea/contenteditable matched by selector.',
    risk: 'moderate',
    confirmLabel: 'Type into a page field',
    parameters: {
      selector: { type: 'string', description: 'CSS selector', required: true },
      text: { type: 'string', description: 'Text to type', required: true },
      clear: { type: 'boolean', description: 'Clear existing value first (default true)' },
      tabId: { type: 'number', description: 'Optional tab id' },
    },
  },
  {
    name: 'page_fill',
    description: 'Fill multiple fields: map of CSS selector → value.',
    risk: 'moderate',
    confirmLabel: 'Fill form fields',
    parameters: {
      fields: { type: 'object', description: 'Object of selector → string value', required: true },
      tabId: { type: 'number', description: 'Optional tab id' },
    },
  },
  {
    name: 'gmail_list',
    description:
      'List/search Gmail messages from the open Gmail tab (default). Supports Gmail search queries. Opens mail.google.com if needed.',
    risk: 'safe',
    parameters: {
      query: {
        type: 'string',
        description: 'Gmail search query, e.g. newer_than:7d, from:gabe@, is:unread, has:attachment',
      },
      maxResults: { type: 'number', description: 'Max messages (default 10)' },
    },
  },
  {
    name: 'gmail_search',
    description: 'Alias of gmail_list with an explicit search query (waits for results).',
    risk: 'safe',
    parameters: {
      query: { type: 'string', description: 'Gmail search query', required: true },
      maxResults: { type: 'number', description: 'Max messages (default 10)' },
    },
  },
  {
    name: 'gmail_read',
    description: 'Read a Gmail message by id from the open Gmail tab (or API if configured).',
    risk: 'safe',
    parameters: {
      id: { type: 'string', description: 'Message id from gmail_list', required: true },
    },
  },
  {
    name: 'gmail_thread',
    description: 'Read the full conversation/thread for a message id.',
    risk: 'safe',
    parameters: {
      id: { type: 'string', description: 'Message or thread id', required: true },
    },
  },
  {
    name: 'gmail_extract_links',
    description: 'Extract links from an open/selected message (or by id).',
    risk: 'safe',
    parameters: {
      id: { type: 'string', description: 'Optional message id; opens it first if provided' },
      limit: { type: 'number', description: 'Max links (default 20)' },
    },
  },
  {
    name: 'gmail_get_attachments',
    description: 'List attachment names (and URLs when available) for a message.',
    risk: 'safe',
    parameters: {
      id: { type: 'string', description: 'Optional message id; opens it first if provided' },
    },
  },
  {
    name: 'gmail_draft',
    description:
      'Open a Gmail Compose draft (to/subject/body). Does not send. Prefer gmail_reply for in-thread replies.',
    risk: 'moderate',
    confirmLabel: 'Create an email draft',
    parameters: {
      to: { type: 'string', description: 'Recipient email', required: true },
      subject: { type: 'string', description: 'Subject', required: true },
      body: { type: 'string', description: 'Plain-text body', required: true },
    },
  },
  {
    name: 'gmail_reply',
    description: 'Open Reply on a message and optionally fill the body. Does not send.',
    risk: 'moderate',
    confirmLabel: 'Open a reply draft',
    parameters: {
      id: { type: 'string', description: 'Message id to reply to', required: true },
      body: { type: 'string', description: 'Reply body text' },
    },
  },
  {
    name: 'gmail_reply_all',
    description: 'Open Reply all on a message and optionally fill the body. Does not send.',
    risk: 'moderate',
    confirmLabel: 'Open a reply-all draft',
    parameters: {
      id: { type: 'string', description: 'Message id', required: true },
      body: { type: 'string', description: 'Reply body text' },
    },
  },
  {
    name: 'gmail_forward',
    description: 'Open Forward on a message and optionally add a note. Does not send.',
    risk: 'moderate',
    confirmLabel: 'Open a forward draft',
    parameters: {
      id: { type: 'string', description: 'Message id', required: true },
      body: { type: 'string', description: 'Optional note to prepend' },
    },
  },
  {
    name: 'gmail_send',
    description:
      'Send via API if configured; in session mode opens a draft for you to send manually.',
    risk: 'dangerous',
    confirmLabel: 'Send an email',
    parameters: {
      to: { type: 'string', description: 'Recipient email', required: true },
      subject: { type: 'string', description: 'Subject', required: true },
      body: { type: 'string', description: 'Plain-text body', required: true },
    },
  },
  {
    name: 'gmail_archive',
    description: 'Archive a message (remove from inbox).',
    risk: 'moderate',
    confirmLabel: 'Archive this email',
    parameters: {
      id: { type: 'string', description: 'Message id', required: true },
    },
  },
  {
    name: 'gmail_trash',
    description: 'Move a message to Trash.',
    risk: 'dangerous',
    confirmLabel: 'Move this email to Trash',
    parameters: {
      id: { type: 'string', description: 'Message id', required: true },
    },
  },
  {
    name: 'gmail_spam',
    description: 'Report a message as spam.',
    risk: 'dangerous',
    confirmLabel: 'Report this email as spam',
    parameters: {
      id: { type: 'string', description: 'Message id', required: true },
    },
  },
  {
    name: 'gmail_label',
    description: 'Apply a Gmail label to a message.',
    risk: 'moderate',
    confirmLabel: 'Apply a Gmail label',
    parameters: {
      id: { type: 'string', description: 'Message id', required: true },
      label: { type: 'string', description: 'Label name', required: true },
    },
  },
  {
    name: 'gmail_star',
    description: 'Toggle star on a message.',
    risk: 'safe',
    parameters: {
      id: { type: 'string', description: 'Message id', required: true },
    },
  },
  {
    name: 'gmail_mark_read',
    description: 'Mark a message as read.',
    risk: 'safe',
    parameters: {
      id: { type: 'string', description: 'Message id', required: true },
    },
  },
  {
    name: 'gmail_mark_unread',
    description: 'Mark a message as unread.',
    risk: 'safe',
    parameters: {
      id: { type: 'string', description: 'Message id', required: true },
    },
  },
  {
    name: 'focus_summary',
    description: 'Summarize today’s tab time by productive / leisure / neutral / blocked.',
    risk: 'safe',
    parameters: {},
  },
  {
    name: 'focus_get_today',
    description: 'Alias of focus_summary — today’s focus breakdown.',
    risk: 'safe',
    parameters: {},
  },
  {
    name: 'focus_categorize',
    description: 'Override the focus category for a domain (productive|leisure|neutral|blocked).',
    risk: 'safe',
    parameters: {
      domain: { type: 'string', description: 'Hostname, e.g. youtube.com', required: true },
      category: {
        type: 'string',
        description: 'productive | leisure | neutral | blocked',
        required: true,
      },
    },
  },
  {
    name: 'reminder_create',
    description: 'Schedule a reminder notification (when epoch ms, or inMinutes from now).',
    risk: 'safe',
    parameters: {
      text: { type: 'string', description: 'Reminder text', required: true },
      when: { type: 'number', description: 'Fire time as epoch milliseconds' },
      inMinutes: { type: 'number', description: 'Fire this many minutes from now' },
      repeat: { type: 'string', description: 'none | daily | weekdays (default none)' },
    },
  },
  {
    name: 'reminder_list',
    description: 'List scheduled and recently fired reminders.',
    risk: 'safe',
    parameters: {},
  },
  {
    name: 'reminder_cancel',
    description: 'Cancel a reminder by id.',
    risk: 'safe',
    parameters: {
      id: { type: 'string', description: 'Reminder id', required: true },
    },
  },
  {
    name: 'goal_create',
    description: 'Create an active focus goal with optional allowed/blocked domains.',
    risk: 'safe',
    parameters: {
      title: { type: 'string', description: 'Goal title', required: true },
      deadline: { type: 'number', description: 'Optional deadline epoch ms' },
      allowedDomains: { type: 'object', description: 'Optional allow-list of domains' },
      blockedDomains: { type: 'object', description: 'Optional block-list (leisure sites)' },
    },
  },
  {
    name: 'goal_list',
    description: 'List goals (active, completed, cancelled).',
    risk: 'safe',
    parameters: {},
  },
  {
    name: 'goal_complete',
    description: 'Mark a goal completed by id.',
    risk: 'safe',
    parameters: {
      id: { type: 'string', description: 'Goal id', required: true },
    },
  },
  {
    name: 'goal_update',
    description: 'Update a goal title, status, or domain lists.',
    risk: 'safe',
    parameters: {
      id: { type: 'string', description: 'Goal id', required: true },
      title: { type: 'string', description: 'New title' },
      status: { type: 'string', description: 'active | completed | cancelled' },
      allowedDomains: { type: 'object', description: 'Replace allow-list' },
      blockedDomains: { type: 'object', description: 'Replace block-list' },
    },
  },
  {
    name: 'phil_settings_get',
    description: 'Read Phil assistant settings (FAB, tracking, nudges, briefing, locality).',
    risk: 'safe',
    parameters: {},
  },
  {
    name: 'phil_settings_update',
    description: 'Update Phil settings (fabEnabled, trackingEnabled, nudgesEnabled, briefing*, locality).',
    risk: 'safe',
    parameters: {
      fabEnabled: { type: 'boolean', description: 'Show always-on FAB' },
      trackingEnabled: { type: 'boolean', description: 'Track tab focus time' },
      nudgesEnabled: { type: 'boolean', description: 'Nudge when off-task' },
      briefingEnabled: { type: 'boolean', description: 'Morning briefing notification' },
      briefingHour: { type: 'number', description: 'Local hour 0–23' },
      briefingMinute: { type: 'number', description: 'Local minute 0–59' },
      nudgeThresholdMs: { type: 'number', description: 'Leisure ms before nudge' },
      notificationFrequency: {
        type: 'string',
        description: 'off | low | normal | high',
      },
      reminderDefaultLeadMinutes: {
        type: 'number',
        description: 'Default minutes until reminder fires',
      },
      reminderDefaultRepeat: {
        type: 'string',
        description: 'none | daily | weekdays',
      },
      quietHoursEnabled: { type: 'boolean', description: 'Suppress notifications in quiet hours' },
      quietHoursStartHour: { type: 'number', description: 'Quiet hours start (0–23, device TZ)' },
      quietHoursEndHour: { type: 'number', description: 'Quiet hours end (0–23, device TZ)' },
      locality: { type: 'string', description: 'City/region bias for web research' },
    },
  },
  {
    name: 'briefing_today',
    description: 'Compose today’s morning briefing from goals, reminders, and focus so far.',
    risk: 'safe',
    parameters: {},
  },
  {
    name: 'project_create',
    description:
      'Create a Persistent Project (long-horizon plan) with template, milestones, and a linked goal. Prefer this over goal_create for career/job/move/research intents.',
    risk: 'safe',
    parameters: {
      title: { type: 'string', description: 'Project title', required: true },
      template: {
        type: 'string',
        description: 'career | job_hunt | research | exec_day | life_move | custom',
      },
      targetDate: { type: 'number', description: 'Optional deadline epoch ms' },
      makeActive: {
        type: 'boolean',
        description: 'Set as active project (default true)',
      },
    },
  },
  {
    name: 'project_list',
    description: 'List Persistent Projects with status and active selection.',
    risk: 'safe',
    parameters: {},
  },
  {
    name: 'project_set_active',
    description: 'Set the active Persistent Project for subsequent Agent turns.',
    risk: 'safe',
    parameters: {
      id: { type: 'string', description: 'Project id', required: true },
    },
  },
  {
    name: 'project_get',
    description: 'Get a Persistent Project by id, or the active project if id omitted.',
    risk: 'safe',
    parameters: {
      id: { type: 'string', description: 'Optional project id (defaults to active)' },
    },
  },
  {
    name: 'project_progress',
    description: 'Summarize where the user is on a project (workstreams + next-week plan).',
    risk: 'safe',
    parameters: {
      id: { type: 'string', description: 'Optional project id (defaults to active)' },
    },
  },
  {
    name: 'project_add_knowledge',
    description: 'Attach a knowledge / research note to a project (PRJ-02).',
    risk: 'safe',
    parameters: {
      projectId: { type: 'string', description: 'Project id (defaults to active)' },
      title: { type: 'string', description: 'Note title', required: true },
      summary: { type: 'string', description: 'Short summary' },
      url: { type: 'string', description: 'Optional source URL' },
      tags: { type: 'object', description: 'Optional tag list' },
    },
  },
  {
    name: 'web_research',
    description:
      'Search the web via DuckDuckGo in a browser tab, open finding tabs, and return URLs. Leaves tabs open for the user.',
    risk: 'moderate',
    confirmLabel: 'Research the web and open result tabs',
    parameters: {
      query: { type: 'string', description: 'Search query', required: true },
      locality: { type: 'string', description: 'Optional place bias, e.g. Austin TX' },
      maxResults: { type: 'number', description: 'Finding tabs to open (1–5, default 3)' },
    },
  },
  {
    name: 'memory_remember',
    description:
      'Store a lasting fact about the user (preferences, context). Requires memory to be enabled in Privacy.',
    risk: 'safe',
    parameters: {
      text: { type: 'string', description: 'Fact to remember', required: true },
      projectId: { type: 'string', description: 'Optional Persistent Project id' },
    },
  },
  {
    name: 'memory_forget',
    description: 'Remove a remembered fact by id or matching text.',
    risk: 'safe',
    parameters: {
      id: { type: 'string', description: 'Memory id from memory_search / memory_list' },
      text: { type: 'string', description: 'Text fragment to match if id unknown' },
    },
  },
  {
    name: 'memory_search',
    description: 'Keyword-search stored memories (and optionally list recent ones).',
    risk: 'safe',
    parameters: {
      query: { type: 'string', description: 'Search keywords (empty = recent memories)' },
      limit: { type: 'number', description: 'Max results (default 10)' },
    },
  },
  {
    name: 'memory_list',
    description: 'List recent remembered facts.',
    risk: 'safe',
    parameters: {
      limit: { type: 'number', description: 'Max results (default 20)' },
    },
  },
  {
    name: 'browser_memory_search',
    description:
      'Search indexed browser history and tab activity for pages the user read recently.',
    risk: 'safe',
    parameters: {
      query: {
        type: 'string',
        description: 'Natural-language find query including topic and optional time window',
        required: true,
      },
      limit: { type: 'number', description: 'Max results (default 5)' },
    },
  },

];

export function getTool(name: string): AgentToolDefinition | undefined {
  return AGENT_TOOLS.find((t) => t.name === name);
}

export function toolsPromptBlock(): string {
  return AGENT_TOOLS.map((t) => {
    const params = Object.entries(t.parameters)
      .map(([k, v]) => `${k}${v.required ? '*' : ''}: ${v.type} — ${v.description}`)
      .join('; ');
    return `- ${t.name} [${t.risk}]${params ? ` { ${params} }` : ''}: ${t.description}`;
  }).join('\n');
}
