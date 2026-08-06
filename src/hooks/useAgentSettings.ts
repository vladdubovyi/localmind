import { useEffect, useState } from 'react';
import type { AgentPermissionState } from '@/agent/permissions';
import { getAgentPermissionState, requestAgentPermissions } from '@/agent/permissions';
import type { AgentSettings } from '@/agent/types';
import { connectGmail, clearGmailToken } from '@/agent/gmail/api';
import { getAgentSettings, saveAgentSettings } from '@/storage/agentSettings';

export function useAgentSettings() {
  const [settings, setSettings] = useState<AgentSettings | null>(null);
  const [permissions, setPermissions] = useState<AgentPermissionState | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = async () => {
    const [s, p] = await Promise.all([getAgentSettings(), getAgentPermissionState()]);
    setSettings(s);
    setPermissions(p);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const update = async (partial: Partial<AgentSettings>) => {
    const next = await saveAgentSettings(partial);
    setSettings(next);
    return next;
  };

  const enableAgent = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const granted = await requestAgentPermissions(false);
      if (!granted) {
        setMessage('Permissions were not granted.');
        return false;
      }
      await update({ enabled: true });
      await refresh();
      setMessage('Agent mode enabled.');
      return true;
    } finally {
      setBusy(false);
    }
  };

  const disableAgent = async () => {
    await update({ enabled: false });
    setMessage('Agent mode disabled.');
  };

  const connectGmailOAuth = async () => {
    if (!settings) return;
    setBusy(true);
    setMessage(null);
    try {
      if (!settings.gmailClientId.trim()) {
        setMessage('Add a Google OAuth client ID first.');
        return;
      }
      // identity permission
      const granted = await requestAgentPermissions(false);
      if (!granted) {
        setMessage('Need identity permission for Gmail OAuth.');
        return;
      }
      await connectGmail(settings);
      setMessage('Gmail connected.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const disconnectGmail = async () => {
    await clearGmailToken();
    setMessage('Gmail token cleared.');
  };

  return {
    settings,
    permissions,
    busy,
    message,
    update,
    enableAgent,
    disableAgent,
    connectGmailOAuth,
    disconnectGmail,
    refresh,
  };
}
