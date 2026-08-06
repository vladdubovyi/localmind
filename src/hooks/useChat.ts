import { useCallback, useEffect, useRef, useState } from 'react';
import { getAIProvider } from '@/ai/webllm';
import { buildSystemPrompt } from '@/ai/prompts';
import {
  getConversation,
  getModelMeta,
  getSettings,
  saveConversation,
  saveSettings,
  setModelMeta,
} from '@/storage/db';
import type { AppSettings, ChatMessage, Conversation, DownloadProgress } from '@/types';
import { truncate, uid } from '@/utils';

export type EnginePhase =
  | 'idle'
  | 'checking'
  | 'needs_download'
  | 'cached'
  | 'downloading'
  | 'ready'
  | 'error';

interface UseChatOptions {
  conversationId?: string;
}

export function useChat(options: UseChatOptions = {}) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [phase, setPhase] = useState<EnginePhase>('checking');
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
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

        // Previously downloaded — show load CTA (WebLLM serves from browser cache).
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

  const send = useCallback(
    async (content: string) => {
      if (!settings || !conversation || !content.trim() || generatingRef.current) return;
      if (phase !== 'ready') {
        setError('Model is not ready yet.');
        return;
      }

      const userMessage: ChatMessage = {
        id: uid('msg'),
        role: 'user',
        content: content.trim(),
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

      const title =
        conversation.messages.length === 0
          ? truncate(content, 48)
          : conversation.title;

      let working: Conversation = {
        ...conversation,
        title,
        messages: [...conversation.messages, userMessage, assistantMessage],
        updatedAt: Date.now(),
      };
      await persistConversation(working);

      generatingRef.current = true;
      setIsGenerating(true);
      setError(null);

      try {
        const provider = getAIProvider();
        const history = working.messages
          .filter((m) => m.id !== assistantId)
          .map((m) => ({ role: m.role, content: m.content }));

        const full = await provider.chat(
          {
            messages: [
              {
                role: 'system',
                content: buildSystemPrompt(settings.generation.systemPrompt),
              },
              ...history,
            ],
            temperature: settings.generation.temperature,
            topP: settings.generation.topP,
            maxTokens: settings.generation.maxTokens,
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
    [settings, conversation, phase, persistConversation],
  );

  const regenerate = useCallback(async () => {
    if (!conversation || generatingRef.current) return;
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
    // send() reads conversation from state; schedule after state flush via microtask content pass
    // Direct generation with trimmed history to avoid stale closure:
    if (phase !== 'ready' || !settings) return;

    const userMessage: ChatMessage = {
      id: uid('msg'),
      role: 'user',
      content: lastUser.content,
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
      ...trimmed,
      messages: [...trimmed.messages, userMessage, assistantMessage],
      updatedAt: Date.now(),
    };
    await persistConversation(working);

    generatingRef.current = true;
    setIsGenerating(true);
    setError(null);

    try {
      const provider = getAIProvider();
      const history = working.messages
        .filter((m) => m.id !== assistantId)
        .map((m) => ({ role: m.role, content: m.content }));

      const full = await provider.chat(
        {
          messages: [
            {
              role: 'system',
              content: buildSystemPrompt(settings.generation.systemPrompt),
            },
            ...history,
          ],
          temperature: settings.generation.temperature,
          topP: settings.generation.topP,
          maxTokens: settings.generation.maxTokens,
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
            ? { ...m, content: full || m.content, status: 'complete' as const }
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
  }, [conversation, phase, settings, persistConversation]);

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
    downloadAndLoad,
    updateSettings,
    send,
    stop,
    regenerate,
    newChat,
    setError,
    setPhase,
  };
}
