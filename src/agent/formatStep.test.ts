import {
  cleanDisplayText,
  formatToolResultContent,
  isJsonLookingFinal,
  toolCallLabel,
} from './formatStep.ts';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

{
  const junk = 'Get started with Gemini \u200B\u200C \uFEFF \u00A0 \u200B';
  const cleaned = cleanDisplayText(junk, 80);
  assert(!cleaned.includes('\u200B'), 'clean: strips zwsp');
  assert(cleaned.includes('Gemini'), 'clean: keeps real text');
}

{
  const formatted = formatToolResultContent('gmail_list', {
    ok: true,
    data: [
      {
        id: '1',
        from: 'no-reply@faceit.com',
        subject: 'Your FACEIT login verification code',
        snippet: '- \u200C \u200C \u200C \u200C \u200C',
      },
      {
        id: '2',
        from: 'gabe@futureproofing.dev',
        subject: 'Appointment booked: 30 min with Gabe',
        snippet: 'Looking forward to connecting! Join with Google Meet',
      },
    ],
  });
  assert(formatted.includes('FACEIT'), 'gmail format: subject');
  assert(formatted.includes('gabe@'), 'gmail format: from');
  assert(!formatted.includes('\u200C'), 'gmail format: no junk snippet chars');
  assert(formatted.includes('Looking forward'), 'gmail format: real snippet kept');
}

{
  assert(toolCallLabel('gmail_list', {}) === 'Checking Gmail…', 'label: gmail');
  assert(isJsonLookingFinal('[{"id":"1","subject":"Hi"}]'), 'json final detect');
  assert(!isJsonLookingFinal('Here are your emails:'), 'non-json final');
}

console.log('formatStep.test.ts: ok');
