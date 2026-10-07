# Captaciones

Sección para revisar propiedades de dueños directos (zona oeste del GBA y Pilar) que detecta un buscador externo una vez por semana. El corredor las ve como tarjetas ordenadas por puntaje, contacta al dueño y marca el avance. Al marcar una como captada, la propiedad pasa a la Cartera Inteligente.

## Rutas

| Ruta | Auth | Uso |
|---|---|---|
| `POST /api/captaciones/import` | `Authorization: Bearer $CAPTACION_INGEST_TOKEN` | La llama el buscador. Body `{ corrida, captaciones[] }` (formato de `plinth_muestra_captaciones.json`), con un máximo de 1000. Hace upsert por `clave` y devuelve `{ recibidas, nuevas, actualizadas, rechazadas }`. |
| `GET /api/captaciones/estados?desde=<ISO>` | mismo token | `[{ clave, estado, estadoActualizadoEn }]` cambiados desde esa fecha, para que el buscador no vuelva a proponer lo descartado o cerrado. |
| `GET /api/captaciones` | sesión | Lista para la UI, ordenada por score. |
| `PATCH /api/captaciones/[id]/estado` | sesión | `{ estado, motivo? }`. Con `captado` crea o reusa un `Contact` y una `Property`, sin duplicarlos. |
| `POST /api/captaciones/[id]/telefono` | sesión | Compra el teléfono de un aviso de Zonaprop vía Apify (≈ USD 0,04). Se puede hacer una sola vez por captación: el servidor lo bloquea. |

`import` y `estados` están en `PUBLIC_PREFIXES` del middleware, con la ruta exacta. Las protege únicamente el token.

## Qué pisa y qué no pisa el import

En cada corrida se actualizan los datos del aviso (precio, score, motivo, días publicado, borrador, etc.), además de `ultimaVezVista` y `corridaId`.

Nunca se tocan `estado`, `notas`, `contactId`, `propertyId` ni `estadoActualizadoEn`. El `telefono` tampoco se pisa si se compró (`telefonoAdquiridoEn`).

## Compra de teléfono

- Actor: `memo23/zonaprop-scraper`, por `run-sync-get-dataset-items`, con `maxTotalChargeUsd=0.06`.
- Input: `{ startUrls, maxItems: 1, enrichContacts: true }`.
- Del resultado se toma `phone` y, si no viene, el primero de `phones`.
- Si no viene ninguno, se guarda `telefonoIntentadoEn` y no se puede reintentar.
- Si Apify falla, el bloqueo se libera y se puede reintentar.
- La ruta tiene `maxDuration = 120`. En Vercel Hobby hace falta Fluid compute (Settings → Functions); sin Fluid, el tope es 60 s.

## Variables de entorno

```
CAPTACION_INGEST_TOKEN=...   # compartido con el buscador
APIFY_TOKEN=...              # solo servidor
```

## Seguridad

- `descripcion`, `motivo`, `borrador_mensaje` y `anunciante` vienen de avisos de terceros. Se muestran siempre como texto plano.
- La tabla `Captacion` tiene RLS activado sin políticas, así que no queda expuesta por la Data API de Supabase. Prisma no se ve afectado.
