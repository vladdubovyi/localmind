/**
 * Lightweight intent helpers for Phil chat / agent goals.
 */

export function isReminderGoal(goal: string): boolean {
  return (
    /\b(remind|reminder|alarm)\b/i.test(goal) ||
    /\b(in|after)\s+\d+\s*(min|mins|minutes|hour|hours|hr|hrs)\b/i.test(goal)
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

export function isWebResearchGoal(goal: string): boolean {
  return (
    /\b(research|find|look up|search (the )?web|compare prices|best .+ near)\b/i.test(goal) &&
    !/\bgmail|inbox|email\b/i.test(goal)
  );
}

export function parseReminderInMinutes(goal: string): number | undefined {
  const m = goal.match(
    /\b(?:in|after)\s+(\d+)\s*(min|mins|minutes|hour|hours|hr|hrs)\b/i,
  );
  if (!m) return undefined;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 1) return undefined;
  const unit = m[2].toLowerCase();
  if (unit.startsWith('hour') || unit.startsWith('hr')) return n * 60;
  return n;
}
