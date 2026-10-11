Revisé a fondo el buscador que alimenta Captaciones (detalle en `~/.openclaw/workspace/skills/captacion-dueno-directo/app/docs/auditoria_2026-10-08.md`, si querés leerlo). Ahora detecta mejor a los dueños, lee todos los avisos con IA y manda campos nuevos. Necesito que Plinth los aproveche. El contrato de `/api/captaciones/import` no se rompe: todos los campos de antes siguen igual; los nuevos son adicionales y hoy se ignoran.

## 1. Cargar la lista revisada de esta semana

- Importá `captaciones_revisadas_2026-10-05.json` (95 captaciones, puntaje 30 a 58) con `POST /api/captaciones/import`, usando el token de `.env.local` sin mostrarlo. Tiene que dar `rechazadas: 0`.
- Después listame las captaciones que NO están en ese archivo. Son las que el buscador ahora identifica como inmobiliarias, intermediarios que cobran honorarios o desarrolladoras.
  - Borrá solo las que sigan en estado `nuevo` y no tengan contacto, propiedad, notas ni teléfono comprado.
  - Las que no cumplan eso no las toques: mostrámelas.

## 2. Guardar y mostrar los campos nuevos

Agregá a `Captacion` (migración Prisma) y al contrato, todos opcionales:

| Campo del JSON | Tipo | Qué es |
|---|---|---|
| `senales_fuertes` | string[] | Frases textuales del aviso con apuro real (urgente, por viaje, sucesión, bajé el precio) |
| `rechaza_inmobiliarias` | boolean | El aviso pide explícitamente no ser contactado por inmobiliarias |
| `abierto_a_corredores` | boolean | Acepta corredores ("sin exclusividad", "se reciben propuestas de matriculados") |
| `republicado` | boolean | El dueño dio de baja el aviso y lo volvió a publicar |
| `otros_portales` | string[] | Otros portales donde está el mismo inmueble |
| `analizado_por` | string | "agente" o "heuristica" |

En la tarjeta, sin sumar ruido:
- Si hay `senales_fuertes`, la línea de "por qué" empieza con la primera, entre comillas.
- `rechaza_inmobiliarias`: una etiqueta discreta, "Pidió no contactar inmobiliarias".
- `abierto_a_corredores`: una etiqueta "Acepta corredores".

Si el motivo trae "precio mal cargado en el portal (revisar)", mostrá un ícono de advertencia junto al precio.

## 3. Ajustar los ángulos del primer mensaje (`src/lib/captaciones/mensaje/angulos.ts`)

- **Señal:** usar primero `senales_fuertes` cuando existan. Las frases son textuales, así que se pueden citar.
- **Precio:** sacarlo de los ángulos del primer mensaje. Es un dato contra precios pedidos, no de cierre, y decirle a un dueño que está caro lo pone a la defensiva. Guardalo para un seguimiento.
- **Visibilidad:** no usarla cuando el motivo dice "puede estar desactualizado". Son avisos que probablemente ya se vendieron o alquilaron.
- **Corredores:** si `abierto_a_corredores`, agregar ese ángulo primero. Oferta: trabajar la propiedad en conjunto, sin exclusividad.
- **Rechazo:** si `rechaza_inmobiliarias`, el mensaje tiene que reconocerlo con respeto y ofrecer algo útil sin pedir exclusividad. No lo ocultes.
- **Validador:** los textos parseados del motivo (`precio/m² N% sobre similares de su …`, `N visitas/día`, `destacado`, `aviso flojo`) no cambiaron.

## 4. Medir qué funciona

Hoy no se registra qué mensaje se mandó. Agregá a `Captacion`:
- `anguloEnviado`
- `mensajeEnviado`
- `enviadoEn`

Completalos cuando el corredor toca "Enviar por WhatsApp" o "Copiar mensaje". Con eso, más los cambios de estado que ya existen (`respondio`, `tasacion`, `captado`), en unas semanas se puede ver qué ángulo y qué señales responden mejor.

Agregá también `GET /api/captaciones/metricas`, protegido con sesión. Devuelve, por ángulo:
- enviados;
- respondieron;
- captados.

No hace falta pantalla todavía.

## Cómo comprobarlo

1. `npm run test` y `npm run build` sin errores. Sumá tests para:
   - el import con los campos nuevos y con un JSON viejo sin ellos (las dos cosas tienen que funcionar);
   - que el ángulo de precio ya no aparece;
   - que se guarda el ángulo enviado.
2. Con Playwright, logueado con `E2E_EMAIL`/`E2E_PASSWORD`:
   - las 95 tarjetas ordenadas por puntaje;
   - una con señal fuerte, una con "Pidió no contactar inmobiliarias" y una con precio a revisar;
   - capturas en 390 px y 1440 px.
3. Mostrame la respuesta del import y la lista del punto 1 antes de borrar nada.

Empezá explorando y armá un plan. Dejame revisarlo antes de implementar.
