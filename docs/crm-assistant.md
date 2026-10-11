# Cartera Inteligente — Asistente CRM con IA

Feature nueva: el agente escribe o dicta en lenguaje natural una interacción
con un cliente y el sistema extrae los datos, los vincula a un contacto y una
propiedad, se los muestra para confirmar, y al confirmar actualiza el lead y
crea una tarea de seguimiento con mensaje sugerido.

Vive en la pestaña **Cartera Inteligente** del sidebar (`activeModule ===
"crm"` en `src/app/page.tsx`). No toca nada del módulo `property-finder`
(actualmente apagado, a trabajarse aparte).

## Setup

Necesitás una base Postgres (local, [Neon](https://neon.tech), Supabase,
etc.). Configurá `DATABASE_URL` en `.env` (ya gitignored) y corré las
migraciones:

```bash
# .env
DATABASE_URL="postgresql://user:password@host:5432/db?schema=public"
```

```bash
npm run prisma:migrate   # crea las tablas (dev)
npm run prisma:generate  # regenera el cliente si solo cambiaste el schema
```

`GEMINI_API_KEY` ya existía en `.env.local` para `ownerClassifier.ts` — la
misma key se reutiliza acá.

## Modelo de datos (`prisma/schema.prisma`)

| Modelo | Qué guarda |
|---|---|
| `Contact` | nombre, teléfono/email, `leadStatus`, score de temperatura, último contacto, agente asignado (texto plano — se vuelve relación real cuando se agregue auth) |
| `Property` | dirección/zona, tipo, precio, estado |
| `Interaction` | contacto/propiedad vinculados, origen (`texto`/`voz`), texto crudo, JSON extraído (auditoría), urgencia, resumen, `idempotencyKey` único |
| `FollowupTask` | vencimiento calculado, estado, mensaje sugerido, canal |

## Flujo

1. **`POST /api/crm/interactions/extract`** — recibe `{ text }` o `{ audio: { base64, mimeType } }`, llama a Gemini (`src/lib/crm-assistant/extraction.ts`, modelo `gemini-flash-lite-latest`, salida JSON estructurada, retry/backoff en 429/5xx) y resuelve candidatos de contacto/propiedad (`entityResolution.ts`, fuzzy match por tokens). No persiste nada.
2. El agente edita/confirma en la tarjeta de confirmación (`ConfirmationCard.tsx`). Su edición final siempre prevalece sobre lo extraído.
3. **`POST /api/crm/interactions/confirm`** — persiste todo en una transacción: crea o actualiza el `Contact`, crea la `Interaction`, calcula la fecha de seguimiento (`followupLogic.ts`, único lugar con el mapeo urgencia→días) y crea el `FollowupTask` con un mensaje redactado (`messageDraft.ts`, best-effort vía Gemini con fallback a plantilla — nunca bloquea el guardado ni se envía automáticamente).

Idempotencia: el cliente genera un `idempotencyKey` por tarjeta de confirmación; reenviar el mismo confirm (doble click, reintento) devuelve el registro ya creado en vez de duplicarlo.

## Extraction schema

```json
{
  "contact_name": "string",
  "property_reference": "string",
  "lead_status": "nuevo | contactado | indeciso | interesado | negociacion | cerrado_ganado | cerrado_perdido",
  "urgency": "baja | media | alta",
  "summary": "string",
  "raw_transcript": "string | null"
}
```

`urgency` es siempre cualitativo — la fecha real la calcula `followupLogic.ts`
(alta → 2-3 días, media → 5-7, baja → 15-20), nunca el LLM.

## Tests

```bash
npm test
```

Cubre el mapeo urgencia→fecha, la resolución de entidades (incluyendo el caso
de nombre ambiguo, que no debe auto-seleccionar), y el flujo
confirmación→persistencia (creación + idempotencia + validación).

## Pendiente / fuera de alcance de esta iteración

- Auth real por agente (se agrega después, aparte — por ahora `assignedAgent` es solo texto).
- UI para gestionar el inventario de `Property` (hoy se resuelve contra lo que exista en la tabla, pero no hay pantalla para cargarlas a mano).
- Marcar `FollowupTask` como hecha desde la UI (el modelo lo soporta — `status: pendiente | hecho` — falta el botón).
