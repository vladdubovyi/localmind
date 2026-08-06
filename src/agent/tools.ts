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
      'List recent Gmail messages from the open Gmail tab (default). No API key needed. Opens mail.google.com if needed.',
    risk: 'safe',
    parameters: {
      query: { type: 'string', description: 'Gmail search query, e.g. newer_than:7d or label:inbox' },
      maxResults: { type: 'number', description: 'Max messages (default 10)' },
    },
  },
  {
    name: 'gmail_read',
    description: 'Read a Gmail message by id from the open Gmail tab (or API if configured).',
    risk: 'safe',
    parameters: {
      id: { type: 'string', description: 'Message id', required: true },
    },
  },
  {
    name: 'gmail_draft',
    description:
      'Open a Gmail Compose draft in the open Gmail tab (to/subject/body). Does not send. Use this to reply or draft an email.',
    risk: 'moderate',
    confirmLabel: 'Create an email draft',
    parameters: {
      to: { type: 'string', description: 'Recipient email', required: true },
      subject: { type: 'string', description: 'Subject', required: true },
      body: { type: 'string', description: 'Plain-text body', required: true },
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
