'use client';

import { useEffect, useId, useRef } from 'react';
import { motion, useDragControls, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import type { CaptacionDTO } from '@/types/captaciones';
import type { CompraTelefonoResultado } from '@/hooks/useCaptaciones';
import { formatPrecio } from '../format';
import { ContactarPanel, useContactar } from '../ContactarPanel';
import { atraparFoco } from './foco';

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

interface HojaContactoProps {
  captacion: CaptacionDTO;
  agentName: string | null;
  comprando: boolean;
  onAdquirirTelefono: () => Promise<CompraTelefonoResultado>;
  /** Copió el mensaje o lo mandó por WhatsApp. */
  onEnviado: () => void;
  onCerrar: () => void;
}

/** Bottom sheet con el flujo de "Contactar" de la tarjeta. Se cierra arrastrando hacia abajo. */
export function HojaContacto({ captacion: c, agentName, comprando, onAdquirirTelefono, onEnviado, onCerrar }: HojaContactoProps) {
  const id = useId();
  const reduce = useReducedMotion();
  const drag = useDragControls();
  const ref = useRef<HTMLDivElement>(null);
  const contacto = useContactar({ captacion: c, agentName, abierto: true, onAdquirirTelefono, onEnviado });
  const dueno = c.anunciante?.trim() || null;
  const precio = formatPrecio(c.precio, c.moneda);

  const onCerrarRef = useRef(onCerrar);
  onCerrarRef.current = onCerrar;
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCerrarRef.current();
      }
      if (ref.current) atraparFoco(e, ref.current);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus?.();
    };
  }, []);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onCerrar}
        aria-hidden
        className="fixed inset-0 z-[170] bg-black/60 backdrop-blur-[2px]"
      />
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-titulo`}
        tabIndex={-1}
        initial={reduce ? { opacity: 0 } : { y: '100%' }}
        animate={reduce ? { opacity: 1 } : { y: 0 }}
        exit={reduce ? { opacity: 0 } : { y: '100%' }}
        transition={{ duration: reduce ? 0.15 : 0.32, ease: EASE_OUT }}
        drag={reduce ? false : 'y'}
        dragControls={drag}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 100 || info.velocity.y > 500) onCerrar();
        }}
        className="fixed inset-x-0 bottom-0 z-[171] mx-auto flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-3xl border-t border-border bg-surface-overlay text-foreground shadow-2xl shadow-black/60 outline-none"
      >
        {/* Asa y encabezado: desde acá se arrastra para cerrar. */}
        <div onPointerDown={(e) => drag.start(e)} className="shrink-0 touch-none cursor-grab px-4 pt-2 pb-3 active:cursor-grabbing">
          <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p id={`${id}-titulo`} className="text-[15px] font-semibold text-foreground truncate">
                {dueno ? `Contactar a ${dueno}` : 'Contactar al dueño'}
              </p>
              <p className="text-xs text-secondary truncate tabular-nums">
                {[precio, c.localidad].filter(Boolean).join(' · ')}
              </p>
            </div>
            <button
              type="button"
              onClick={onCerrar}
              aria-label="Cerrar y seguir revisando"
              className="btn-tactile focus-ring -mr-1.5 -mt-1 inline-flex w-11 h-11 shrink-0 items-center justify-center rounded-subtle text-secondary hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-3">
          <ContactarPanel captacion={c} comprando={comprando} control={contacto} />
        </div>

        <div className="shrink-0 border-t border-border px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
          <button
            type="button"
            onClick={onCerrar}
            className="btn-tactile focus-ring w-full min-h-[48px] rounded-card border border-border bg-surface-raised text-sm font-medium text-foreground hover:border-border-hover"
          >
            Seguir con la próxima
          </button>
        </div>
      </motion.div>
    </>
  );
}
