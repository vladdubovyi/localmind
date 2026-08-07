import { Brain } from 'lucide-react';
import { cn } from '@/utils';

interface BrandMarkProps {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  className?: string;
}

export function BrandMark({
  size = 'md',
  showWordmark = true,
  className,
}: BrandMarkProps) {
  const iconSize = size === 'lg' ? 28 : size === 'sm' ? 16 : 20;
  const textClass =
    size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-sm' : 'text-base';

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className={cn(
          'grid place-items-center rounded-xl bg-accent/15 text-accent ring-1 ring-accent/30',
          size === 'lg' ? 'h-11 w-11' : size === 'sm' ? 'h-7 w-7' : 'h-8 w-8',
        )}
      >
        <Brain size={iconSize} strokeWidth={1.75} />
      </div>
      {showWordmark && (
        <div className="leading-tight">
          <div className={cn('font-display font-semibold tracking-tight text-fg', textClass)}>
            Phil
          </div>
          {size === 'lg' && (
            <div className="text-xs text-muted">Your private personal assistant</div>
          )}
        </div>
      )}
    </div>
  );
}
