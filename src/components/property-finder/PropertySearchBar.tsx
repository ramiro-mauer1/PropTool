'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Search, Loader2, X, CornerDownLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PropertySearchBarProps {
  onSearch: (query: string) => void;
  onReset: () => void;
  isLoading: boolean;
  className?: string;
}

const EXAMPLE_QUERIES = [
  'monoambiente en Ramos Mejía, dueño directo',
  'PH 3 ambientes en Palermo hasta USD 250k',
  'departamento 2 amb en Flores, sin comisión',
  'casa en Don Torcuato, venta',
  'local comercial en San Isidro, alquiler',
];

export function PropertySearchBar({
  onSearch,
  onReset,
  isLoading,
  className,
}: PropertySearchBarProps) {
  const [value, setValue] = useState('');
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Rotate placeholder examples
  useEffect(() => {
    if (isLoading) return;
    const id = setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % EXAMPLE_QUERIES.length);
    }, 4000);
    return () => clearInterval(id);
  }, [isLoading]);

  // Auto-resize textarea
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setValue(e.target.value);
      const el = e.target;
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    },
    []
  );

  const handleSubmit = useCallback(() => {
    const q = value.trim();
    if (!q || isLoading) return;
    onSearch(q);
  }, [value, isLoading, onSearch]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === 'Escape') {
        setValue('');
        onReset();
      }
    },
    [handleSubmit, onReset]
  );

  const handleClear = useCallback(() => {
    setValue('');
    onReset();
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.focus();
    }
  }, [onReset]);

  const handleExampleClick = useCallback(
    (example: string) => {
      setValue(example);
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(
          textareaRef.current.scrollHeight,
          120
        )}px`;
      }
    },
    []
  );

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Main input */}
      <div
        className={cn(
          'relative flex items-start gap-3 bg-surface border rounded-panel px-4 py-3.5 transition-all duration-200 ease-expo-out',
          isLoading
            ? 'border-accent/30 bg-surface-raised'
            : 'border-border hover:border-border-hover focus-within:border-border-hover'
        )}
      >
        {/* Icon */}
        <div className="mt-0.5 flex-shrink-0">
          {isLoading ? (
            <Loader2 className="w-5 h-5 text-accent animate-spin" />
          ) : (
            <Search className="w-5 h-5 text-secondary" />
          )}
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          rows={1}
          placeholder={
            isLoading ? 'Buscando...' : EXAMPLE_QUERIES[placeholderIdx]
          }
          className={cn(
            'flex-1 bg-transparent resize-none outline-none border-none text-sm leading-relaxed text-foreground placeholder:text-muted font-sans focus-ring overflow-hidden min-h-[20px]',
            isLoading && 'opacity-60 cursor-wait'
          )}
          style={{ lineHeight: '1.5' }}
        />

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
          {value && !isLoading && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-subtle text-muted hover:text-secondary hover:bg-surface-raised transition-colors focus-ring"
              title="Limpiar búsqueda (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!value.trim() || isLoading}
            className={cn(
              'btn-tactile flex items-center gap-1.5 px-3 py-1.5 rounded-subtle text-xs font-semibold transition-all focus-ring',
              value.trim() && !isLoading
                ? 'bg-accent text-[#08090a] hover:bg-accent-hover shadow-subtle'
                : 'bg-surface-raised text-muted cursor-not-allowed opacity-50'
            )}
            title="Buscar (Enter o ⌘↵)"
          >
            <span>Buscar</span>
            <CornerDownLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Quick example chips */}
      {!isLoading && !value && (
        <div className="flex flex-wrap gap-2">
          <span className="text-2xs text-muted self-center">Ejemplos:</span>
          {EXAMPLE_QUERIES.slice(0, 3).map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => handleExampleClick(ex)}
              className="text-2xs px-2.5 py-1 rounded-full border border-border hover:border-border-hover bg-surface hover:bg-surface-raised text-secondary hover:text-foreground transition-all duration-150 focus-ring"
            >
              {ex}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
