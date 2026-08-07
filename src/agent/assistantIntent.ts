import { parseAbsoluteReminder } from '../phil/deviceTime';
import { parseReminderSchedule } from '../phil/reminderSchedule';

/**
 * Lightweight intent helpers for Phil chat / agent goals.
 */

/** “Remember that …” / “Please remember …” */
export function isRememberGoal(goal: string): boolean {
  if (isForgetGoal(goal) || isRecallGoal(goal)) return false;
  return (
    /\bremember (that|this|i|my|to)\b/i.test(goal) ||
    /\bsave (this|that) (to |in )?(memory|memories)\b/i.test(goal) ||
    /^remember\b/i.test(goal.trim())
  );
}

/** “Forget …” / “Don’t remember …” */
export function isForgetGoal(goal: string): boolean {
  return (
    /\bforget (that|this|about|my|the)\b/i.test(goal) ||
    /\b(please\s+)?forget\b/i.test(goal) ||
    /\bdon'?t remember\b/i.test(goal) ||
    /\bremove (that |this )?(memory|fact)\b/i.test(goal)
  );
}

/** Recall / what did I ask you to remember */
export function isRecallGoal(goal: string): boolean {
  return (
    /\bwhat did i (ask you to )?remember\b/i.test(goal) ||
    /\bwhat do you remember\b/i.test(goal) ||
    /\brecall (what|my|the)\b/i.test(goal) ||
    /\b(search|find|list) (my )?memor(y|ies)\b/i.test(goal) ||
    /\bremembered (about|facts?)\b/i.test(goal)
  );
}

/** Best-effort fact text from “Remember that …” */
export function parseRememberText(goal: string): string {
  let t = goal.trim();
  t = t.replace(/^(please\s+)?/i, '');
  t = t.replace(/^remember\s+(that\s+|this\s+|to\s+)?/i, '');
  t = t.replace(/^save\s+(this|that)\s+(to\s+|in\s+)?(memory|memories)\s*:?\s*/i, '');
  t = t.replace(/\.$/, '').trim();
  return t || goal.trim();
}

/** Best-effort forget target from “Forget …” */
export function parseForgetText(goal: string): string {
  let t = goal.trim();
  t = t.replace(/^(please\s+)?/i, '');
  t = t.replace(/^forget\s+(that\s+|this\s+|about\s+|my\s+|the\s+)?/i, '');
  t = t.replace(/^don'?t remember\s+(that\s+|this\s+|about\s+)?/i, '');
  t = t.replace(/^remove\s+(that\s+|this\s+)?(memory|fact)\s*:?\s*/i, '');
  t = t.replace(/\.$/, '').trim();
  return t || goal.trim();
}

/** Query for recall / memory search */
export function parseRecallQuery(goal: string): string {
  let t = goal.trim();
  t = t.replace(/^(please\s+)?/i, '');
  t = t.replace(/^what did i (ask you to )?remember\s*(about\s+)?/i, '');
  t = t.replace(/^what do you remember\s*(about\s+)?/i, '');
  t = t.replace(/^recall\s+(what\s+|my\s+|the\s+)?/i, '');
  t = t.replace(/^(search|find|list)\s+(my\s+)?memor(y|ies)\s*(for\s+|about\s+)?/i, '');
  t = t.replace(/\?$/, '').trim();
  if (/^(about|for)\s+/i.test(t)) t = t.replace(/^(about|for)\s+/i, '');
  return t;
}

export function isReminderGoal(goal: string): boolean {
  return (
    /\b(remind|reminder|alarm)\b/i.test(goal) ||
    /\bevery\s+(weekday|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(
      goal,
    ) ||
    /\b(in|after)\s+\d+\s*(minutes|mins|min|hours|hour|hrs|hr)\b/i.test(goal) ||
    parseReminderSchedule(goal) != null ||
    parseAbsoluteReminder(goal) != null
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
  const schedule = parseReminderSchedule(goal);
  if (schedule) {
    const mins = Math.round((schedule.when - Date.now()) / 60_000);
    return mins >= 1 ? mins : undefined;
  }
  const absolute = parseAbsoluteReminder(goal);
  if (absolute) {
    const mins = Math.round((absolute.when - Date.now()) / 60_000);
    return mins >= 1 ? mins : undefined;
  }
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
  const schedule = parseReminderSchedule(goal);
  if (schedule?.text) return schedule.text;
  const absolute = parseAbsoluteReminder(goal);
  if (absolute?.text) return absolute.text;
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

/**
 * Long-horizon intents that should create a Persistent Project (PRJ-01),
 * not only a one-line goal. Template skills (C1) refine playbooks later.
 */
export function isProjectCreateGoal(goal: string): boolean {
  const g = goal.trim();
  if (!g) return false;
  if (/\b(remind|reminder|email|gmail|inbox)\b/i.test(g) && !/\bproject\b/i.test(g)) {
    return false;
  }
  if (/\b(create|start|set up|begin)\s+(a\s+)?(new\s+)?project\b/i.test(g)) return true;
  if (/\b(what projects|list (my )?projects|active project)\b/i.test(g)) return false;
  if (/\bwhere am i\b/i.test(g)) return false;
  if (/\b(become|get promoted|promotion to)\b.+\b(staff|principal|senior|manager)\b/i.test(g)) {
    return true;
  }
  if (/\b(staff|principal)\s+engineer\b.+\b(within|in)\s+\d+\s+(month|year)/i.test(g)) {
    return true;
  }
  if (/\b(find|land|get)\s+(a\s+)?(new\s+)?job\b/i.test(g)) return true;
  if (/\bjob hunt|job search|looking for (a )?roles?\b/i.test(g)) return true;
  if (/\b(move to|relocat|buy a house|home purchase)\b/i.test(g)) return true;
  if (/\b(research project|long[- ]term research)\b/i.test(g)) return true;
  if (
    /\b(within|in|over)\s+\d+\s+(months?|years?)\b/i.test(g) &&
    /\b(want to|plan to|goal is to|become|learn|build)\b/i.test(g)
  ) {
    return true;
  }
  return false;
}

/** Strip lead-in phrasing for a project title. */
export function parseProjectTitle(goal: string): string {
  let t = goal.trim();
  t = t.replace(/^(please\s+)?/i, '');
  t = t.replace(
    /^(create|start|set up|begin)\s+(a\s+)?(new\s+)?project\s*(to|for|:|called|named)?\s*/i,
    '',
  );
  t = t.replace(/^(i want to|i'?d like to|help me|plan to)\s+/i, '');
  t = t.replace(/\.$/, '').trim();
  if (t.length) return t.charAt(0).toUpperCase() + t.slice(1);
  return goal.trim();
}

export function isProjectListGoal(goal: string): boolean {
  return (
    /\bwhat projects\b/i.test(goal) ||
    /\blist (my )?projects\b/i.test(goal) ||
    /\bprojects am i (working|on)\b/i.test(goal) ||
    /\bactive projects?\b/i.test(goal)
  );
}

export function isProjectProgressGoal(goal: string): boolean {
  return (
    /\bwhere am i\b/i.test(goal) ||
    /\b(project )?progress\b/i.test(goal) ||
    /\bhow('?s| is) (my )?(project|.+) going\b/i.test(goal)
  );
}

/** Absolute fire time (epoch ms) when phrase uses device TZ (SET-08). */
export function parseReminderWhenMs(goal: string, now = new Date()): number | undefined {
  const schedule = parseReminderSchedule(goal, now);
  if (schedule) return schedule.when;
  const absolute = parseAbsoluteReminder(goal, now);
  if (absolute) return absolute.when;
  const mins = parseReminderInMinutes(goal);
  if (mins == null) return undefined;
  return now.getTime() + mins * 60_000;
}
