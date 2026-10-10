import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const inputClass =
  'w-full rounded-subtle border border-border-subtle bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent disabled:text-muted disabled:cursor-not-allowed';

export const primaryButtonClass =
  'flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-accent text-zinc-950 text-xs font-semibold shadow-subtle hover:bg-accent-hover transition-colors active:scale-[0.98] disabled:opacity-40';

export const secondaryButtonClass =
  'flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-medium text-secondary hover:text-foreground hover:border-border-hover transition-colors disabled:opacity-40';

export function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="space-y-0.5">
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      {description && <p className="text-xs text-muted">{description}</p>}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-2xs font-semibold text-secondary uppercase tracking-wide">{label}</span>
      {children}
      {hint && <span className="block text-2xs text-muted">{hint}</span>}
    </label>
  );
}

export function Status({ error, success }: { error?: string | null; success?: string | null }) {
  if (error) {
    return (
      <p role="alert" className="text-xs text-error bg-error-muted/20 border border-error/30 rounded-subtle px-3 py-2">
        {error}
      </p>
    );
  }
  if (success) return <p className="text-xs text-[color:var(--cap-accent-ink)]">{success}</p>;
  return null;
}

/** Selector segmentado para opciones cortas (tema, formato…). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string; icon?: ReactNode }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-flow-col auto-cols-fr gap-1 p-1 rounded-lg bg-background border border-border-subtle">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors',
            value === o.value
              ? 'bg-accent/15 text-[color:var(--cap-accent-ink)] border border-accent/30'
              : 'text-secondary hover:text-foreground border border-transparent'
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}
