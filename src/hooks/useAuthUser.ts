import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isStartModule, messageToneFromMetadata, type MessageTone, type StartModule } from '@/lib/userPreferences';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  phone: string;
  /** Cómo quiere que lo llame la app/IA. Cae en el primer nombre si no lo eligió. */
  preferredName: string;
  messageTone: MessageTone;
  startModule: StartModule | null;
  needsOnboarding: boolean;
}

function toAuthUser(user: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null): AuthUser | null {
  if (!user) return null;
  const fullName = typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : '';
  const avatarUrl = typeof user.user_metadata?.avatar_url === 'string' ? user.user_metadata.avatar_url : null;
  const phone = typeof user.user_metadata?.phone === 'string' ? user.user_metadata.phone : '';
  const meta = user.user_metadata ?? {};
  const preferred = typeof meta.preferred_name === 'string' ? meta.preferred_name.trim() : '';
  return {
    id: user.id,
    email: user.email ?? '',
    name: fullName || user.email || 'Agente',
    avatarUrl,
    phone,
    preferredName: preferred || fullName.split(/\s+/)[0] || '',
    messageTone: messageToneFromMetadata(meta),
    startModule: isStartModule(meta.start_module) ? meta.start_module : null,
    needsOnboarding: meta.needs_onboarding === true,
  };
}

const SCREENSHOT_BYPASS = false;

export function useAuthUser() {
  const [user, setUser] = useState<AuthUser | null>(
    SCREENSHOT_BYPASS
      ? { id: 'demo-agent', email: 'demo@plinth.app', name: 'Agente Demo', avatarUrl: null, phone: '', preferredName: 'Agente', messageTone: 'cercano', startModule: null, needsOnboarding: false }
      : null,
  );
  const [isLoading, setIsLoading] = useState(!SCREENSHOT_BYPASS);

  const refresh = useCallback(async () => {
    if (SCREENSHOT_BYPASS) return;
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    setUser(toAuthUser(data.user));
  }, []);

  useEffect(() => {
    if (SCREENSHOT_BYPASS) return;
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      setUser(toAuthUser(data.user));
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setUser(null);
        return;
      }
      // El usuario de la sesión sale del JWT guardado en el navegador, y su
      // user_metadata puede estar viejo (p. ej. tras un cambio hecho desde el
      // servidor). Se pide el usuario fresco para no pisar preferencias ni la
      // marca de bienvenida pendiente. Diferido: Supabase no permite llamar a
      // la API de auth dentro del callback sin trabar el lock de sesión.
      setTimeout(() => {
        supabase.auth.getUser().then(({ data }) => setUser(toAuthUser(data.user)));
      }, 0);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, isLoading, refresh };
}
