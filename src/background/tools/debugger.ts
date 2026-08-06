import type { ToolCall, ToolResult } from '@/agent/types';

async function resolveTabId(tabIdArg: unknown): Promise<number> {
  if (tabIdArg != null && Number.isFinite(Number(tabIdArg))) return Number(tabIdArg);
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!active?.id) throw new Error('No active tab');
  return active.id;
}

export async function executeDebuggerTools(call: ToolCall): Promise<ToolResult> {
  if (call.name !== 'debugger_snapshot') {
    return { ok: false, error: `Unknown debugger tool ${call.name}`, toolCall: call };
  }

  const tabId = await resolveTabId(call.arguments.tabId);
  const debuggee = { tabId };

  try {
    await chrome.debugger.attach(debuggee, '1.3');
    const result = await chrome.debugger.sendCommand(debuggee, 'DOM.getDocument', {
      depth: 2,
    });
    return {
      ok: true,
      data: { note: 'Attached debugger; shallow DOM root returned', result },
      toolCall: call,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      toolCall: call,
    };
  } finally {
    try {
      await chrome.debugger.detach(debuggee);
    } catch {
      // ignore
    }
  }
}
