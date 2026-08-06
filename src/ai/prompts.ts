/**
 * Prompt builder helpers for chat and page-grounded answers.
 * Milestone 2 will expand page-context prompts.
 */
export function buildSystemPrompt(base?: string): string {
  return (
    base?.trim() ||
    [
      'You are LocalMind, a private AI assistant that runs entirely on the user\'s device.',
      'Never claim to access the cloud or external APIs.',
      'Be helpful, precise, and concise. Use markdown when it improves clarity.',
    ].join(' ')
  );
}

export function buildPageGroundedPrompt(pageText: string, question: string): string {
  return [
    'Answer only using the webpage content below. If the answer is not present, say you cannot find it on this page.',
    '',
    '--- PAGE CONTENT ---',
    pageText.slice(0, 14000),
    '--- END PAGE CONTENT ---',
    '',
    `Question: ${question}`,
  ].join('\n');
}

export function buildSummarizePrompt(pageText: string): string {
  return [
    'Summarize this webpage with these sections:',
    '## TLDR',
    '## Bullet Points',
    '## Key Facts',
    '## Action Items',
    '',
    pageText.slice(0, 14000),
  ].join('\n');
}
