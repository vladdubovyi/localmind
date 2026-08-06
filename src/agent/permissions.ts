/**
 * Optional permissions for Agent mode.
 * Keep install permissions minimal; request these when Agent is enabled.
 */

export const AGENT_OPTIONAL_PERMISSIONS = ['tabs', 'identity'] as const;
export const AGENT_OPTIONAL_HOSTS = [
  'http://*/*',
  'https://*/*',
  'https://mail.google.com/*',
  'https://gmail.googleapis.com/*',
  'https://www.googleapis.com/*',
] as const;

export const AGENT_DEBUGGER_PERMISSIONS = ['debugger'] as const;

export interface AgentPermissionState {
  tabs: boolean;
  identity: boolean;
  debugger: boolean;
  allUrls: boolean;
}

export async function getAgentPermissionState(): Promise<AgentPermissionState> {
  const perms = await chrome.permissions.getAll();
  const permissions = new Set(perms.permissions ?? []);
  const origins = perms.origins ?? [];
  const allUrls = origins.some(
    (o) => o === '<all_urls>' || o === 'http://*/*' || o === '*://*/*' || o === 'https://*/*',
  );
  return {
    tabs: permissions.has('tabs'),
    identity: permissions.has('identity'),
    debugger: permissions.has('debugger'),
    allUrls,
  };
}

export async function requestAgentPermissions(includeDebugger = false): Promise<boolean> {
  const permissions: string[] = [...AGENT_OPTIONAL_PERMISSIONS];
  if (includeDebugger) permissions.push(...AGENT_DEBUGGER_PERMISSIONS);

  return chrome.permissions.request({
    permissions: permissions as chrome.runtime.ManifestPermission[],
    origins: [...AGENT_OPTIONAL_HOSTS],
  });
}

export async function revokeAgentPermissions(): Promise<boolean> {
  return chrome.permissions.remove({
    permissions: [
      ...AGENT_OPTIONAL_PERMISSIONS,
      ...AGENT_DEBUGGER_PERMISSIONS,
    ] as chrome.runtime.ManifestPermission[],
    origins: [...AGENT_OPTIONAL_HOSTS],
  });
}
