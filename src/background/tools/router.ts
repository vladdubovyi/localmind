import type { ToolCall, ToolResult, ToolRisk } from '@/agent/types';
import { getTool } from '@/agent/tools';
import { getAgentPermissionState } from '@/agent/permissions';
import { executeTabTools } from '@/background/tools/tabs';
import { executePageTools } from '@/background/tools/page';
import { executeGmailTools } from '@/background/tools/gmail';
import { executePhilTools } from '@/background/tools/phil';
import { runWebResearch } from '@/background/tools/webResearch';
import { getAgentSettings } from '@/storage/agentSettings';

const PHIL_PREFIXES = [
  'focus_',
  'reminder_',
  'goal_',
  'phil_',
  'briefing_',
  'project_',
  'memory_',
] as const;

function isPhilTool(name: string): boolean {
  return name === 'web_research' || PHIL_PREFIXES.some((p) => name.startsWith(p));
}

function needsBrowserAgentPerms(name: string): boolean {
  if (name === 'web_research') return true;
  if (isPhilTool(name)) return false;
  return true;
}

function needsUserConfirm(risk: ToolRisk, confirmed: boolean): boolean {
  if (confirmed) return false;
  if (risk === 'dangerous') return true;
  return false; // moderate handled with settings below
}

function philFallbackDef(name: string): { risk: ToolRisk; confirmLabel?: string } {
  if (name === 'web_research') {
    return { risk: 'moderate', confirmLabel: 'Research the web and open result tabs' };
  }
  return { risk: 'safe' };
}

export async function routeAgentTool(
  call: ToolCall,
  confirmed = false,
): Promise<ToolResult> {
  const def = getTool(call.name);
  // Phil tools are also matched by prefix so a bundler export mismatch on
  // getTool cannot strand reminder/goal/focus calls as "Unknown tool".
  if (!def && !isPhilTool(call.name)) {
    return { ok: false, error: `Unknown tool: ${call.name}`, toolCall: call };
  }

  const settings = await getAgentSettings();
  if (!settings.enabled && !isPhilTool(call.name)) {
    return { ok: false, error: 'Agent mode is disabled in settings.', toolCall: call };
  }

  // Phil personal-assistant tools work even when the browser agent toggle is off,
  // except web_research which needs tab/page control.
  if (call.name === 'web_research' && !settings.enabled) {
    return {
      ok: false,
      error: 'Enable Agent mode to run web research (needs tab permissions).',
      toolCall: call,
    };
  }

  const risk = def?.risk ?? philFallbackDef(call.name).risk;
  const confirmLabel = def?.confirmLabel ?? philFallbackDef(call.name).confirmLabel;
  const confirmModerate = settings.confirmModerate && risk === 'moderate';
  if (needsUserConfirm(risk, confirmed) || (confirmModerate && !confirmed)) {
    return {
      ok: false,
      needsConfirm: true,
      toolCall: call,
      error: `Confirmation required for ${confirmLabel ?? call.name}`,
    };
  }

  if (needsBrowserAgentPerms(call.name)) {
    const perms = await getAgentPermissionState();
    const weatherOnly =
      call.name === 'web_research' &&
      /\b(weather|forecast|temperature)\b/i.test(String(call.arguments.query ?? ''));
    // Weather uses required host permission https://wttr.in/* — full <all_urls> not needed.
    if (!perms.tabs || (!perms.allUrls && !weatherOnly)) {
      return {
        ok: false,
        error:
          'Browser agent permissions are missing. Enable Agent mode and grant tabs + site access.',
        toolCall: call,
      };
    }
  }

  try {
    if (call.name.startsWith('tabs_')) {
      return await executeTabTools(call);
    }
    if (call.name.startsWith('page_')) {
      return await executePageTools(call);
    }
    if (call.name.startsWith('gmail_')) {
      return await executeGmailTools(call, settings);
    }
    // Static dispatch only — Chrome MV3 forbids import() in service workers.
    if (call.name === 'web_research') {
      return await runWebResearch(call);
    }
    if (isPhilTool(call.name)) {
      return await executePhilTools(call);
    }
    if (call.name.startsWith('debugger_')) {
      return {
        ok: false,
        error:
          'Debugger tools are unavailable: chrome.debugger cannot be an optional MV3 permission.',
        toolCall: call,
      };
    }
    return { ok: false, error: `Unhandled tool: ${call.name}`, toolCall: call };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      toolCall: call,
    };
  }
}
