/**
 * Goal / conversation intent helpers for the browser agent.
 * Keeps email follow-ups on gmail_* tools and away from hallucinated WebGPU nudges.
 */
import type { AgentStep, GmailMessageSummary, ToolCall } from '@/agent/types';

export function inferMaxResults(goal: string): number | undefined {
  const m =
    goal.match(/\b(?:last|top|first|recent)\s+(\d{1,2})\s+(?:emails?|messages?|mails?)\b/i) ||
    goal.match(/\b(\d{1,2})\s+(?:emails?|messages?|mails?)\b/i) ||
    goal.match(/\bwhich\s+(\d{1,2})\s+(?:emails?|messages?)\b/i);
  if (!m) return undefined;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 1) return undefined;
  return Math.min(25, Math.floor(n));
}

export function isEmailListGoal(goal: string): boolean {
  return (
    /\b(email|emails|gmail|inbox|mails?|messages?)\b/i.test(goal) &&
    /\b(last|recent|latest|which|list|got|received|show|check|inbox)\b/i.test(goal)
  );
}

export function isEmailGoal(goal: string): boolean {
  return (
    /\b(email|emails|gmail|inbox|mails?|messages?)\b/i.test(goal) ||
    /\b(summar[iy]s?e|summarize|summirize|read|open)\b.+\b(email|mail|message|subscription)\b/i.test(
      goal,
    ) ||
    /\b(gifted you|subscription|newsletter|invoice)\b/i.test(goal)
  );
}

export function isOpenLinkGoal(goal: string): boolean {
  return (
    /\b(open|navigate|go\s+to|visit)\b/i.test(goal) &&
    /\b(link|url|tab|https?:\/\/)/i.test(goal)
  );
}

export function isSummarizeGoal(goal: string): boolean {
  return /\b(summar[iy]s?e|summirize|summary|tl;?dr|what does .+ say)\b/i.test(goal);
}

/** User wants a Gmail compose draft / reply opened — not just text, not gmail_read. */
export function isDraftGoal(goal: string): boolean {
  return (
    /\b(draft|compose)\b/i.test(goal) ||
    /\b(put|place)\s+that\s+in\s+(an?\s+)?email\b/i.test(goal) ||
    /\b(write|send)\s+(a\s+|an\s+)?(response|reply|email)\b/i.test(goal) ||
    /\b(reply|respond)\s+to\b/i.test(goal) ||
    /\bemail\s+(them|him|her|it)\b/i.test(goal)
  );
}

export function isTriageGoal(goal: string): boolean {
  return /\b(archive|trash|delete|spam|star|label|mark as read|mark as unread|mark read|mark unread)\b/i.test(
    goal,
  );
}

export function isThreadGoal(goal: string): boolean {
  return /\b(thread|conversation|whole (email|message)|full (thread|conversation))\b/i.test(goal);
}

export function isLinksGoal(goal: string): boolean {
  return /\b(links?|urls?|extract links|get links)\b/i.test(goal);
}

export function isAttachmentsGoal(goal: string): boolean {
  return /\b(attachments?|attached files?|download)\b/i.test(goal);
}

export function isForwardGoal(goal: string): boolean {
  return /\bforward\b/i.test(goal);
}

export function prefersReplyTool(goal: string): boolean {
  return /\b(reply|respond|response)\b/i.test(goal) && !/\b(new email|compose|forward)\b/i.test(goal);
}

/**
 * "write a response to SUBJECT saying BODY" / "draft a reply to SUBJECT"
 * Helps recover subject + body when the model omits tool args.
 */
export function parseReplyRequest(goal: string): { subjectHint?: string; bodyHint?: string } {
  const withSaying = goal.match(
    /\b(?:write\s+(?:a\s+|an\s+)?(?:response|reply|email)|respond|reply|draft(?:\s+a)?(?:\s+reply|\s+response|\s+email)?)\s+to\s+(.+?)\s+saying\s+[:"]?\s*(.+)$/i,
  );
  if (withSaying) {
    return {
      subjectHint: withSaying[1].replace(/^["']|["']$/g, '').trim(),
      bodyHint: withSaying[2].replace(/^["']|["']$/g, '').trim(),
    };
  }
  const toOnly = goal.match(
    /\b(?:write\s+(?:a\s+|an\s+)?(?:response|reply|email)|respond|reply|draft(?:\s+a)?(?:\s+reply|\s+response|\s+email)?)\s+to\s+(.+)$/i,
  );
  if (toOnly) {
    return { subjectHint: toOnly[1].replace(/^["']|["']$/g, '').trim() };
  }
  const sayingOnly = goal.match(/\bsaying\s+[:"]?\s*(.+)$/i);
  if (sayingOnly) {
    return { bodyHint: sayingOnly[1].replace(/^["']|["']$/g, '').trim() };
  }
  return {};
}

/** Body for the draft: explicit "saying …", else last assistant final text. */
export function extractReplyBody(goal: string, steps: AgentStep[]): string {
  const parsed = parseReplyRequest(goal);
  if (parsed.bodyHint && parsed.bodyHint.length > 1) return parsed.bodyHint;

  for (let i = steps.length - 1; i >= 0; i--) {
    const s = steps[i];
    if (s.kind === 'final' && s.content.trim()) {
      const text = s.content.trim();
      // Skip long tool-looking dumps
      if (text.length > 8 && text.length < 4000 && !text.startsWith('[')) return text;
    }
  }
  return '';
}

export function buildDraftArguments(
  goal: string,
  steps: AgentStep[],
): { to: string; subject: string; body: string } {
  const parsed = parseReplyRequest(goal);
  const list = lastGmailList(steps);
  let target = resolveEmailTarget(goal, steps);
  if (parsed.subjectHint && list.length) {
    const byHint = matchEmailFromGoal(parsed.subjectHint, list);
    if (byHint) target = byHint;
  }
  const body = extractReplyBody(goal, steps) || 'Thank you.';
  const rawSubject = target?.subject || parsed.subjectHint || 'your email';
  const subject = /^re:/i.test(rawSubject) ? rawSubject : `Re: ${rawSubject}`;
  const to = target?.from || '';
  return { to, subject, body };
}

export function priorHasGmail(steps: AgentStep[]): boolean {
  return steps.some(
    (s) =>
      (s.kind === 'tool_result' &&
        Boolean(s.toolCall?.name.startsWith('gmail_')) &&
        s.toolResult?.ok) ||
      (s.kind === 'user' && isEmailGoal(s.content)),
  );
}

export function lastGmailList(steps: AgentStep[]): GmailMessageSummary[] {
  for (let i = steps.length - 1; i >= 0; i--) {
    const s = steps[i];
    if (
      s.kind !== 'tool_result' ||
      (s.toolCall?.name !== 'gmail_list' && s.toolCall?.name !== 'gmail_search') ||
      !s.toolResult?.ok
    ) {
      continue;
    }
    const data = s.toolResult.data;
    if (!Array.isArray(data)) continue;
    return data.map((row, idx) => {
      const r = row as Partial<GmailMessageSummary>;
      return {
        id: String(r.id ?? `msg-${idx}`),
        threadId: r.threadId,
        from: String(r.from ?? ''),
        subject: String(r.subject ?? ''),
        snippet: String(r.snippet ?? ''),
        date: r.date,
        unread: r.unread,
        starred: r.starred,
      };
    });
  }
  return [];
}

function normalizeMatchText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Find the email the user is referring to from the last gmail_list. */
export function matchEmailFromGoal(
  goal: string,
  list: GmailMessageSummary[],
): GmailMessageSummary | undefined {
  if (!list.length) return undefined;
  const g = normalizeMatchText(goal);
  // Strip common command words to leave subject-ish tokens
  const query = g
    .replace(
      /\b(yes|please|can you|could you|summar[iy]s?e|summirize|summary|read|open|the|this|that|email|mail|message|it|of|for|me|write|a|an|response|reply|respond|draft|compose|put|in|saying|thank|you)\b/g,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();

  if (!query || query.length < 3) {
    return undefined;
  }

  let best: { row: GmailMessageSummary; score: number } | undefined;
  for (const row of list) {
    const subject = normalizeMatchText(row.subject);
    const from = normalizeMatchText(row.from);
    if (!subject) continue;
    let score = 0;
    if (subject.includes(query) || query.includes(subject)) score += 10;
    const tokens = query.split(' ').filter((t) => t.length > 2);
    for (const t of tokens) {
      if (subject.includes(t)) score += 2;
      if (from.includes(t)) score += 1;
    }
    if (!best || score > best.score) best = { row, score };
  }
  return best && best.score >= 4 ? best.row : undefined;
}

/** Resolve target email using this goal, then earlier user messages, then first list item. */
export function resolveEmailTarget(
  goal: string,
  steps: AgentStep[],
): GmailMessageSummary | undefined {
  const list = lastGmailList(steps);
  if (!list.length) return undefined;
  const direct = matchEmailFromGoal(goal, list);
  if (direct) return direct;
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].kind !== 'user') continue;
    const hit = matchEmailFromGoal(steps[i].content, list);
    if (hit) return hit;
  }
  return list[0];
}

export function isGmailAtomFeedUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.hostname.includes('mail.google.com') &&
      (/\/feed\b/i.test(u.pathname) || /alt=json/i.test(u.search) || /atom/i.test(u.pathname + u.search))
    );
  } catch {
    return /mail\.google\.com\/.*feed/i.test(url) || /gmail\/feed/i.test(url);
  }
}

export function isUnrelatedDemoUrl(url: string): boolean {
  return /wikipedia\.org\/wiki\/WebGPU/i.test(url);
}

export type AgentIntent =
  | 'email_list'
  | 'email_read'
  | 'email_draft'
  | 'email_triage'
  | 'email_thread'
  | 'email_links'
  | 'email_attachments'
  | 'email_forward'
  | 'open_link'
  | 'web_page'
  | 'general';

export function detectIntent(goal: string, priorSteps: AgentStep[]): AgentIntent {
  const list = lastGmailList(priorSteps);
  const hasGmail = priorHasGmail(priorSteps) || list.length > 0;

  if (isForwardGoal(goal) && hasGmail) return 'email_forward';
  if (isDraftGoal(goal)) return 'email_draft';
  if (isTriageGoal(goal) && hasGmail) return 'email_triage';
  if (isThreadGoal(goal) && hasGmail) return 'email_thread';
  if (isLinksGoal(goal) && hasGmail) return 'email_links';
  if (isAttachmentsGoal(goal) && hasGmail) return 'email_attachments';
  if (isOpenLinkGoal(goal) && !isSummarizeGoal(goal)) return 'open_link';
  if (isEmailListGoal(goal)) return 'email_list';
  if (
    hasGmail &&
    (isSummarizeGoal(goal) ||
      matchEmailFromGoal(goal, list) ||
      /^\s*yes\b/i.test(goal) ||
      (isEmailGoal(goal) && !isDraftGoal(goal)))
  ) {
    return 'email_read';
  }
  if (isEmailGoal(goal)) return 'email_list';
  if (/\b(wikipedia|webgpu|http|www\.|open .+ page|read .+ page)\b/i.test(goal)) return 'web_page';
  return 'general';
}

/** Example tool call to nudge the model — never invent unrelated demo URLs. */
export function nudgeToolExample(goal: string, priorSteps: AgentStep[]): string {
  const intent = detectIntent(goal, priorSteps);
  const matched = resolveEmailTarget(goal, priorSteps);
  const id = matched?.id ?? 'MESSAGE_ID_FROM_GMAIL_LIST';
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  if (intent === 'email_list') {
    const max = inferMaxResults(goal) ?? 5;
    const qMatch = goal.match(/\b(?:search|find|from|about)\s+(.+)$/i);
    const query = qMatch ? qMatch[1].trim() : 'newer_than:14d';
    return [
      '<tool_call>',
      `{"name":"gmail_list","arguments":{"query":"${esc(query)}","maxResults":${max}}}`,
      '</tool_call>',
    ].join('\n');
  }

  if (intent === 'email_forward') {
    return [
      '<tool_call>',
      `{"name":"gmail_forward","arguments":{"id":"${id}"}}`,
      '</tool_call>',
    ].join('\n');
  }

  if (intent === 'email_draft') {
    if (prefersReplyTool(goal) && matched) {
      const body = esc(extractReplyBody(goal, priorSteps) || 'Thank you.');
      return [
        '<tool_call>',
        `{"name":"gmail_reply","arguments":{"id":"${id}","body":"${body}"}}`,
        '</tool_call>',
        'Opens Reply in-thread. Do NOT call gmail_read. Do NOT send unless asked.',
      ].join('\n');
    }
    const draft = buildDraftArguments(goal, priorSteps);
    return [
      '<tool_call>',
      `{"name":"gmail_draft","arguments":{"to":"${esc(draft.to)}","subject":"${esc(draft.subject)}","body":"${esc(draft.body)}"}}`,
      '</tool_call>',
      'This opens a Compose draft in Gmail. Do NOT call gmail_read. Do NOT send unless the user asked to send.',
    ].join('\n');
  }

  if (intent === 'email_triage') {
    const name = /\btrash|delete\b/i.test(goal)
      ? 'gmail_trash'
      : /\bspam\b/i.test(goal)
        ? 'gmail_spam'
        : /\bstar\b/i.test(goal)
          ? 'gmail_star'
          : /\bmark as unread|mark unread\b/i.test(goal)
            ? 'gmail_mark_unread'
            : /\bmark as read|mark read\b/i.test(goal)
              ? 'gmail_mark_read'
              : /\blabel\b/i.test(goal)
                ? 'gmail_label'
                : 'gmail_archive';
    if (name === 'gmail_label') {
      const label = goal.match(/\blabel\s+(?:as\s+)?["']?([^"']+)["']?/i)?.[1]?.trim() || 'Label';
      return [
        '<tool_call>',
        `{"name":"gmail_label","arguments":{"id":"${id}","label":"${esc(label)}"}}`,
        '</tool_call>',
      ].join('\n');
    }
    return [
      '<tool_call>',
      `{"name":"${name}","arguments":{"id":"${id}"}}`,
      '</tool_call>',
    ].join('\n');
  }

  if (intent === 'email_thread') {
    return [
      '<tool_call>',
      `{"name":"gmail_thread","arguments":{"id":"${id}"}}`,
      '</tool_call>',
    ].join('\n');
  }

  if (intent === 'email_links') {
    return [
      '<tool_call>',
      `{"name":"gmail_extract_links","arguments":{"id":"${id}"}}`,
      '</tool_call>',
    ].join('\n');
  }

  if (intent === 'email_attachments') {
    return [
      '<tool_call>',
      `{"name":"gmail_get_attachments","arguments":{"id":"${id}"}}`,
      '</tool_call>',
    ].join('\n');
  }

  if (intent === 'email_read') {
    return [
      '<tool_call>',
      `{"name":"gmail_read","arguments":{"id":"${id}"}}`,
      '</tool_call>',
      'Use the real message id from the earlier gmail_list result. Do NOT open Wikipedia or atom feeds.',
    ].join('\n');
  }

  if (intent === 'open_link') {
    const urlMatch = goal.match(/https?:\/\/[^\s"'<>]+/i);
    const url = urlMatch?.[0] ?? 'https://EXAMPLE_URL_FROM_PRIOR_CONTEXT';
    return [
      '<tool_call>',
      `{"name":"tabs_create","arguments":{"url":"${url}"}}`,
      '</tool_call>',
      'Use the real https URL from the conversation — never invent one.',
    ].join('\n');
  }

  if (intent === 'web_page') {
    const urlMatch = goal.match(/https?:\/\/[^\s"'<>]+/i);
    if (urlMatch) {
      return [
        '<tool_call>',
        `{"name":"tabs_create","arguments":{"url":"${urlMatch[0]}"}}`,
        '</tool_call>',
      ].join('\n');
    }
  }

  // Live facts / research — force web_research instead of polite chat refusals.
  if (
    /\b(weather|forecast|temperature|research|look up|search (the )?web|news|stock price)\b/i.test(
      goal,
    ) &&
    !/\bgmail|inbox|email\b/i.test(goal)
  ) {
    const q = esc(goal.trim().slice(0, 160));
    return [
      '<tool_call>',
      `{"name":"web_research","arguments":{"query":"${q}","maxResults":3}}`,
      '</tool_call>',
      'Do not ask for permission. Research now, then answer from the findings.',
    ].join('\n');
  }

  return [
    'Output a valid <tool_call> for the user goal, or the final markdown answer if no tool is needed.',
    'Do NOT open https://en.wikipedia.org/wiki/WebGPU unless the user asked for WebGPU.',
    'Gmail tools: gmail_list/search, gmail_read, gmail_thread, gmail_reply, gmail_draft, gmail_forward, gmail_archive/trash/spam/label/star/mark_read, gmail_extract_links, gmail_get_attachments.',
  ].join('\n');
}

/**
 * Rewrite / block tool calls that are known-wrong for the current intent.
 * Returns the call to execute, or a synthetic failure-style rewrite instruction via name swap.
 */
export function rewriteToolCallForIntent(
  goal: string,
  priorSteps: AgentStep[],
  call: ToolCall,
): ToolCall {
  const intent = detectIntent(goal, priorSteps);
  const url = typeof call.arguments.url === 'string' ? call.arguments.url : '';

  // Never rewrite an explicit draft/send/reply/forward away — only enrich missing fields
  if (
    call.name === 'gmail_draft' ||
    call.name === 'gmail_send' ||
    call.name === 'gmail_reply' ||
    call.name === 'gmail_reply_all' ||
    call.name === 'gmail_forward'
  ) {
    if (call.name === 'gmail_draft' || call.name === 'gmail_send') {
      const built = buildDraftArguments(goal, priorSteps);
      const args = { ...call.arguments };
      if (!String(args.to ?? '').trim()) args.to = built.to;
      if (!String(args.subject ?? '').trim()) args.subject = built.subject;
      if (!String(args.body ?? '').trim()) args.body = built.body;
      return { ...call, arguments: args };
    }
    const matched = resolveEmailTarget(goal, priorSteps);
    const args = { ...call.arguments };
    if (!String(args.id ?? '').trim() && matched) args.id = matched.id;
    if (
      (call.name === 'gmail_reply' || call.name === 'gmail_reply_all') &&
      !String(args.body ?? '').trim()
    ) {
      args.body = extractReplyBody(goal, priorSteps);
    }
    return { ...call, arguments: args };
  }

  // Draft/reply intent: force the right compose tool
  if (
    intent === 'email_draft' &&
    (call.name === 'gmail_read' ||
      call.name === 'gmail_list' ||
      call.name === 'tabs_navigate' ||
      call.name === 'tabs_create' ||
      call.name === 'page_read')
  ) {
    const matched = resolveEmailTarget(goal, priorSteps);
    if (prefersReplyTool(goal) && matched) {
      return {
        ...call,
        name: 'gmail_reply',
        arguments: {
          id: matched.id,
          body: extractReplyBody(goal, priorSteps) || 'Thank you.',
        },
      };
    }
    return {
      ...call,
      name: 'gmail_draft',
      arguments: buildDraftArguments(goal, priorSteps),
    };
  }

  if (intent === 'email_forward' && call.name !== 'gmail_forward') {
    const matched = resolveEmailTarget(goal, priorSteps);
    if (matched) {
      return { ...call, name: 'gmail_forward', arguments: { id: matched.id } };
    }
  }

  if (
    intent === 'email_thread' &&
    (call.name === 'gmail_read' || call.name === 'gmail_list' || call.name.startsWith('tabs_'))
  ) {
    const matched = resolveEmailTarget(goal, priorSteps);
    if (matched) return { ...call, name: 'gmail_thread', arguments: { id: matched.id } };
  }

  if (intent === 'email_links' && call.name !== 'gmail_extract_links') {
    const matched = resolveEmailTarget(goal, priorSteps);
    return {
      ...call,
      name: 'gmail_extract_links',
      arguments: matched ? { id: matched.id } : {},
    };
  }

  if (intent === 'email_attachments' && call.name !== 'gmail_get_attachments') {
    const matched = resolveEmailTarget(goal, priorSteps);
    return {
      ...call,
      name: 'gmail_get_attachments',
      arguments: matched ? { id: matched.id } : {},
    };
  }

  if (
    intent === 'email_triage' &&
    !['gmail_archive', 'gmail_trash', 'gmail_spam', 'gmail_star', 'gmail_mark_read', 'gmail_mark_unread', 'gmail_label'].includes(
      call.name,
    )
  ) {
    const matched = resolveEmailTarget(goal, priorSteps);
    const id = matched?.id;
    if (id) {
      const name = /\btrash|delete\b/i.test(goal)
        ? 'gmail_trash'
        : /\bspam\b/i.test(goal)
          ? 'gmail_spam'
          : /\bstar\b/i.test(goal)
            ? 'gmail_star'
            : /\bmark as unread|mark unread\b/i.test(goal)
              ? 'gmail_mark_unread'
              : /\bmark as read|mark read\b/i.test(goal)
                ? 'gmail_mark_read'
                : /\blabel\b/i.test(goal)
                  ? 'gmail_label'
                  : 'gmail_archive';
      if (name === 'gmail_label') {
        const label =
          goal.match(/\blabel\s+(?:as\s+)?["']?([^"']+)["']?/i)?.[1]?.trim() || 'Label';
        return { ...call, name, arguments: { id, label } };
      }
      return { ...call, name, arguments: { id } };
    }
  }

  // Atom / feed URLs are never the right way to read Gmail
  if (
    (call.name === 'tabs_navigate' || call.name === 'tabs_create') &&
    url &&
    isGmailAtomFeedUrl(url)
  ) {
    const max = inferMaxResults(goal) ?? 5;
    return {
      ...call,
      name: 'gmail_list',
      arguments: { query: 'newer_than:14d', maxResults: max },
    };
  }

  // Demo WebGPU URL during an email conversation
  if (
    (call.name === 'tabs_navigate' || call.name === 'tabs_create') &&
    url &&
    isUnrelatedDemoUrl(url) &&
    (intent === 'email_list' ||
      intent === 'email_read' ||
      intent === 'email_draft' ||
      priorHasGmail(priorSteps))
  ) {
    if (intent === 'email_draft') {
      return { ...call, name: 'gmail_draft', arguments: buildDraftArguments(goal, priorSteps) };
    }
    const matched = resolveEmailTarget(goal, priorSteps);
    if ((intent === 'email_read' || matched) && matched) {
      return {
        ...call,
        name: 'gmail_read',
        arguments: { id: matched.id },
      };
    }
    const max = inferMaxResults(goal) ?? 5;
    return {
      ...call,
      name: 'gmail_list',
      arguments: { query: 'newer_than:14d', maxResults: max },
    };
  }

  // Email list goal must not use tab navigation
  if (
    intent === 'email_list' &&
    (call.name === 'tabs_navigate' || call.name === 'tabs_create' || call.name === 'page_read')
  ) {
    const max = inferMaxResults(goal) ?? 5;
    return {
      ...call,
      name: 'gmail_list',
      arguments: { query: 'newer_than:14d', maxResults: max },
    };
  }

  // Summarize / read email → gmail_read
  if (
    intent === 'email_read' &&
    (call.name === 'tabs_navigate' ||
      call.name === 'tabs_create' ||
      call.name === 'page_read' ||
      call.name === 'gmail_list')
  ) {
    const list = lastGmailList(priorSteps);
    const matched = resolveEmailTarget(goal, priorSteps);
    // Allow gmail_list only if we have no prior list
    if (call.name === 'gmail_list' && !list.length) return call;
    if (matched) {
      return {
        ...call,
        name: 'gmail_read',
        arguments: { id: matched.id },
      };
    }
  }

  // open new tab wording
  if (
    call.name === 'tabs_navigate' &&
    /\bnew\s+tab\b/i.test(goal) &&
    typeof call.arguments.url === 'string'
  ) {
    return {
      ...call,
      name: 'tabs_create',
      arguments: { url: call.arguments.url, active: true },
    };
  }

  // Enrich gmail_list defaults
  if (call.name === 'gmail_list') {
    const args = { ...call.arguments };
    if (args.maxResults == null) {
      const inferred = inferMaxResults(goal);
      if (inferred != null) args.maxResults = inferred;
    }
    if (args.query == null || args.query === '') {
      args.query = 'newer_than:14d';
    }
    return { ...call, arguments: args };
  }

  // After a successful research answer, block tab thrash / invented tab ids.
  const priorResearch = [...priorSteps]
    .reverse()
    .find((s) => s.kind === 'tool_result' && s.toolCall?.name === 'web_research' && s.toolResult?.ok);
  const researchAnswer =
    priorResearch?.toolResult?.data &&
    typeof priorResearch.toolResult.data === 'object' &&
    typeof (priorResearch.toolResult.data as { answer?: unknown }).answer === 'string'
      ? String((priorResearch.toolResult.data as { answer: string }).answer).trim()
      : '';
  if (
    researchAnswer &&
    (call.name === 'tabs_list' ||
      call.name === 'tabs_create' ||
      call.name === 'tabs_navigate' ||
      call.name === 'web_research' ||
      (call.name === 'page_read' &&
        (call.arguments.tabId == null || Number(call.arguments.tabId) === 1)))
  ) {
    // Keep the call name but clear junk args so the agent loop can short-circuit.
    return { ...call, arguments: { ...call.arguments, __philSkipAfterResearch: true } };
  }

  return call;
}

export function looksLikeHallucinatedEmails(text: string): boolean {
  return (
    /\bsender\d\b/i.test(text) ||
    /\bImportant Meeting Reminder\b/i.test(text) ||
    /\bPersonal Greetings\b/i.test(text) ||
    /\bI (only )?simulated\b/i.test(text) ||
    /\bdid not actually see\b/i.test(text)
  );
}
