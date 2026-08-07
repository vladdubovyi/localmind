import { useCallback, useEffect, useRef, useState } from 'react';
import { getAIProvider } from '@/ai/webllm';
import { isModelInCache } from '@/ai/modelCache';
import type { EnginePhase } from '@/ai/engineLifecycle';
import { buildPageContextBlock } from '@/ai/contextManager';
import {
  buildPageGroundedPrompt,
  buildPageSystemPrompt,
  buildSummarizePrompt,
  buildSystemPrompt,
} from '@/ai/prompts';
import {
  getConversation,
  getModelMeta,
  getSettings,
  saveConversation,
  saveSettings,
  setModelMeta,
} from '@/storage/db';
import {
  consumePendingModelLoad,
} from '@/storage/sessionIntent';
import type {
  AppSettings,
  ChatMessage,
  Conversation,
  DownloadProgress,
  PageContext,
  PendingSelectionAction,
  Role,
} from '@/types';
import { getSelectionAction, selectionActionTitle } from '@/prompts/selection';
import { truncate, uid } from '@/utils';

export type { EnginePhase };

export type ChatMode = 'chat' | 'page';

interface UseChatOptions {
  conversationId?: string;
  /** Where this hook is running — downloads/permissions are durable in sidebar */
  surface?: 'popup' | 'sidebar';
}

interface GenerateOptions {
  userDisplayContent: string;
  modelUserContent: string;
  systemPrompt: string;
  conversationBase: Conversation;
  title?: string;
  pageUrl?: string;
  pageTitle?: string;
  maxTokens?: number;
  selection?: ChatMessage['selection'];
}

export function useChat(options: UseChatOptions = {}) {
  const surface = options.surface ?? 'sidebar';
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [phase, setPhase] = useState<EnginePhase>('checking');
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [mode, setMode] = useState<ChatMode>('chat');
  const [loadingFromCache, setLoadingFromCache] = useState(false);
  const generatingRef = useRef(false);
  const autoLoadStarted = useRef(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const s = await getSettings();
        if (cancelled) return;
        setSettings(s);

        if (options.conversationId) {
          const existing = await getConversation(options.conversationId);
          if (existing && !cancelled) {
            setConversation(existing);
          }
        } else {
          setConversation({
            id: uid('conv'),
            title: 'New chat',
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        }

        const provider = getAIProvider();
        if (provider.isReady() && provider.getModelId() === s.selectedModelId) {
          setPhase('ready');
          return;
        }

        const [meta, inCache] = await Promise.all([
          getModelMeta(s.selectedModelId),
          isModelInCache(s.selectedModelId),
        ]);
        if (cancelled) return;

        // Heal desynced meta: Cache API is the source of truth after a successful download.
        if (inCache && meta?.status !== 'ready') {
          await setModelMeta(s.selectedModelId, 'ready');
        }

        if (inCache || meta?.status === 'ready') {
          setLoadingFromCache(true);
          setPhase('cached');
          return;
        }

        setLoadingFromCache(false);
        setPhase('needs_download');
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to initialize');
          setPhase('error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [options.conversationId]);

  const persistConversation = useCallback(async (next: Conversation) => {
    setConversation(next);
    await saveConversation(next);
  }, []);

  const downloadAndLoad = useCallback(
    async (modelId?: string) => {
      if (!settings) return;
      const id = modelId ?? settings.selectedModelId;

      const inCache = await isModelInCache(id);
      const meta = await getModelMeta(id);
      const fromCache = inCache || meta?.status === 'ready';
      setLoadingFromCache(fromCache);
      setPhase('downloading');
      setError(null);
      setProgress({
        progress: 0,
        text: fromCache ? 'Loading from local cache…' : 'Starting download…',
        timeElapsed: 0,
      });

      // Never clobber a known-good 'ready' flag — popup teardown used to leave
      // status stuck on 'downloading' and force a fake re-download next open.
      if (!fromCache) {
        await setModelMeta(id, 'downloading');
      }

      try {
        const provider = getAIProvider();
        await provider.downloadModel(id, (p) => {
          setProgress({
            ...p,
            text: fromCache
              ? p.text?.includes('Loading') || p.text?.includes('cache')
                ? p.text
                : `Loading from cache… ${p.text}`
              : p.text,
          });
        });
        await setModelMeta(id, 'ready');
        if (settings.selectedModelId !== id) {
          const next = { ...settings, selectedModelId: id };
          setSettings(next);
          await saveSettings(next);
        }
        setPhase('ready');
        setProgress(null);
        setLoadingFromCache(false);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Download failed';
        setError(message);
        // Keep ready meta if we were only reloading from cache and failed mid-load.
        if (!fromCache) {
          await setModelMeta(id, 'error', message);
        }
        setPhase(fromCache ? 'cached' : 'error');
      }
    },
    [settings],
  );

  // Side panel: pick up downloads/loads handed off from the popup.
  useEffect(() => {
    if (surface !== 'sidebar' || !settings) return;

    const runPendingOrAutoCache = async () => {
      const pending = await consumePendingModelLoad();
      if (pending) {
        if (pending !== settings.selectedModelId) {
          const next = { ...settings, selectedModelId: pending };
          setSettings(next);
          await saveSettings(next);
        }
        autoLoadStarted.current = true;
        await downloadAndLoad(pending);
        return;
      }
      // Auto-hydrate from cache (and start first download) in the durable side panel
      // so the Agent UI is usable immediately while the model loads in the background.
      if (
        !autoLoadStarted.current &&
        (phase === 'cached' || phase === 'needs_download')
      ) {
        autoLoadStarted.current = true;
        await downloadAndLoad(settings.selectedModelId);
      }
    };

    void runPendingOrAutoCache();

    const onStorage = (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string,
    ) => {
      if (area !== 'local' || !changes.pendingModelLoad?.newValue) return;
      void runPendingOrAutoCache();
    };
    chrome.storage.onChanged.addListener(onStorage);
    return () => chrome.storage.onChanged.removeListener(onStorage);
  }, [surface, settings, phase, downloadAndLoad]);

  const updateSettings = useCallback(async (partial: Partial<AppSettings>) => {
    setSettings((prev) => {
      if (!prev) return prev;
      const next = {
        ...prev,
        ...partial,
        generation: { ...prev.generation, ...partial.generation },
      };
      void saveSettings(next);
      return next;
    });
  }, []);

  const stop = useCallback(async () => {
    await getAIProvider().cancel();
    generatingRef.current = false;
    setIsGenerating(false);
  }, []);

  const generate = useCallback(
    async ({
      userDisplayContent,
      modelUserContent,
      systemPrompt,
      conversationBase,
      title,
      pageUrl,
      pageTitle,
      maxTokens,
      selection,
    }: GenerateOptions) => {
      if (!settings || generatingRef.current || phase !== 'ready') return;

      const userMessage: ChatMessage = {
        id: uid('msg'),
        role: 'user',
        content: userDisplayContent,
        createdAt: Date.now(),
        status: 'complete',
      };

      const assistantId = uid('msg');
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        createdAt: Date.now(),
        status: 'streaming',
        selection,
      };

      let working: Conversation = {
        ...conversationBase,
        title:
          title ??
          (conversationBase.messages.length === 0
            ? truncate(userDisplayContent, 48)
            : conversationBase.title),
        pageUrl: pageUrl ?? conversationBase.pageUrl,
        pageTitle: pageTitle ?? conversationBase.pageTitle,
        messages: [...conversationBase.messages, userMessage, assistantMessage],
        updatedAt: Date.now(),
      };
      await persistConversation(working);

      generatingRef.current = true;
      setIsGenerating(true);
      setError(null);

      try {
        const provider = getAIProvider();
        const prior = conversationBase.messages.map((m) => ({
          role: m.role as Role,
          content: m.content,
        }));

        // For page-grounded turns, send the enriched prompt only for the latest user message
        const historyForModel = [
          ...prior,
          { role: 'user' as const, content: modelUserContent },
        ];

        const full = await provider.chat(
          {
            messages: [
              { role: 'system', content: systemPrompt },
              ...historyForModel,
            ],
            temperature: settings.generation.temperature,
            topP: settings.generation.topP,
            maxTokens: maxTokens ?? settings.generation.maxTokens,
            stream: true,
          },
          (chunk) => {
            if (!chunk.content) return;
            working = {
              ...working,
              messages: working.messages.map((m) =>
                m.id === assistantId
                  ? { ...m, content: m.content + chunk.content }
                  : m,
              ),
              updatedAt: Date.now(),
            };
            setConversation(working);
          },
        );

        working = {
          ...working,
          messages: working.messages.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: full || m.content,
                  status: 'complete' as const,
                }
              : m,
          ),
          updatedAt: Date.now(),
        };
        await persistConversation(working);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Generation failed';
        working = {
          ...working,
          messages: working.messages.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: m.content || `Error: ${message}`,
                  status: 'error' as const,
                }
              : m,
          ),
          updatedAt: Date.now(),
        };
        await persistConversation(working);
        setError(message);
      } finally {
        generatingRef.current = false;
        setIsGenerating(false);
      }
    },
    [settings, phase, persistConversation],
  );

  const send = useCallback(
    async (content: string, page?: PageContext | null) => {
      if (!settings || !conversation || !content.trim()) return;
      if (phase !== 'ready') {
        setError('Model is not ready yet.');
        return;
      }

      const usePage = mode === 'page' && page;
      let modelUserContent = content.trim();
      let systemPrompt = buildSystemPrompt(settings.generation.systemPrompt);

      if (usePage) {
        const { context } = buildPageContextBlock(page, content);
        modelUserContent = buildPageGroundedPrompt(context, content.trim());
        systemPrompt = buildPageSystemPrompt(settings.generation.systemPrompt);
      }

      await generate({
        userDisplayContent: usePage
          ? `📄 ${content.trim()}`
          : content.trim(),
        modelUserContent,
        systemPrompt,
        conversationBase: conversation,
        pageUrl: page?.url,
        pageTitle: page?.title,
        title:
          conversation.messages.length === 0
            ? usePage
              ? truncate(`Ask: ${content}`, 48)
              : truncate(content, 48)
            : undefined,
      });
    },
    [settings, conversation, phase, mode, generate],
  );

  const summarizePage = useCallback(
    async (page: PageContext) => {
      if (!settings || !conversation) return;
      if (phase !== 'ready') {
        setError('Model is not ready yet.');
        return;
      }

      const { context } = buildPageContextBlock(page);
      const modelUserContent = buildSummarizePrompt(context);

      await generate({
        userDisplayContent: `Summarize this page: ${page.title}`,
        modelUserContent,
        systemPrompt: buildPageSystemPrompt(settings.generation.systemPrompt),
        conversationBase: conversation,
        pageUrl: page.url,
        pageTitle: page.title,
        title:
          conversation.messages.length === 0
            ? truncate(`Summary: ${page.title}`, 48)
            : undefined,
        maxTokens: Math.max(settings.generation.maxTokens, 1024),
      });
    },
    [settings, conversation, phase, generate],
  );

  const runSelectionAction = useCallback(
    async (pending: PendingSelectionAction) => {
      if (!settings || !conversation) return;
      if (phase !== 'ready') {
        setError('Model is not ready yet. Download / load AI first.');
        return;
      }

      const def = getSelectionAction(pending.action);
      if (!def) {
        setError(`Unknown selection action: ${pending.action}`);
        return;
      }

      const clipped = pending.text.slice(0, 8000);
      const label = selectionActionTitle(pending.action);

      await generate({
        userDisplayContent: `${label}: “${truncate(clipped, 72)}”`,
        modelUserContent: def.buildPrompt(clipped),
        systemPrompt: buildSystemPrompt(settings.generation.systemPrompt),
        conversationBase: conversation,
        pageUrl: pending.url,
        pageTitle: pending.title,
        title:
          conversation.messages.length === 0
            ? truncate(`${label}: ${clipped}`, 48)
            : undefined,
        selection: {
          action: pending.action,
          originalText: clipped,
          tabId: pending.tabId,
          canReplace: pending.canReplace && def.canReplace,
        },
      });
    },
    [settings, conversation, phase, generate],
  );

  const regenerate = useCallback(
    async (page?: PageContext | null) => {
      if (!conversation || generatingRef.current || !settings) return;
      const lastUserIdx = [...conversation.messages]
        .map((m, i) => ({ m, i }))
        .reverse()
        .find((x) => x.m.role === 'user')?.i;
      if (lastUserIdx === undefined) return;

      const lastUser = conversation.messages[lastUserIdx];
      const trimmed: Conversation = {
        ...conversation,
        messages: conversation.messages.slice(0, lastUserIdx),
        updatedAt: Date.now(),
      };
      await persistConversation(trimmed);

      const display = lastUser.content;
      const isSummary = display.startsWith('Summarize this page:');
      const question = display.replace(/^📄\s*/, '');

      if (isSummary && page) {
        const { context } = buildPageContextBlock(page);
        await generate({
          userDisplayContent: `Summarize this page: ${page.title}`,
          modelUserContent: buildSummarizePrompt(context),
          systemPrompt: buildPageSystemPrompt(settings.generation.systemPrompt),
          conversationBase: trimmed,
          pageUrl: page.url,
          pageTitle: page.title,
          maxTokens: Math.max(settings.generation.maxTokens, 1024),
        });
        return;
      }

      if ((mode === 'page' || display.startsWith('📄')) && page) {
        const { context } = buildPageContextBlock(page, question);
        await generate({
          userDisplayContent: `📄 ${question}`,
          modelUserContent: buildPageGroundedPrompt(context, question),
          systemPrompt: buildPageSystemPrompt(settings.generation.systemPrompt),
          conversationBase: trimmed,
          pageUrl: page.url,
          pageTitle: page.title,
        });
        return;
      }

      await generate({
        userDisplayContent: display,
        modelUserContent: question,
        systemPrompt: buildSystemPrompt(settings.generation.systemPrompt),
        conversationBase: trimmed,
      });
    },
    [conversation, settings, mode, persistConversation, generate],
  );

  const newChat = useCallback(() => {
    setConversation({
      id: uid('conv'),
      title: 'New chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }, []);

  return {
    settings,
    conversation,
    phase,
    progress,
    error,
    isGenerating,
    loadingFromCache,
    mode,
    setMode,
    downloadAndLoad,
    updateSettings,
    send,
    summarizePage,
    runSelectionAction,
    stop,
    regenerate,
    newChat,
    setError,
    setPhase,
  };
}
