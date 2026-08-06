import type { SelectionAction } from '@/types';

export interface SelectionActionDef {
  id: SelectionAction;
  label: string;
  shortLabel: string;
  description: string;
  /** If true, result can replace the original selection on the page. */
  canReplace: boolean;
  buildPrompt: (text: string) => string;
}

export const SELECTION_ACTIONS: SelectionActionDef[] = [
  {
    id: 'explain',
    label: 'Explain',
    shortLabel: 'Explain',
    description: 'Clarify what the selected text means.',
    canReplace: false,
    buildPrompt: (text) =>
      [
        'Explain the following text clearly and precisely.',
        'Cover the main idea, important details, and any jargon.',
        '',
        '--- SELECTED TEXT ---',
        text,
        '--- END ---',
      ].join('\n'),
  },
  {
    id: 'summarize',
    label: 'Summarize',
    shortLabel: 'Summary',
    description: 'Short summary of the selection.',
    canReplace: false,
    buildPrompt: (text) =>
      [
        'Summarize the following text in a few concise sentences or bullets.',
        '',
        '--- SELECTED TEXT ---',
        text,
        '--- END ---',
      ].join('\n'),
  },
  {
    id: 'rewrite',
    label: 'Rewrite',
    shortLabel: 'Rewrite',
    description: 'Rewrite with the same meaning, clearer phrasing.',
    canReplace: true,
    buildPrompt: (text) =>
      [
        'Rewrite the following text to be clearer and more natural.',
        'Preserve meaning and approximate length.',
        'Return ONLY the rewritten text — no preamble or quotes.',
        '',
        '--- SELECTED TEXT ---',
        text,
        '--- END ---',
      ].join('\n'),
  },
  {
    id: 'translate',
    label: 'Translate',
    shortLabel: 'Translate',
    description: 'Translate to clear English.',
    canReplace: true,
    buildPrompt: (text) =>
      [
        'Translate the following text into clear, natural English.',
        'If it is already English, refine wording slightly for clarity.',
        'Return ONLY the translation — no preamble.',
        '',
        '--- SELECTED TEXT ---',
        text,
        '--- END ---',
      ].join('\n'),
  },
  {
    id: 'eli5',
    label: "ELI5",
    shortLabel: 'ELI5',
    description: "Explain like I'm five.",
    canReplace: false,
    buildPrompt: (text) =>
      [
        "Explain the following like I'm five years old.",
        'Use simple words and a friendly tone.',
        '',
        '--- SELECTED TEXT ---',
        text,
        '--- END ---',
      ].join('\n'),
  },
  {
    id: 'improve',
    label: 'Improve',
    shortLabel: 'Improve',
    description: 'Improve grammar and clarity.',
    canReplace: true,
    buildPrompt: (text) =>
      [
        'Improve grammar, clarity, and flow of the following text.',
        'Preserve the original meaning and voice.',
        'Return ONLY the improved text — no preamble or quotes.',
        '',
        '--- SELECTED TEXT ---',
        text,
        '--- END ---',
      ].join('\n'),
  },
];

export function getSelectionAction(id: string): SelectionActionDef | undefined {
  return SELECTION_ACTIONS.find((a) => a.id === id);
}

export function selectionActionTitle(id: SelectionAction): string {
  return getSelectionAction(id)?.label ?? id;
}
