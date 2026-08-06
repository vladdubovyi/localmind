/**
 * Built-in prompt library (Milestone 3+ wiring).
 */
export interface PromptTemplate {
  id: string;
  title: string;
  description: string;
  template: string;
}

export const PROMPT_LIBRARY: PromptTemplate[] = [
  {
    id: 'eli5',
    title: "Explain like I'm five",
    description: 'Simplify any topic for a beginner.',
    template: "Explain the following like I'm five years old:\n\n{{text}}",
  },
  {
    id: 'summarize',
    title: 'Summarize',
    description: 'Concise summary with key points.',
    template: 'Summarize the following clearly and briefly:\n\n{{text}}',
  },
  {
    id: 'risks',
    title: 'Find risks',
    description: 'Surface risks, caveats, and failure modes.',
    template: 'Identify risks, caveats, and potential issues in:\n\n{{text}}',
  },
  {
    id: 'todos',
    title: 'Extract todos',
    description: 'Pull actionable tasks from text.',
    template: 'Extract a checklist of actionable todos from:\n\n{{text}}',
  },
  {
    id: 'quiz',
    title: 'Generate quiz',
    description: 'Create questions to test understanding.',
    template: 'Generate a short quiz (5 questions) about:\n\n{{text}}',
  },
  {
    id: 'translate',
    title: 'Translate',
    description: 'Translate to clear English (or target language).',
    template: 'Translate the following to clear English:\n\n{{text}}',
  },
  {
    id: 'grammar',
    title: 'Improve grammar',
    description: 'Polish grammar while preserving meaning.',
    template: 'Improve grammar and clarity without changing meaning:\n\n{{text}}',
  },
];

export function fillPrompt(template: string, text: string): string {
  return template.replaceAll('{{text}}', text);
}
