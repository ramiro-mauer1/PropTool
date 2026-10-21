import { useCallback, useEffect, useState } from 'react';
import { isAuthRetryableFetchError } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { hasAppAccess, isAppOwner } from '@/lib/auth/access';
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
  /** Puede aprobar solicitudes de acceso. Solo decide qué se muestra: el servidor lo vuelve a chequear. */
  isOwner: boolean;
}

function toAuthUser(
  user: { id: string; email?: string; app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> } | null
): AuthUser | null {
  // A session without the access flag (sign-up that bypassed the allowlist)
  // shows the login, same as no session. The server enforces this anyway.
  if (!user || !hasAppAccess(user)) return null;
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
    // Hasta que la complete u omita (needs_onboarding: false). Antes solo la
    // veían las cuentas creadas por invitación con la marca en true; las que
    // entraban por otro camino se la salteaban.
    needsOnboarding: meta.needs_onboarding !== false,
    isOwner: isAppOwner(user),
  };
}

const SCREENSHOT_BYPASS = false;

export function useAuthUser() {
  const [user, setUser] = useState<AuthUser | null>(
    SCREENSHOT_BYPASS
      ? { id: 'demo-agent', email: 'demo@plinth.app', name: 'Agente Demo', avatarUrl: null, phone: '', preferredName: 'Agente', messageTone: 'cercano', startModule: null, needsOnboarding: false, isOwner: false }
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
    let confirmado = false;
    let mostrado = false;

    // Primero la sesión guardada en el navegador: no viaja a Supabase (salvo
    // que el token haya vencido), así al abrir la app se ve la sección en vez
    // de esperar la red. Solo decide qué se dibuja: los datos los protege el
    // servidor en cada pedido. Si con esa sesión no se entra directo (sin
    // acceso, bienvenida pendiente) se espera a Supabase, como antes.
    supabase.auth.getSession().then(({ data }) => {
      const guardado = toAuthUser(data.session?.user ?? null);
      if (confirmado || !guardado || guardado.needsOnboarding) return;
      mostrado = true;
      setUser(guardado);
      setIsLoading(false);
    });

    // Después, el usuario confirmado por Supabase y con la metadata al día:
    // corrige lo anterior (sesión cerrada desde otro equipo, preferencias nuevas).
    supabase.auth.getUser().then(({ data, error }) => {
      confirmado = true;
      // Sin conexión no hay con qué corregir: sigue la sesión guardada.
      if (mostrado && isAuthRetryableFetchError(error)) return;
      setUser(toAuthUser(data.user));
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // La carga inicial ya la cubren las dos consultas de arriba.
      if (event === 'INITIAL_SESSION') return;
      if (!session) {
        setUser(null);
        return;
      }
      // Al arrancar, Supabase avisa SIGNED_IN (o TOKEN_REFRESHED): hasta que
      // vuelva la consulta inicial, ella ya trae el usuario fresco.
      if (!confirmado) return;
      // El usuario de la sesión sale del JWT guardado en el navegador, y su
      // user_metadata puede estar viejo (p. ej. tras un cambio hecho desde el
      // servidor). Se pide el usuario fresco para no pisar preferencias ni la
      // marca de bienvenida pendiente. Diferido: Supabase no permite llamar a
      // la API de auth dentro del callback sin trabar el lock de sesión.
      setTimeout(() => {
        supabase.auth.getUser().then(({ data, error }) => {
          // Un corte de red no es un cierre de sesión.
          if (isAuthRetryableFetchError(error)) return;
          setUser(toAuthUser(data.user));
        });
      }, 0);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, isLoading, refresh };
}
