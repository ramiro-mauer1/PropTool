/**
 * Restablece la contraseña de una cuenta desde la línea de comandos.
 *
 * Existe porque la app es invite-only y no tiene flujo de "olvidé mi
 * contraseña": si el dueño pierde la suya, queda afuera sin forma de volver.
 *
 * Uso:
 *   node --env-file=.env.local scripts/reset-password.mjs <email> <contraseña>
 *
 * `--env-file` hace que Node cargue las variables en su propio proceso, igual
 * que el servidor de Next. La service role key nunca se imprime.
 */
import { createClient } from '@supabase/supabase-js';

const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.error('Uso: node --env-file=.env.local scripts/reset-password.mjs <email> <contraseña>');
  process.exit(1);
}
if (password.length < 8) {
  console.error('Error: la contraseña debe tener al menos 8 caracteres.');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error(
    'Error: faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.\n' +
      '¿Corriste el script con --env-file=.env.local?'
  );
  process.exit(1);
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const target = email.trim().toLowerCase();

// El SDK no expone búsqueda por email, así que se pagina el listado.
let user = null;
for (let page = 1; page <= 20 && !user; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
  if (error) {
    console.error('Error consultando usuarios:', error.message);
    process.exit(1);
  }
  if (data.users.length === 0) break;
  user = data.users.find((u) => u.email?.toLowerCase() === target) ?? null;
}

if (!user) {
  console.error(`No existe ninguna cuenta con el email "${email}".`);
  process.exit(1);
}

const { error } = await admin.auth.admin.updateUserById(user.id, { password });
if (error) {
  console.error('No se pudo actualizar la contraseña:', error.message);
  process.exit(1);
}

console.log(`Contraseña actualizada para ${user.email} (id ${user.id}).`);
