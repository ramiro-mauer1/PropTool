'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Links } from '@/components/ui/sidebar';

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/**
 * Selector de módulo de la barra superior en móvil: una píldora con el módulo
 * actual que despliega los demás. Reemplaza al rótulo de texto suelto, que se
 * leía como un resto olvidado y no se podía tocar.
 */
export function MobileModuleSwitcher({ links }: { links: Links[] }) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const active = links.find((l) => l.active) ?? links[0];

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    // Foco al ítem activo al abrir, para navegar con teclado.
    rootRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const onMenuKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitemradio"]'));
    const i = items.indexOf(document.activeElement as HTMLElement);
    const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
    items[next]?.focus();
  };

  if (!active) return null;

  return (
    <div ref={rootRef} className="relative min-w-0">
      <motion.button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Módulo actual: ${active.label}. Cambiar de módulo`}
        whileTap={reduce ? undefined : { scale: 0.96 }}
        transition={{ duration: 0.15, ease: EASE_OUT }}
        className={cn(
          'flex items-center gap-1.5 h-8 pl-2 pr-1.5 max-w-full rounded-full border text-xs font-medium transition-colors duration-200',
          open
            ? 'bg-white/[0.08] border-white/[0.14] text-white'
            : 'bg-white/[0.04] border-white/[0.08] text-[#c4c9d2] hover:bg-white/[0.07] hover:text-white'
        )}
      >
        <span className="shrink-0 text-[#d4ff32] [&>svg]:w-3.5 [&>svg]:h-3.5">{active.icon}</span>
        {/* Al cambiar de módulo el nombre sale hacia arriba y entra el nuevo desde abajo. */}
        <span className="relative overflow-hidden min-w-0">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={active.label}
              initial={reduce ? { opacity: 0 } : { y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { y: -12, opacity: 0 }}
              transition={{ duration: 0.25, ease: EASE_OUT }}
              className="block truncate"
            >
              {active.label}
            </motion.span>
          </AnimatePresence>
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.25, ease: EASE_OUT }}
          className="shrink-0 text-[#8f96a3]"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </motion.span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            id={menuId}
            role="menu"
            aria-label="Cambiar de módulo"
            onKeyDown={onMenuKey}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: -4, transition: { duration: 0.15 } }}
            transition={{ duration: 0.22, ease: EASE_OUT }}
            style={{ transformOrigin: 'top left' }}
            className="absolute left-0 top-[calc(100%+8px)] z-50 w-60 p-1.5 rounded-xl border border-white/[0.08] bg-[#13161c]/95 backdrop-blur-md shadow-2xl shadow-black/60"
          >
            {links.map((link, i) => (
              <motion.button
                key={link.label}
                type="button"
                role="menuitemradio"
                aria-checked={!!link.active}
                onClick={() => {
                  link.onClick?.();
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
                initial={reduce ? false : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: reduce ? 0 : 0.03 * i, ease: EASE_OUT }}
                className={cn(
                  'w-full flex items-center gap-3 min-h-[44px] px-2.5 rounded-lg text-sm text-left transition-colors duration-150 focus:outline-none',
                  link.active
                    ? 'bg-white/[0.06] text-white'
                    : 'text-[#c4c9d2] hover:bg-white/[0.05] hover:text-white focus-visible:bg-white/[0.05] active:bg-white/[0.08]'
                )}
              >
                <span
                  className={cn(
                    'shrink-0 [&>svg]:w-4 [&>svg]:h-4',
                    link.active ? 'text-[#d4ff32]' : 'text-[#8f96a3]'
                  )}
                >
                  {link.icon}
                </span>
                <span className="flex-1 truncate">{link.label}</span>
                {link.badge}
                {link.active && <Check className="w-4 h-4 shrink-0 text-[#d4ff32]" />}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
