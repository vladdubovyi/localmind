/**
 * Optional permissions for Agent mode.
 * Keep install permissions minimal; request these when Agent is enabled
 * or during optional first-run setup.
 *
 * `tabs` is required for Phil focus tracking (always-on). Agent still requests
 * host access + identity at enable time.
 *
 * chrome.debugger cannot be an optional permission in MV3 — Chrome omits it
 * from the manifest and shows an install error if listed. Advanced debugger
 * tools are therefore unavailable unless we ever add it as a required
 * permission (which we intentionally do not).
 */

export const AGENT_OPTIONAL_PERMISSIONS = ['identity'] as const;
export const AGENT_OPTIONAL_HOSTS = [
  'http://*/*',
  'https://*/*',
  'https://mail.google.com/*',
  'https://gmail.googleapis.com/*',
  'https://www.googleapis.com/*',
] as const;

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
  /** Always false — debugger is not declarable as optional in MV3. */
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
    // tabs is a required manifest permission for Phil 1.0
    tabs: permissions.has('tabs'),
    identity: permissions.has('identity'),
    debugger: permissions.has('debugger'),
    allUrls,
  };
}

export async function requestBrowserPermissions(): Promise<boolean> {
  try {
    return await chrome.permissions.request({
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

/** Debugger cannot be requested at runtime in MV3. */
export async function requestDebuggerPermission(): Promise<boolean> {
  return false;
}

/** Request core agent permissions (hosts + identity). tabs is already required. */
export async function requestAgentPermissions(_includeDebugger = false): Promise<boolean> {
  try {
    return await chrome.permissions.request({
      permissions: [...AGENT_OPTIONAL_PERMISSIONS] as chrome.runtime.ManifestPermission[],
      origins: [...AGENT_OPTIONAL_HOSTS],
    });
  } catch {
    return false;
  }
}

export async function revokeAgentPermissions(): Promise<boolean> {
  return chrome.permissions.remove({
    permissions: [...AGENT_OPTIONAL_PERMISSIONS] as chrome.runtime.ManifestPermission[],
    origins: [...AGENT_OPTIONAL_HOSTS],
  });
}
