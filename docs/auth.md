# Auth

Login invite-only con Supabase Auth. Un solo formulario (`/login`) sirve tanto
para el primer ingreso (crea la cuenta) como para todos los siguientes
(inicia sesión) — no hay pantalla de registro separada.

## Cómo funciona

`POST /api/auth/continue` recibe `{ name, email, password }` y decide server-side:

1. Chequea `AllowedEmail` (tabla en Postgres, la misma base del CRM) — si el email no está ahí, rechaza con 403.
2. Intenta crear el usuario en Supabase Auth. Si el email es nuevo, se crea (con `email_confirm: true`, sin el paso de confirmación por mail — es una herramienta por invitación, no self-serve).
3. Si el usuario ya existía, la creación falla con "already registered" y en su lugar intenta iniciar sesión con la contraseña dada. Si es incorrecta, 401.

`src/middleware.ts` protege toda la app (incluidos los `/api/*`) excepto `/login` y `/api/auth/*` — sin sesión, redirige a `/login`.

## Autorizar un email nuevo

No hay panel de administración en la app todavía. Dos formas:

**Supabase Studio** (más simple): Table Editor → tabla `AllowedEmail` → Insert row → poné el email.

**Script rápido** (desde la raíz de `PropTool`):

```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.allowedEmail.create({ data: { email: 'nuevo@ejemplo.com' } })
  .then(() => prisma.\$disconnect());
"
```

## Bienvenida (cuentas nuevas)

Al crear una cuenta, `/api/auth/continue` le pone `user_metadata.needs_onboarding = true`.
Mientras esté en `true`, `page.tsx` muestra `WelcomeFlow` en vez de la app (una sola vez):
nombre, cómo quiere que lo llame la IA (`preferred_name`), tono de los mensajes a
clientes (`message_tone`: `cercano`/`formal`, lo usa `messageDraft.ts`), herramienta
de inicio (`start_module`) y tema. Al terminar u omitir se guarda `needs_onboarding = false`.
Las cuentas creadas antes de esto no tienen la marca, así que no la ven.

## Configuración

El chip de perfil (pie del sidebar) abre `SettingsModal`
(`src/components/settings/`), con pestañas:

- **Perfil**: foto, nombre, teléfono. Se guardan en `user_metadata`
  (`full_name`, `avatar_url`, `phone`) de Supabase Auth vía `PATCH /api/auth/profile`.
- **Seguridad**: cambio de contraseña (exige la actual), cerrar sesión y
  cerrar sesión en todos los dispositivos (`POST /api/auth/logout-all`).
- **Apariencia** y **Exportación**: preferencias del dispositivo en
  `localStorage` (`plinth-theme`, `plinth-export`), ver `src/lib/settings.ts`.
  El formato de exportación (PNG/JPG/WebP + calidad) se aplica en todas las descargas.
- **Privacidad**: restablecer preferencias locales y eliminar cuenta
  (`DELETE /api/auth/account`, exige contraseña). El email sigue en
  `AllowedEmail`, así que la persona puede volver a crear la cuenta.

## Variables de entorno (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...       # público, protegido por RLS
SUPABASE_SERVICE_ROLE_KEY=...            # SOLO servidor — nunca exponer al cliente
```

## Pendiente / fuera de alcance de esta iteración

- Panel in-app para gestionar `AllowedEmail` (hoy es Supabase Studio o el script de arriba).
- "Olvidé mi contraseña" (no hay flujo de reset — si alguien se traba, resetear la password vía Supabase Studio → Authentication → el usuario → "Reset password").
- Vincular `Contact.assignedAgent` / `Interaction.agent` al `id` real del usuario en vez de a su nombre en texto plano (hoy `CrmAssistantModule` ya pasa el nombre logueado como `agent`, pero sigue siendo texto libre, no una relación).
