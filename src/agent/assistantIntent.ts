/**
 * Lightweight intent helpers for Phil chat / agent goals.
 */

export function isReminderGoal(goal: string): boolean {
  return (
    /\b(remind|reminder|alarm)\b/i.test(goal) ||
    /\b(in|after)\s+\d+\s*(minutes|mins|min|hours|hour|hrs|hr)\b/i.test(goal)
  );
}

export function isGoalSetupGoal(goal: string): boolean {
  return (
    /\b(set|create|add)\s+(a\s+)?goal\b/i.test(goal) ||
    /\bmy goal (is|today)\b/i.test(goal) ||
    /\bfocus on\b/i.test(goal)
  );
}

export function isFocusStatusGoal(goal: string): boolean {
  return (
    /\b(focus|productive|leisure|time tracking|how.*(spent|wasting))\b/i.test(goal) &&
    /\b(today|summary|status|how much|report)\b/i.test(goal)
  );
}

export function isBriefingGoal(goal: string): boolean {
  return (
    /\b(briefing|what'?s up|whats up|morning overview|today'?s plan)\b/i.test(goal) ||
    /\bwhat('?s| is) (on|up) today\b/i.test(goal)
  );
}

/** Weather / forecast questions (answered via live forecast fetch). */
export function isWeatherGoal(goal: string): boolean {
  return (
    /\b(weather|forecast|temperature|humidity|air quality|uv index)\b/i.test(goal) ||
    /\b(what'?s|whats|how'?s|how is)\s+(the\s+)?(weather|forecast|temp)\b/i.test(goal)
  );
}

/** Best-effort place from “weather in X” or Phil locality setting. */
export function weatherPlaceFromQuery(query: string, locality: string): string {
  const inPlace = query.match(
    /\b(?:in|for|near|at)\s+([A-Za-z][A-Za-z\s.',-]{1,60}?)(?:\s+today|\s+tonight|\s+now|[?.!]|$)/i,
  );
  if (inPlace?.[1]) return inPlace[1].replace(/\s+/g, ' ').trim();
  return locality.trim();
}

/**
 * Questions that need live external data (weather, scores, prices…).
 * Small local models often refuse these instead of calling tools.
 */
export function isLiveInfoGoal(goal: string): boolean {
  if (/\bgmail|inbox|email\b/i.test(goal)) return false;
  return (
    isWeatherGoal(goal) ||
    /\b(stock price|share price|who won|final score|news (today|now)|current (time|price|rate|temperature))\b/i.test(
      goal,
    )
  );
}

/** Goals that should open the web (research verbs + live-info questions). */
export function isWebResearchGoal(goal: string): boolean {
  if (/\bgmail|inbox|email\b/i.test(goal)) return false;
  if (isLiveInfoGoal(goal)) return true;
  return /\b(research|find|look up|search (the )?web|compare prices|best .+ near)\b/i.test(
    goal,
  );
}

/** Model offered to browse/search instead of emitting a tool call. */
export function offersToActWithoutTools(text: string): boolean {
  return (
    /\b(would you like me to|shall i|want me to|should i|do you want me to)\b[\s\S]{0,60}\b(open|check|look|search|find|browse|visit)\b/i.test(
      text,
    ) ||
    /\b(i (can|could|will) (open|check|look up|search|find))\b/i.test(text) ||
    /\b(visit a .+ (website|site|app)|check .+ (website|site) or app)\b/i.test(text) ||
    /\b(i don'?t have (direct )?access to)\b/i.test(text)
  );
}

const TIME_UNIT = 'minutes|mins|min|hours|hour|hrs|hr';

export function parseReminderInMinutes(goal: string): number | undefined {
  const m = goal.match(
    new RegExp(`\\b(?:in|after)\\s+(\\d+)\\s*(${TIME_UNIT})\\b`, 'i'),
  );
  if (!m) return undefined;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 1) return undefined;
  const unit = m[2].toLowerCase();
  if (unit.startsWith('hour') || unit.startsWith('hr')) return n * 60;
  return n;
}

/** Best-effort reminder body from natural language. */
export function parseReminderText(goal: string): string {
  let t = goal.trim();
  t = t.replace(/^(please\s+)?(can you\s+)?/i, '');
  t = t.replace(
    /^(remind\s+me|set(\s+up)?\s+(a\s+)?reminder|ping\s+me|alarm\s+me)\s*/i,
    '',
  );
  t = t.replace(
    new RegExp(`^(in|after)\\s+\\d+\\s*(${TIME_UNIT})\\s*(to\\s+|that\\s+)?`, 'i'),
    '',
  );
  t = t.replace(
    new RegExp(`\\s+(in|after)\\s+\\d+\\s*(${TIME_UNIT})\\.?$`, 'i'),
    '',
  );
  t = t.replace(/^(to|that|about)\s+/i, '');
  t = t.replace(/\.$/, '').trim();
  return t || goal.trim();
}

/** Best-effort goal title from “set a goal …” phrasing. */
export function parseGoalTitle(goal: string): string {
  let t = goal.trim();
  t = t.replace(/^(please\s+)?/i, '');
  t = t.replace(/^(set|create|add)\s+(a\s+)?goal\s*(to|for|:)?\s*/i, '');
  t = t.replace(/^my goal (is|today)\s*(to|:)?\s*/i, '');
  t = t.replace(/^focus on\s+/i, '');
  t = t.replace(/\.$/, '').trim();
  return t || goal.trim();
}
