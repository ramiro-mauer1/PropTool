# Auth

Login invite-only con Supabase Auth. Un solo formulario (en `/`) sirve tanto
para el primer ingreso (crea la cuenta) como para todos los siguientes
(inicia sesión) — no hay pantalla de registro separada.

## Cómo funciona

`POST /api/auth/continue` recibe `{ email, password }` y decide server-side:

1. Límite de intentos: 8 por email y 20 por IP cada 15 minutos (tabla `RateLimit`, ver `src/lib/security/rateLimit.ts`). Pasado el límite, 429.
2. Chequea `AllowedEmail` (tabla en Postgres, la misma base del CRM).
3. Intenta iniciar sesión. Si funciona, listo.
4. Si no, intenta crear la cuenta (con `email_confirm: true` y `app_metadata.plinth_access = true`). Antes rechaza contraseñas que aparecen en filtraciones públicas (Have I Been Pwned, solo viajan 5 caracteres del hash). Si el email ya tenía cuenta, la contraseña era incorrecta.

"Email no autorizado" y "contraseña incorrecta" devuelven el mismo 401 y el mismo mensaje, para que el formulario no sirva para averiguar qué emails tienen acceso.

## Acceso: sesión + `plinth_access`

Tener una sesión de Supabase **no alcanza**: la anon key es pública y cualquiera
podría registrarse directo contra Supabase Auth. El acceso es la marca
`app_metadata.plinth_access`, que solo se puede escribir con la service role:

- `/api/auth/continue` la pone al crear la cuenta.
- Un trigger en `AllowedEmail` la mantiene sincronizada: **agregar** un email
  le da acceso a la cuenta si ya existía; **borrarlo** se lo quita y cierra
  todas sus sesiones al instante. Así se revoca el acceso a alguien.

La verifican `src/middleware.ts` (toda la app; sin acceso → `/` o 401 en
`/api/*`), `requireUser()` dentro de cada route handler
(`src/lib/auth/requireUser.ts`) y `useAuthUser` en el cliente.

## Otras defensas

- **Base de datos**: RLS activo y sin permisos para `anon`/`authenticated` en
  todas las tablas de `public` — la API REST de Supabase no expone nada. La app
  usa Prisma como dueño de las tablas. Toda tabla nueva tiene que mantener esto
  (los privilegios por defecto ya están revocados, ver la migración
  `security_hardening`).
- **CSRF**: el middleware rechaza `POST/PATCH/DELETE` a `/api/*` con un
  `Origin` de otro sitio.
- **CSP con nonce** y headers de seguridad: `src/middleware.ts` y `next.config.mjs`.
  Si agregás un recurso externo (script, imagen, API llamada desde el navegador),
  hay que sumarlo a `buildCsp` o el navegador lo bloquea.
- **Topes de gasto**: compra de teléfonos (30/h por persona, 60/día en total,
  `TELEFONO_DAILY_LIMIT`), IA (120/h por persona) y búsquedas (60/h por persona).
- **Proxy de imágenes**: solo hosts de portales y solo JPEG/PNG/WebP/AVIF/GIF.
  Un portal nuevo se agrega en `ALLOWED_HOST_SUFFIXES`.

## Autorizar un email nuevo

No hay panel de administración en la app todavía. Dos formas:

**Supabase Studio** (más simple): Table Editor → tabla `AllowedEmail` → Insert row → poné el email.
Para quitarle el acceso a alguien, borrá su fila.

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
TELEFONO_DAILY_LIMIT=60                  # opcional: tope diario de compras de teléfonos
```

## Pendiente / fuera de alcance de esta iteración

- Panel in-app para gestionar `AllowedEmail` (hoy es Supabase Studio o el script de arriba).
- "Olvidé mi contraseña" (no hay flujo de reset — si alguien se traba, resetear la password vía Supabase Studio → Authentication → el usuario → "Reset password").
- Vincular `Contact.assignedAgent` / `Interaction.agent` al `id` real del usuario en vez de a su nombre en texto plano (hoy `CrmAssistantModule` ya pasa el nombre logueado como `agent`, pero sigue siendo texto libre, no una relación).
