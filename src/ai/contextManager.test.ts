/**
 * Lightweight smoke checks for the page context manager.
 * Run: npx tsx src/ai/contextManager.test.ts
 */
import {
  buildPageContextBlock,
  chunkPageContext,
  retrieveRelevantChunks,
} from './contextManager.ts';
import type { PageContext } from '../types/index.ts';

const sample: PageContext = {
  url: 'https://example.com/article',
  title: 'WebGPU Local AI',
  headings: ['Introduction', 'Performance', 'Privacy'],
  paragraphs: [
    'LocalMind runs language models inside the browser using WebGPU acceleration.',
    'The first download caches model weights so later sessions work offline.',
    'No prompts or page content are uploaded to remote servers by default.',
  ],
  lists: ['Download model', 'Ask about page', 'Summarize content'],
  tables: ['Metric | Target\nFirst token | <800ms'],
  text: 'LocalMind runs language models inside the browser using WebGPU acceleration.',
};

const chunks = chunkPageContext(sample);
console.assert(chunks.length >= 3, 'expected multiple chunks');

const relevant = retrieveRelevantChunks(chunks, 'Does it work offline?', 3);
console.assert(relevant.length > 0, 'expected retrieval results');
console.assert(
  relevant.some((c) => /offline|cache|download/i.test(c.text)),
  'expected offline-related chunk',
);

const block = buildPageContextBlock(sample, 'privacy guarantees');
console.assert(block.context.includes('WebGPU Local AI'), 'title in context');
console.assert(block.usedChunks >= 1, 'used at least one chunk');

console.log('contextManager tests passed', {
  chunks: chunks.length,
  used: block.usedChunks,
});
