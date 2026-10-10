'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, KeyRound, Loader2, LogOut, Palette, ShieldCheck, User, X } from 'lucide-react';
import { signOutAndLeave } from '@/lib/supabase/signOut';
import { cn } from '@/lib/utils';
import type { AuthUser } from '@/hooks/useAuthUser';
import { ProfileSection } from './ProfileSection';
import { SecuritySection } from './SecuritySection';
import { AppearanceSection } from './AppearanceSection';
import { ExportSection } from './ExportSection';
import { PrivacySection } from './PrivacySection';

interface SettingsModalProps {
  user: AuthUser;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

const TABS = [
  { id: 'profile', label: 'Perfil', icon: User },
  { id: 'security', label: 'Seguridad', icon: KeyRound },
  { id: 'appearance', label: 'Apariencia', icon: Palette },
  { id: 'export', label: 'Exportación', icon: Download },
  { id: 'privacy', label: 'Privacidad', icon: ShieldCheck },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function SettingsModal({ user, isOpen, onClose, onSaved }: SettingsModalProps) {
  const [tab, setTab] = useState<TabId>('profile');
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOutAndLeave();
    } catch {
      setIsLoggingOut(false);
    }
  };

  // El menú de perfil vive dentro del cajón lateral, que en móvil es un
  // contenedor fijo con overflow oculto. Sin portal el modal quedaría recortado
  // dentro del cajón en lugar de cubrir la pantalla.
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isMounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[130] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4"
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="settings-scope bg-surface border border-border rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[88dvh] sm:h-[min(580px,88dvh)] overflow-hidden mb-[env(safe-area-inset-bottom,0px)] sm:mb-0"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-3 shrink-0">
              <h3 id="settings-title" className="text-sm font-semibold text-foreground">
                Configuración
              </h3>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="text-muted hover:text-foreground p-1.5 rounded hover:bg-surface-raised"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col sm:flex-row min-h-0 flex-1">
              <nav
                aria-label="Secciones de configuración"
                className="shrink-0 flex sm:flex-col gap-1 overflow-x-auto sm:overflow-visible border-b sm:border-b-0 sm:border-r border-border p-2 sm:w-44"
              >
                {TABS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    aria-current={tab === id ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors',
                      tab === id
                        ? 'bg-surface-raised text-foreground'
                        : 'text-secondary hover:text-foreground hover:bg-surface-raised/60'
                    )}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap text-secondary hover:text-error hover:bg-surface-raised/60 transition-colors disabled:opacity-40 sm:mt-auto"
                >
                  {isLoggingOut ? <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" /> : <LogOut className="w-3.5 h-3.5 shrink-0" />}
                  Cerrar sesión
                </button>
              </nav>

              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5">
                {tab === 'profile' && <ProfileSection user={user} onSaved={onSaved} />}
                {tab === 'security' && <SecuritySection />}
                {tab === 'appearance' && <AppearanceSection />}
                {tab === 'export' && <ExportSection />}
                {tab === 'privacy' && <PrivacySection />}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
