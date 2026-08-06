/**
 * Ensure new Gmail tools are registered.
 */
import { AGENT_TOOLS, getTool } from './tools.ts';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const required = [
  'gmail_list',
  'gmail_search',
  'gmail_read',
  'gmail_thread',
  'gmail_extract_links',
  'gmail_get_attachments',
  'gmail_draft',
  'gmail_reply',
  'gmail_reply_all',
  'gmail_forward',
  'gmail_send',
  'gmail_archive',
  'gmail_trash',
  'gmail_spam',
  'gmail_label',
  'gmail_star',
  'gmail_mark_read',
  'gmail_mark_unread',
];

for (const name of required) {
  assert(getTool(name), `missing tool ${name}`);
}

assert(AGENT_TOOLS.filter((t) => t.name.startsWith('gmail_')).length >= required.length, 'gmail count');

console.log('gmailTools.test.ts: ok', required.length);
