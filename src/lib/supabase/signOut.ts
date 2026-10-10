import { createClient } from './client';

/**
 * Cierra la sesión (`local`: este dispositivo, `global`: todos) y vuelve al login.
 * Tira error si el servidor no pudo revocar la sesión.
 */
export async function signOutAndLeave(scope: 'local' | 'global' = 'local') {
  const res = await fetch(scope === 'global' ? '/api/auth/logout-all' : '/api/auth/logout', { method: 'POST' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudo cerrar la sesión.');
  }
  // El route handler revoca la sesión, pero el cliente del navegador guarda su
  // propia copia de las cookies: sin este segundo signOut el middleware puede
  // llegar a ver una sesión todavía válida en la navegación siguiente.
  await createClient().auth.signOut({ scope: 'local' });
  // El login vive en `/` (AppShell lo muestra cuando no hay sesión); no hay
  // ruta `/login`. `replace` evita que "atrás" vuelva a la app ya cerrada.
  window.location.replace('/');
}
