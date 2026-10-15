import type { User } from '@supabase/supabase-js';

// Historial de cambios de una captación (tabla CaptacionEvento).

/** De dónde vino el cambio. Solo describe la pantalla: nunca identifica a nadie. */
export const ORIGENES_APP = ['app', 'revisar'] as const;
export type OrigenApp = (typeof ORIGENES_APP)[number];

/** El navegador puede decir desde qué pantalla cambió; cualquier otra cosa cuenta como "app". */
export function origenDesdeBody(v: unknown): OrigenApp {
  return typeof v === 'string' && (ORIGENES_APP as readonly string[]).includes(v) ? (v as OrigenApp) : 'app';
}

export interface Autor {
  usuarioId: string;
  usuarioEmail: string | null;
  usuarioNombre: string | null;
}

/**
 * Quién hizo el cambio, siempre a partir del usuario de la sesión del servidor
 * (requireUser). El body de la request nunca se usa para esto: así nadie puede
 * registrar un cambio a nombre de otro.
 */
export function autorDeSesion(user: Pick<User, 'id' | 'email' | 'user_metadata'>): Autor {
  const nombre = user.user_metadata?.full_name;
  return {
    usuarioId: user.id,
    usuarioEmail: user.email?.trim() || null,
    usuarioNombre: typeof nombre === 'string' && nombre.trim() ? nombre.trim() : null,
  };
}
