import type { PageContext } from '@/types';

/**
 * Self-contained page extractor for chrome.scripting.executeScript.
 * Must not close over imports — Chrome serializes this function into the page.
 */
export function extractPageContextInPage(): PageContext {
  const clean = (value: string | null | undefined) =>
    (value ?? '').replace(/\s+/g, ' ').trim();

  const root =
    document.querySelector('article') ||
    document.querySelector('main') ||
    document.querySelector('[role="main"]') ||
    document.body;

  const clone = root.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll(
      [
        'script',
        'style',
        'noscript',
        'svg',
        'iframe',
        'canvas',
        'nav',
        'footer',
        'header',
        'aside',
        'form',
        'button',
        'input',
        'textarea',
        'select',
        '[role="navigation"]',
        '[role="banner"]',
        '[role="complementary"]',
        '[aria-hidden="true"]',
        '.nav',
        '.navbar',
        '.footer',
        '.sidebar',
        '.menu',
        '.ads',
        '.advertisement',
        '#cookie-banner',
      ].join(', '),
    )
    .forEach((el) => el.remove());

  const headings = Array.from(clone.querySelectorAll('h1, h2, h3, h4'))
    .map((el) => clean(el.textContent))
    .filter((t) => t.length > 1)
    .slice(0, 50);

  const paragraphs = Array.from(clone.querySelectorAll('p'))
    .map((el) => clean(el.textContent))
    .filter((t) => t.length > 40)
    .slice(0, 80);

  const lists = Array.from(clone.querySelectorAll('li'))
    .map((el) => clean(el.textContent))
    .filter((t) => t.length > 12 && t.length < 500)
    .slice(0, 80);

  const tables = Array.from(clone.querySelectorAll('table')).map((table) => {
    const rows = Array.from(table.querySelectorAll('tr'))
      .map((tr) =>
        Array.from(tr.querySelectorAll('th, td'))
          .map((cell) => clean(cell.textContent))
          .filter(Boolean)
          .join(' | '),
      )
      .filter(Boolean);
    return rows.join('\n');
  }).filter(Boolean).slice(0, 12);

  const parts: string[] = [];
  if (document.title) parts.push(`# ${clean(document.title)}`);
  if (headings.length) parts.push('## Headings\n' + headings.map((h) => `- ${h}`).join('\n'));
  if (paragraphs.length) parts.push('## Content\n' + paragraphs.join('\n\n'));
  if (lists.length) parts.push('## Lists\n' + lists.map((l) => `- ${l}`).join('\n'));
  if (tables.length) parts.push('## Tables\n' + tables.join('\n\n'));

  // Fallback: raw body text if structured extraction is thin
  let text = parts.join('\n\n');
  if (text.length < 200) {
    text = clean(clone.textContent).slice(0, 20000);
  } else {
    text = text.slice(0, 20000);
  }

  return {
    url: location.href,
    title: document.title || 'Untitled page',
    headings,
    paragraphs,
    lists,
    tables,
    text,
  };
}
