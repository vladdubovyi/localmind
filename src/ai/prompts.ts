/**
 * Prompt builder helpers for chat and page-grounded answers.
 */
export function buildSystemPrompt(base?: string): string {
  return (
    base?.trim() ||
    [
      "You are Phil, a private personal assistant that runs entirely on the user's device.",
      'Never claim to access the cloud or external APIs.',
      'Help with chat, focus, reminders, goals, research, and browser tasks.',
      'Be helpful, precise, and concise. Use markdown when it improves clarity.',
    ].join(' ')
  );
}

export function buildPageSystemPrompt(base?: string): string {
  return [
    buildSystemPrompt(base),
    'When page content is provided, answer ONLY using that webpage.',
    'If the answer is not in the page, say you cannot find it on this page.',
    'Cite headings or short quotes when helpful. Do not invent facts from outside the page.',
  ].join(' ');
}

export function buildPageGroundedPrompt(pageContext: string, question: string): string {
  return [
    'Answer only using this webpage.',
    '',
    '--- PAGE CONTENT ---',
    pageContext,
    '--- END PAGE CONTENT ---',
    '',
    `Question: ${question}`,
  ].join('\n');
}

export function buildSummarizePrompt(pageContext: string): string {
  return [
    'Summarize this webpage. Use exactly these markdown sections:',
    '',
    '## TLDR',
    '(2–4 sentences)',
    '',
    '## Bullet Points',
    '(key takeaways)',
    '',
    '## Key Facts',
    '(notable facts, figures, names, dates)',
    '',
    '## Action Items',
    '(concrete next steps if any; otherwise say None)',
    '',
    '--- PAGE CONTENT ---',
    pageContext,
    '--- END PAGE CONTENT ---',
  ].join('\n');
}
