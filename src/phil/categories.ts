/**
 * Default productivity vs leisure classification by domain hostname.
 * User overrides live in PhilAssistantSettings.categoryOverrides.
 */
import type { FocusCategory } from '@/phil/types';

const PRODUCTIVE = [
  'github.com',
  'gitlab.com',
  'stackoverflow.com',
  'stackexchange.com',
  'docs.google.com',
  'notion.so',
  'linear.app',
  'figma.com',
  'atlassian.net',
  'jira.com',
  'asana.com',
  'trello.com',
  'localhost',
  'chatgpt.com',
  'claude.ai',
];

const LEISURE = [
  'instagram.com',
  'facebook.com',
  'fb.com',
  'twitter.com',
  'x.com',
  'tiktok.com',
  'reddit.com',
  'youtube.com',
  'netflix.com',
  'twitch.tv',
  'pinterest.com',
  'discord.com',
];

function hostOf(urlOrDomain: string): string {
  try {
    if (urlOrDomain.includes('://')) {
      return new URL(urlOrDomain).hostname.replace(/^www\./, '');
    }
  } catch {
    // fall through
  }
  return urlOrDomain.replace(/^www\./, '').toLowerCase();
}

function matchesList(host: string, list: string[]): boolean {
  return list.some((d) => host === d || host.endsWith(`.${d}`));
}

export function categorizeDomain(
  urlOrDomain: string,
  overrides: Record<string, FocusCategory> = {},
): FocusCategory {
  const host = hostOf(urlOrDomain);
  if (!host) return 'neutral';
  if (overrides[host]) return overrides[host];
  // Longest override suffix match
  for (const [key, cat] of Object.entries(overrides)) {
    if (host === key || host.endsWith(`.${key}`)) return cat;
  }
  if (matchesList(host, PRODUCTIVE)) return 'productive';
  if (matchesList(host, LEISURE)) return 'leisure';
  return 'neutral';
}

export function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
