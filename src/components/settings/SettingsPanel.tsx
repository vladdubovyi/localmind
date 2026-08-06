import { useState, type ReactNode } from 'react';
import { Settings2, X } from 'lucide-react';
import { MODELS } from '@/models/catalog';
import type { AppSettings } from '@/types';
import { cn } from '@/utils';

interface SettingsPanelProps {
  settings: AppSettings;
  open: boolean;
  onClose: () => void;
  onChange: (partial: Partial<AppSettings>) => void;
  onReloadModel: (modelId: string) => void;
}

export function SettingsPanel({
  settings,
  open,
  onClose,
  onChange,
  onReloadModel,
}: SettingsPanelProps) {
  const [localModel, setLocalModel] = useState(settings.selectedModelId);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-ink/95 backdrop-blur-md animate-fade-up">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Settings2 size={16} className="text-accent" />
          Settings
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-muted hover:bg-panel hover:text-fg"
          aria-label="Close settings"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        <Section title="Model">
          <select
            value={localModel}
            onChange={(e) => setLocalModel(e.target.value)}
            className="w-full rounded-xl border border-border bg-panel px-3 py-2 text-sm outline-none focus:border-accent/50"
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} ({m.sizeLabel})
              </option>
            ))}
          </select>
          <button
            type="button"
            className="mt-2 w-full rounded-xl border border-border bg-panel-elevated px-3 py-2 text-xs text-fg hover:border-accent/40"
            onClick={() => {
              onChange({ selectedModelId: localModel });
              onReloadModel(localModel);
            }}
          >
            Load selected model
          </button>
        </Section>

        <Section title="Generation">
          <Slider
            label="Temperature"
            value={settings.generation.temperature}
            min={0}
            max={1.5}
            step={0.05}
            onChange={(temperature) =>
              onChange({ generation: { ...settings.generation, temperature } })
            }
          />
          <Slider
            label="Top P"
            value={settings.generation.topP}
            min={0.1}
            max={1}
            step={0.05}
            onChange={(topP) =>
              onChange({ generation: { ...settings.generation, topP } })
            }
          />
          <Slider
            label="Max tokens"
            value={settings.generation.maxTokens}
            min={128}
            max={4096}
            step={64}
            onChange={(maxTokens) =>
              onChange({ generation: { ...settings.generation, maxTokens } })
            }
          />
        </Section>

        <Section title="Privacy">
          <Toggle
            label="Memory (coming in Milestone 4)"
            checked={settings.memoryEnabled}
            disabled
            onChange={(memoryEnabled) => onChange({ memoryEnabled })}
          />
          <Toggle
            label="Auto-summarize on Ask this page"
            checked={settings.autoSummarize}
            onChange={(autoSummarize) => onChange({ autoSummarize })}
          />
          <p className="text-xs text-muted">
            Prompts, pages, and chats never leave this device. No analytics by default.
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted">{title}</h3>
      <div className="space-y-3 rounded-2xl border border-border bg-panel p-3">{children}</div>
    </section>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-fg-dim">{label}</span>
        <span className="font-mono text-muted">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-accent"
      />
    </label>
  );
}

function Toggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className={cn(
        'flex items-center justify-between gap-3 text-sm',
        disabled && 'opacity-50',
      )}
    >
      <span className="text-fg-dim">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-accent"
      />
    </label>
  );
}
