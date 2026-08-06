/**
 * Optional permissions for Agent mode.
 * Keep install permissions minimal; request these when Agent is enabled
 * or during optional first-run setup.
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

const BROWSER_PERMISSIONS = ['tabs'] as const;
const BROWSER_ORIGINS = ['http://*/*', 'https://*/*'] as const;
const GMAIL_PERMISSIONS = ['identity'] as const;
const GMAIL_ORIGINS = [
  'https://mail.google.com/*',
  'https://gmail.googleapis.com/*',
  'https://www.googleapis.com/*',
] as const;

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

export async function requestBrowserPermissions(): Promise<boolean> {
  try {
    return await chrome.permissions.request({
      permissions: [...BROWSER_PERMISSIONS] as chrome.runtime.ManifestPermission[],
      origins: [...BROWSER_ORIGINS],
    });
  } catch {
    return false;
  }
}

export async function requestGmailPermissions(): Promise<boolean> {
  try {
    return await chrome.permissions.request({
      permissions: [...GMAIL_PERMISSIONS] as chrome.runtime.ManifestPermission[],
      origins: [...GMAIL_ORIGINS],
    });
  } catch {
    return false;
  }
}

export async function requestDebuggerPermission(): Promise<boolean> {
  try {
    return await chrome.permissions.request({
      permissions: [...AGENT_DEBUGGER_PERMISSIONS] as chrome.runtime.ManifestPermission[],
    });
  } catch {
    return false;
  }
}

/** Request core agent permissions (tabs + hosts + identity). Optionally debugger. */
export async function requestAgentPermissions(includeDebugger = false): Promise<boolean> {
  const permissions: string[] = [...AGENT_OPTIONAL_PERMISSIONS];
  if (includeDebugger) permissions.push(...AGENT_DEBUGGER_PERMISSIONS);

  try {
    return await chrome.permissions.request({
      permissions: permissions as chrome.runtime.ManifestPermission[],
      origins: [...AGENT_OPTIONAL_HOSTS],
    });
  } catch {
    return false;
  }
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
