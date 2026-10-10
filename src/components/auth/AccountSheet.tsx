'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Loader2, LogOut, Settings } from 'lucide-react';
import { signOutAndLeave } from '@/lib/supabase/signOut';
import { useToast } from '@/components/Toast';
import { SettingsModal } from '@/components/settings';
import type { AuthUser } from '@/hooks/useAuthUser';
import { ProfileAvatar } from './ProfileMenu';

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const ROW =
  'w-full flex items-center gap-3 min-h-[48px] px-3 rounded-xl text-sm font-medium text-left transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[#d4ff32]/60 disabled:opacity-50';

interface AccountSheetProps {
  id: string;
  user: AuthUser;
  open: boolean;
  onClose: () => void;
  onProfileUpdated?: () => void;
}

/**
 * Hoja inferior de la cuenta en celular: lo que en escritorio está al pie de
 * la barra lateral (usuario, configuración y cerrar sesión).
 */
export function AccountSheet({ id, user, open, onClose, onProfileUpdated }: AccountSheetProps) {
  const reduce = useReducedMotion();
  const { showToast } = useToast();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Escape cierra; Tab no se escapa de la hoja; al cerrar, el foco vuelve al
  // botón que la abrió.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    sheetRef.current?.querySelector<HTMLElement>('button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key !== 'Tab' || !sheetRef.current) return;
      const focusables = Array.from(sheetRef.current.querySelectorAll<HTMLElement>('button:not([disabled])'));
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus?.();
    };
  }, [open, onClose]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await signOutAndLeave();
    } catch (err) {
      setLoggingOut(false);
      showToast({
        title: 'No se pudo cerrar la sesión',
        message: err instanceof Error ? err.message : 'Probá de nuevo en un momento.',
        type: 'error',
      });
    }
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <div key="account-sheet" className="md:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onClose}
              aria-hidden
              className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-[2px]"
            />
            <motion.div
              ref={sheetRef}
              id={id}
              role="dialog"
              aria-modal="true"
              aria-labelledby={`${id}-title`}
              initial={reduce ? { opacity: 0 } : { y: '100%' }}
              animate={reduce ? { opacity: 1 } : { y: 0 }}
              exit={reduce ? { opacity: 0 } : { y: '100%' }}
              transition={{ duration: reduce ? 0.15 : 0.32, ease: EASE_OUT }}
              drag={reduce ? false : 'y'}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 80 || info.velocity.y > 500) onClose();
              }}
              className="fixed inset-x-0 bottom-0 z-[121] rounded-t-3xl border-t border-white/[0.08] bg-[#13161c] text-white shadow-2xl shadow-black/70 px-safe pt-2 pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
            >
              <div aria-hidden className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15" />

              <div className="flex items-center gap-3 px-1 pb-4">
                <ProfileAvatar user={user} className="w-11 h-11 text-sm" />
                <div className="min-w-0">
                  <p id={`${id}-title`} className="text-[15px] font-semibold text-white truncate">
                    {user.name}
                  </p>
                  {user.email && user.email !== user.name && (
                    <p className="text-xs text-[#8f96a3] truncate">{user.email}</p>
                  )}
                </div>
              </div>

              <div className="h-px bg-white/[0.08] mb-2" />

              <button
                type="button"
                onClick={() => {
                  onClose();
                  setSettingsOpen(true);
                }}
                className={`${ROW} text-[#c4c9d2] hover:bg-white/[0.05] hover:text-white active:bg-white/[0.08]`}
              >
                <Settings aria-hidden className="w-[18px] h-[18px] shrink-0 text-[#8f96a3]" />
                Configuración
              </button>

              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className={`${ROW} text-red-400 hover:bg-red-500/10 active:bg-red-500/15`}
              >
                {loggingOut ? (
                  <Loader2 aria-hidden className="w-[18px] h-[18px] shrink-0 animate-spin" />
                ) : (
                  <LogOut aria-hidden className="w-[18px] h-[18px] shrink-0" />
                )}
                {loggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <SettingsModal
        user={user}
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={onProfileUpdated}
      />
    </>
  );
}
