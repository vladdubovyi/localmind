/**
 * Deterministic research fixtures for WF-01 / WF-06 / WF-16.
 * Used when live SERP is unavailable or query matches a known harness path.
 */

export type ResearchProduct = {
  id: string;
  name: string;
  brand: string;
  priceUsd: number;
  host: string;
  url: string;
  features: string[];
  reviewScore: number;
  notes?: string;
};

export type FlightOption = {
  id: string;
  carrier: string;
  from: string;
  to: string;
  priceUsd: number;
  durationHours: number;
  stops: number;
  baggage: string;
  host: string;
  url: string;
};

/** Mechanical keyboards under $150 — intentional duplicate Keychron for dedupe. */
export const KEYBOARD_FIXTURE: ResearchProduct[] = [
  {
    id: 'keychron-c1',
    name: 'Keychron C1 Hot-Swap',
    brand: 'Keychron',
    priceUsd: 79,
    host: 'keychron.com',
    url: 'https://www.keychron.com/products/keychron-c1-hot-swappable',
    features: ['hot-swappable', 'wired', 'TKL', 'RGB'],
    reviewScore: 4.5,
    notes: 'Best value hot-swap under $100',
  },
  {
    id: 'keychron-c1-dup',
    name: 'Keychron C1 Hot-Swap Mechanical Keyboard',
    brand: 'Keychron',
    priceUsd: 79,
    host: 'amazon.com',
    url: 'https://www.amazon.com/dp/KEYCHRON-C1-DUP',
    features: ['hot-swappable', 'wired', 'TKL'],
    reviewScore: 4.4,
    notes: 'Duplicate listing of Keychron C1 (intentional harness dupe)',
  },
  {
    id: 'keychron-k2',
    name: 'Keychron K2 V2',
    brand: 'Keychron',
    priceUsd: 99,
    host: 'keychron.com',
    url: 'https://www.keychron.com/products/keychron-k2-wireless-mechanical-keyboard',
    features: ['hot-swappable', 'wireless', '75%', 'Bluetooth'],
    reviewScore: 4.6,
  },
  {
    id: 'royal-kludge-rk84',
    name: 'Royal Kludge RK84',
    brand: 'Royal Kludge',
    priceUsd: 69,
    host: 'rkroyal.com',
    url: 'https://www.rkroyal.com/products/rk84',
    features: ['hot-swappable', 'wireless', '75%', 'budget'],
    reviewScore: 4.2,
  },
  {
    id: 'leopold-fc660m',
    name: 'Leopold FC660M',
    brand: 'Leopold',
    priceUsd: 129,
    host: 'mechanicalkeyboards.com',
    url: 'https://mechanicalkeyboards.com/shop/index.php?l=product_detail&p=5467',
    features: ['soldered', 'wired', '66%', 'premium feel'],
    reviewScore: 4.7,
    notes: 'Not hot-swappable — filter or lower rank for hot-swap asks',
  },
  {
    id: 'epomaker-th80',
    name: 'Epomaker TH80',
    brand: 'Epomaker',
    priceUsd: 109,
    host: 'epomaker.com',
    url: 'https://epomaker.com/products/epomaker-th80',
    features: ['hot-swappable', 'wireless', '75%', 'gasket'],
    reviewScore: 4.5,
  },
];

export const PM_TOOLS_FIXTURE: ResearchProduct[] = [
  {
    id: 'linear',
    name: 'Linear',
    brand: 'Linear',
    priceUsd: 10,
    host: 'linear.app',
    url: 'https://linear.app',
    features: ['issue tracking', 'API', 'keyboard-first', 'startups'],
    reviewScore: 4.8,
    notes: 'Excellent GraphQL API',
  },
  {
    id: 'asana',
    name: 'Asana',
    brand: 'Asana',
    priceUsd: 11,
    host: 'asana.com',
    url: 'https://asana.com',
    features: ['tasks', 'timelines', 'API', 'teams'],
    reviewScore: 4.4,
    notes: 'Mature REST API',
  },
  {
    id: 'clickup',
    name: 'ClickUp',
    brand: 'ClickUp',
    priceUsd: 7,
    host: 'clickup.com',
    url: 'https://clickup.com',
    features: ['all-in-one', 'docs', 'API', 'custom fields'],
    reviewScore: 4.3,
    notes: 'Broad API surface; steeper learning curve',
  },
  {
    id: 'jira',
    name: 'Jira',
    brand: 'Atlassian',
    priceUsd: 8,
    host: 'atlassian.com',
    url: 'https://www.atlassian.com/software/jira',
    features: ['issue tracking', 'API', 'enterprise'],
    reviewScore: 4.1,
  },
];

/** Warsaw → Tokyo April — mix of direct and connections. */
export const FLIGHTS_FIXTURE: FlightOption[] = [
  {
    id: 'lot-direct',
    carrier: 'LOT Polish Airlines',
    from: 'Warsaw (WAW)',
    to: 'Tokyo (NRT)',
    priceUsd: 890,
    durationHours: 11.5,
    stops: 0,
    baggage: '1 checked included',
    host: 'lot.com',
    url: 'https://www.lot.com/pl/en',
  },
  {
    id: 'ana-direct',
    carrier: 'ANA',
    from: 'Warsaw (WAW)',
    to: 'Tokyo (HND)',
    priceUsd: 1120,
    durationHours: 11.2,
    stops: 0,
    baggage: '2 checked included',
    host: 'ana.co.jp',
    url: 'https://www.ana.co.jp',
  },
  {
    id: 'lufthansa-1stop',
    carrier: 'Lufthansa',
    from: 'Warsaw (WAW)',
    to: 'Tokyo (NRT)',
    priceUsd: 720,
    durationHours: 16,
    stops: 1,
    baggage: '1 checked included',
    host: 'lufthansa.com',
    url: 'https://www.lufthansa.com',
  },
  {
    id: 'qatar-1stop',
    carrier: 'Qatar Airways',
    from: 'Warsaw (WAW)',
    to: 'Tokyo (HND)',
    priceUsd: 680,
    durationHours: 18,
    stops: 1,
    baggage: '2 checked included',
    host: 'qatarairways.com',
    url: 'https://www.qatarairways.com',
  },
  {
    id: 'turkish-1stop',
    carrier: 'Turkish Airlines',
    from: 'Warsaw (WAW)',
    to: 'Tokyo (NRT)',
    priceUsd: 640,
    durationHours: 17.5,
    stops: 1,
    baggage: '1 checked included',
    host: 'turkishairlines.com',
    url: 'https://www.turkishairlines.com',
  },
];

export type FixtureKind = 'keyboard' | 'pm_tools' | 'flights' | null;

export function detectFixtureKind(query: string): FixtureKind {
  const q = query.toLowerCase();
  if (/\bmechanical keyboard\b/i.test(q) || (/\bkeyboard\b/i.test(q) && /\bhot-?swap/i.test(q))) {
    return 'keyboard';
  }
  if (
    /\b(project management|pm tools?)\b/i.test(q) ||
    (/\b(asana|linear|clickup|jira)\b/i.test(q) && /\b(tool|best|compare|api)\b/i.test(q))
  ) {
    return 'pm_tools';
  }
  if (
    (/\bflight|\bflights\b/i.test(q) || /\b(warsaw|waw).{0,40}(tokyo|nrt|hnd)\b/i.test(q)) &&
    /\b(warsaw|tokyo|april|direct)\b/i.test(q)
  ) {
    return 'flights';
  }
  return null;
}
