'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, LogOut, User } from 'lucide-react';
import { signOutAndLeave } from '@/lib/supabase/signOut';
import { cn } from '@/lib/utils';
import { AnimatedSidebarText } from '@/components/AnimatedSidebarText';
import { useSidebar } from '@/components/ui/sidebar';
import type { AuthUser } from '@/hooks/useAuthUser';
import { SettingsModal } from '@/components/settings';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function ProfileAvatar({ user, className }: { user: AuthUser | null; className?: string }) {
  if (user?.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- avatar comes from Supabase Storage, not a static asset next/image can optimize
      <img
        src={user.avatarUrl}
        alt=""
        className={cn('rounded-full object-cover shrink-0', className)}
      />
    );
  }
  return (
    <div
      className={cn(
        'rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center shrink-0 text-accent font-semibold',
        className
      )}
    >
      {user ? initials(user.name) : <User className="w-3.5 h-3.5" />}
    </div>
  );
}

interface ProfileMenuProps {
  user: AuthUser | null;
  onProfileUpdated?: () => void;
}

export function ProfileMenu({ user, onProfileUpdated }: ProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { open: sidebarOpen } = useSidebar();

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOutAndLeave();
    } catch {
      setIsLoggingOut(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        disabled={!user}
        title="Configuración"
        aria-label="Abrir configuración"
        className={cn(
          'w-full flex items-center rounded-lg border transition-colors disabled:opacity-60',
          sidebarOpen
            ? 'gap-3 justify-start px-3 py-2 bg-white/[0.02] hover:bg-white/[0.05] border-white/[0.04] hover:border-white/[0.08]'
            : 'gap-0 justify-center px-0 py-2 bg-transparent hover:bg-white/[0.05] border-transparent'
        )}
      >
        <ProfileAvatar user={user} className="w-7 h-7 text-2xs" />
        <motion.div
          initial={false}
          animate={{ width: sidebarOpen ? 'auto' : 0, opacity: sidebarOpen ? 1 : 0 }}
          transition={{ duration: 0.35, ease: 'easeInOut' }}
          className="overflow-hidden min-w-0"
        >
          <AnimatedSidebarText className="text-[11px] text-[#8f96a3] font-medium whitespace-nowrap truncate text-left">
            {user ? user.name : 'Cargando…'}
          </AnimatedSidebarText>
        </motion.div>
      </button>

      <button
        type="button"
        onClick={handleLogout}
        disabled={!user || isLoggingOut}
        title="Cerrar sesión"
        aria-label="Cerrar sesión"
        className={cn(
          'mt-1 w-full flex items-center rounded-lg py-2 text-[#8f96a3] hover:text-red-400 hover:bg-white/[0.04] transition-colors disabled:opacity-50',
          sidebarOpen ? 'gap-3 justify-start px-3' : 'gap-0 justify-center px-0'
        )}
      >
        <span className="w-7 flex items-center justify-center shrink-0">
          {isLoggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
        </span>
        <motion.div
          initial={false}
          animate={{ width: sidebarOpen ? 'auto' : 0, opacity: sidebarOpen ? 1 : 0 }}
          transition={{ duration: 0.35, ease: 'easeInOut' }}
          className="overflow-hidden min-w-0"
        >
          <AnimatedSidebarText className="text-[11px] font-medium whitespace-nowrap">Cerrar sesión</AnimatedSidebarText>
        </motion.div>
      </button>

      {user && (
        <SettingsModal
          user={user}
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          onSaved={onProfileUpdated}
        />
      )}
    </>
  );
}
