import { useCallback, useEffect, useRef, useState } from 'react';
import { getAIProvider } from '@/ai/webllm';
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
import type {
  AppSettings,
  ChatMessage,
  Conversation,
  DownloadProgress,
  PageContext,
  Role,
} from '@/types';
import { truncate, uid } from '@/utils';

export type EnginePhase =
  | 'idle'
  | 'checking'
  | 'needs_download'
  | 'cached'
  | 'downloading'
  | 'ready'
  | 'error';

export type ChatMode = 'chat' | 'page';

interface UseChatOptions {
  conversationId?: string;
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
}

export function useChat(options: UseChatOptions = {}) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [phase, setPhase] = useState<EnginePhase>('checking');
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [mode, setMode] = useState<ChatMode>('chat');
  const generatingRef = useRef(false);

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

        const meta = await getModelMeta(s.selectedModelId);
        if (cancelled) return;

        if (meta?.status === 'ready') {
          setPhase('cached');
          return;
        }

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
      setPhase('downloading');
      setError(null);
      setProgress({ progress: 0, text: 'Starting…', timeElapsed: 0 });
      await setModelMeta(id, 'downloading');

      try {
        const provider = getAIProvider();
        await provider.downloadModel(id, (p) => {
          setProgress(p);
        });
        await setModelMeta(id, 'ready');
        if (settings.selectedModelId !== id) {
          const next = { ...settings, selectedModelId: id };
          setSettings(next);
          await saveSettings(next);
        }
        setPhase('ready');
        setProgress(null);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Download failed';
        setError(message);
        await setModelMeta(id, 'error', message);
        setPhase('error');
      }
    },
    [settings],
  );

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
    mode,
    setMode,
    downloadAndLoad,
    updateSettings,
    send,
    summarizePage,
    stop,
    regenerate,
    newChat,
    setError,
    setPhase,
  };
}
