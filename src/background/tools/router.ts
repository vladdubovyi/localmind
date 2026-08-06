import type { ToolCall, ToolResult, ToolRisk } from '@/agent/types';
import { getTool } from '@/agent/tools';
import { getAgentPermissionState } from '@/agent/permissions';
import { executeTabTools } from '@/background/tools/tabs';
import { executePageTools } from '@/background/tools/page';
import { executeGmailTools } from '@/background/tools/gmail';
import { getAgentSettings } from '@/storage/agentSettings';

function needsUserConfirm(risk: ToolRisk, confirmed: boolean): boolean {
  if (confirmed) return false;
  if (risk === 'dangerous') return true;
  return false; // moderate handled with settings below
}

export async function routeAgentTool(
  call: ToolCall,
  confirmed = false,
): Promise<ToolResult> {
  const def = getTool(call.name);
  if (!def) {
    return { ok: false, error: `Unknown tool: ${call.name}`, toolCall: call };
  }

  const settings = await getAgentSettings();
  if (!settings.enabled) {
    return { ok: false, error: 'Agent mode is disabled in settings.', toolCall: call };
  }

  const risk = def.risk;
  const confirmModerate = settings.confirmModerate && risk === 'moderate';
  if (needsUserConfirm(risk, confirmed) || (confirmModerate && !confirmed)) {
    return {
      ok: false,
      needsConfirm: true,
      toolCall: call,
      error: `Confirmation required for ${def.confirmLabel ?? def.name}`,
    };
  }

  const perms = await getAgentPermissionState();
  if (!perms.tabs || !perms.allUrls) {
    return {
      ok: false,
      error:
        'Browser agent permissions are missing. Enable Agent mode and grant tabs + site access.',
      toolCall: call,
    };
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
