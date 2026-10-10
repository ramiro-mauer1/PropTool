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
| `POST /api/captaciones/[id]/envio` | sesión | `{ angulo, mensaje }`. Guarda `anguloEnviado`, `mensajeEnviado` y `enviadoEn` cuando el corredor toca "Copiar" o "Enviar por WhatsApp". Gana el último envío. `angulo` es un id de ángulo o `borrador` (el texto del buscador). |
| `GET /api/captaciones/metricas` | sesión | `{ angulos: [{ angulo, enviados, respondieron, captados }] }`. Usa los hitos `respondioEn` y `captadoEn`, no el estado actual. |

`import` y `estados` están en `PUBLIC_PREFIXES` del middleware, con la ruta exacta. Las protege únicamente el token.

## Qué pisa y qué no pisa el import

En cada corrida se actualizan los datos del aviso (precio, score, motivo, días publicado, borrador, etc.), además de `ultimaVezVista` y `corridaId`.

Nunca se tocan `estado`, `notas`, `contactId`, `propertyId` ni `estadoActualizadoEn`. El `telefono` tampoco se pisa si se compró (`telefonoAdquiridoEn`).

Campos opcionales agregados en octubre de 2026. Un JSON que no los trae entra igual, con `[]` o `null`:

| Campo | Tipo | Uso |
|---|---|---|
| `senales_fuertes` | string[] | Frases textuales con apuro real. La primera abre "Por qué tiene N puntos" y es la que cita el ángulo de señal. |
| `rechaza_inmobiliarias` | boolean | Etiqueta "Pidió no contactar inmobiliarias". Cada mensaje tiene que reconocerlo. |
| `abierto_a_corredores` | boolean | Etiqueta "Acepta corredores" y ángulo `corredores`, que va primero. |
| `republicado` | boolean | Se guarda; todavía no se muestra. |
| `otros_portales` | string[] | Se guarda; todavía no se muestra. |
| `analizado_por` | string | `agente` o `heuristica`. |

## Hitos para medir

`respondioEn` se completa la primera vez que la captación pasa a `respondio`, `tasacion` o `captado`; `captadoEn`, la primera vez que pasa a `captado`. No se borran nunca, aunque después cambie de estado.

## Mensaje al dueño

`POST /api/captaciones/[id]/mensaje` (sesión) redacta 2 o 3 variantes del primer WhatsApp, una por **ángulo**. Se llama la primera vez que el agente abre "Contactar" en la tarjeta, y de nuevo con "Otras versiones". No guarda nada.

- **Ángulos** (`src/lib/captaciones/mensaje/angulos.ts`, sin IA): se eligen según los datos del buscador, en este orden de prioridad:
  1. acepta corredores (trabajar en conjunto, sin exclusividad);
  2. lo que pide el dueño (primero `senales_fuertes`, citadas textualmente);
  3. mucho tiempo publicado o pocas visitas (salvo que el motivo diga "puede estar desactualizado");
  4. fotos flojas;
  5. recién publicado;
  6. alquiler;
  7. siempre, panorama de la zona.
- **Precio**: no se usa en el primer mensaje. Compara contra precios pedidos, no de cierre, y decirle a un dueño que está caro lo pone a la defensiva. Queda en `anguloPrecioSeguimiento` para un seguimiento.
- **Redacción** (`redactar.ts`): Gemini (`GEMINI_OUTREACH_MODEL`, por defecto `gemini-flash-lite-latest`) escribe con la firma y el tono del agente (`full_name`, `message_tone`).
- **Validador**: descarta lo que rompa las reglas: 20–85 palabras, una sola pregunta, sin "soy corredor", sin compradores ni datos de mercado inventados, sin prometer trabajo como ya hecho, sin pedir exclusividad y sin mezclar vos y usted. Las frases citadas del dueño quedan fuera de la lista de prohibidas, así un "venta urgente" textual se puede citar. Si el dueño rechaza inmobiliarias, el mensaje tiene que mencionarlo. Si una variante se descarta, se usa una plantilla del mismo ángulo, que cumple las mismas reglas.
- Si el aviso pide no contactar inmobiliarias (`rechaza_inmobiliarias`, o la descripción dice "abstenerse inmobiliarias"), la tarjeta lo avisa y todas las variantes lo reconocen con respeto, sin pedir exclusividad.
- El `borrador_mensaje` del buscador solo se usa si falla la red.

Por qué estas reglas: personalizar con datos del aviso multiplica las respuestas; pedir interés ("¿te sirve que te lo mande?") supera a pedir una reunión; los mensajes cortos con una sola pregunta responden más. El precio es la dificultad nº 1 de quien vende sin inmobiliaria (NAR), pero se deja para un seguimiento: en el primer contacto pone al dueño a la defensiva.

## Compra de teléfono

- Actor: `memo23/zonaprop-scraper`, por `run-sync-get-dataset-items`, con `maxTotalChargeUsd=0.06`.
- Input: `{ startUrls, maxItems: 1, enrichContacts: true }`.
- Del resultado se toma `phone` y, si no viene, el primero de `phones`.
- Si no viene ninguno, se guarda `telefonoIntentadoEn` y no se puede reintentar. La tarjeta lo deja a la vista con un aviso fijo ("Pediste el teléfono el … y Zonaprop no lo tenía. Se cobró menos de USD 0,01.") y ofrece la alternativa: "WhatsApp desde el aviso" si el portal tiene WhatsApp; si no, "Ver aviso".
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
