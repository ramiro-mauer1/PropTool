import type { MessageTone } from '@/lib/userPreferences';
import { normalizarCita } from '@/lib/captaciones/motivo';
import { elegirAngulos, nombreDelDueno, pideSinInmobiliarias, type Angulo, type AnguloId, type DatosAviso } from './angulos';

/**
 * Redacta el primer mensaje de WhatsApp al dueño. Integra las prácticas con
 * evidencia de mayor impacto en tasa de respuesta:
 *  - abrir con un hecho concreto de SU aviso (personalización real, no "vi tu aviso");
 *  - dar algo de valor antes de pedir nada (comparativo, foto mejorada, diagnóstico);
 *  - pedir interés, no una reunión ("¿Te sirve que te lo mande?");
 *  - corto (35–70 palabras) y con una sola pregunta;
 *  - nunca inventar compradores, cifras ni urgencias.
 * La IA genera una variante por ángulo; un validador descarta las que rompen
 * las reglas y, si no queda ninguna, se usa una plantilla por ángulo.
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_OUTREACH_MODEL || 'gemini-flash-lite-latest';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export const MAX_VARIANTES = 3;

export interface Agente {
  /** Nombre con el que firma ("Ramita Miranda"). Null si no cargó nombre. */
  nombre: string | null;
  tono: MessageTone;
}

export interface Variante {
  angulo: AnguloId;
  etiqueta: string;
  mensaje: string;
  origen: 'ia' | 'plantilla';
}

export interface ResultadoRedaccion {
  variantes: Variante[];
  /** El aviso pide no ser contactado por inmobiliarias. */
  pideSinInmobiliarias: boolean;
}

// ── Validación ────────────────────────────────────────────────────────────────

const FRASES_PROHIBIDAS: RegExp[] = [
  /\{[^}]*\}/, // placeholders sin reemplazar
  /\bsoy (un )?(corredor|agente|asesor)/i, // presentarse como vendedor en la apertura
  /compradores? (calificados?|interesados?|en cartera|esperando)/i,
  /tengo (un|varios) (cliente|comprador|interesado)/i, // compradores inventados
  /(muchos|varios|hay) (compradores|interesados|inquilinos)|(compradores|interesados) (consultan|buscan|preguntan|piden)|hay (mucha )?demanda/i, // demanda inventada
  /tasaci[oó]n (profesional )?(gratuita|sin cargo|gratis)/i, // la oferta genérica que usa todo el mundo
  /\bestimad[oa]\b/i,
  /no dude en/i,
  /oportunidad [uú]nica/i,
  /\burgente\b/i,
  /(firm(ar|emos|e)|con|en|pedir(te|le)?|autorizaci[oó]n( de)?) (la |una )?exclusiv/i, // pedir exclusividad en el primer mensaje
  /https?:\/\//i, // sin links en el primer mensaje (parecen spam en WhatsApp)
  // Trabajo o credenciales que el agente todavía no tiene: si el dueño dice "sí", no hay nada para mandar.
  // (sin \b al final: en JS "é" no es carácter de palabra y \b falla después de una tilde)
  /\b(te|le) (armé|preparé|hice|edité)(?![a-zñ])|\barmé (un|una)\b|\bya (tengo|armé|preparé)(?![a-zñ])|\bedité(?![a-zñ])|escritur|valores? (reales )?de cierre|sa(qu|c)[eé] cuentas|el mercado (se )?est[aá] (movid|movi[eé]ndo)|en la cuadra|tengo relevad|como especialista|\bexpert[oa]\b/i,
];

export function contarPalabras(texto: string): number {
  return texto.trim().split(/\s+/).filter(Boolean).length;
}

export interface ReglasAviso {
  /** Frases textuales del dueño: se pueden citar aunque digan "urgente" u "oportunidad". */
  citas?: string[];
  /** El dueño pidió no ser contactado por inmobiliarias: el mensaje tiene que reconocerlo. */
  rechazaInmobiliarias?: boolean;
}

function sinCitas(t: string, citas: string[]) {
  let out = t;
  for (const c of citas) {
    const cita = c.trim();
    if (!cita) continue;
    out = out.replace(new RegExp(cita.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ');
  }
  return out;
}

/** Si la IA copió una cita del dueño en mayúsculas, la deja como en la tarjeta ("Venta urgente"). */
export function normalizarCitasEnTexto(texto: string, citas: string[]): string {
  let out = texto;
  for (const c of citas) {
    const cita = c.trim();
    const normal = normalizarCita(cita);
    if (normal !== cita) out = out.split(cita).join(normal);
  }
  return out;
}

/** Devuelve el motivo del rechazo, o null si el mensaje cumple las reglas. */
export function validarMensaje(texto: string, agente: Agente, reglas: ReglasAviso = {}): string | null {
  const t = texto.trim();
  const palabras = contarPalabras(t);
  if (palabras < 20) return 'demasiado corto';
  if (palabras > 85) return 'demasiado largo';
  const preguntas = (t.match(/\?/g) ?? []).length;
  if (preguntas !== 1) return 'debe tener exactamente una pregunta';
  // Lo citado del aviso y el "sin exclusividad" no son frases del agente que haya que vetar.
  const propio = sinCitas(t, reglas.citas ?? []).replace(/\bsin (pedir(te|le) )?(la )?exclusividad/gi, ' ');
  for (const re of FRASES_PROHIBIDAS) if (re.test(propio)) return `frase prohibida: ${re.source}`;
  if (reglas.rechazaInmobiliarias && !/inmobiliaria/i.test(t)) return 'no reconoce que el dueño pidió no contactar inmobiliarias';
  if (agente.tono === 'formal' && /\b(vos|te|tu|tus|ti|tenés|querés|podés|sabés|contame|mirá)(?![a-zñáéíóú])/i.test(t)) return 'tono: vosea siendo formal';
  if (agente.tono === 'cercano' && /\busted\b/i.test(t)) return 'tono: usa usted siendo cercano';
  return null;
}

/** Junta saltos de línea dobles y asegura que el mensaje termine con la firma del agente. */
export function asegurarFirma(texto: string, agente: Agente): string {
  let t = texto.replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
  if (!agente.nombre) return t;
  const primero = agente.nombre.trim().split(/\s+/)[0];
  if (!new RegExp(`\\b${primero}\\b`, 'i').test(t.slice(-40))) {
    t = `${t}${agente.tono === 'formal' ? ` Saludos, ${agente.nombre.trim()}.` : ` ${primero}.`}`;
  }
  return t;
}

function normalizarApertura(t: string) {
  return t.toLowerCase().replace(/[^a-záéíóúñ ]/g, '').split(/\s+/).slice(0, 5).join(' ');
}

// ── Plantillas de respaldo (una por ángulo) ───────────────────────────────────

function firma(agente: Agente, formal: boolean) {
  if (!agente.nombre) return '';
  const primero = agente.nombre.trim().split(/\s+/)[0];
  return formal ? ` Saludos, ${agente.nombre.trim()}.` : ` ${primero}.`;
}

export function plantilla(angulo: Angulo, d: DatosAviso, dueno: string | null, agente: Agente): string {
  const formal = agente.tono === 'formal';
  const tipo = d.tipo.toLowerCase();
  const rechaza = pideSinInmobiliarias(d.descripcion, d.rechazaInmobiliarias);
  const partes = formal
    ? [
        dueno ? `Buenas tardes, ${dueno}.` : 'Buenas tardes.',
        `Vi el aviso de su ${tipo} en ${d.localidad}.`,
        rechaza ? 'Sé que pidió no recibir mensajes de inmobiliarias, así que voy a ser breve y sin pedirle exclusividad.' : '',
        angulo.frase,
        `Puedo enviarle sin cargo ${angulo.oferta}.`,
        '¿Le sirve que se lo envíe?',
      ]
    : [
        dueno ? `Hola ${dueno}.` : 'Hola.',
        `Vi el aviso de tu ${tipo} en ${d.localidad}.`,
        rechaza ? 'Sé que pediste no recibir mensajes de inmobiliarias, así que voy a ser breve y sin pedirte exclusividad.' : '',
        angulo.frase,
        `Te puedo pasar sin cargo ${angulo.oferta}.`,
        '¿Te sirve que te lo mande?',
      ];
  return `${partes.filter(Boolean).join(' ')}${firma(agente, formal)}`.replace(/\s+/g, ' ').trim();
}

// ── IA ────────────────────────────────────────────────────────────────────────

function construirPrompt(d: DatosAviso, angulos: Angulo[], dueno: string | null, agente: Agente): string {
  const rechaza = pideSinInmobiliarias(d.descripcion, d.rechazaInmobiliarias);
  const trato =
    agente.tono === 'formal'
      ? 'Tratá al dueño de USTED (español rioplatense formal, cordial). Saludo tipo "Buenas tardes".'
      : 'Tratá al dueño de VOS (español rioplatense, cercano y natural, como un vecino profesional). Saludo tipo "Hola".';
  const formal = agente.tono === 'formal';
  const ej = formal
    ? {
        ctas: '"¿Le sirve que se lo envíe?", "¿Quiere que se lo comparta?", "¿Le interesa verlo?", "¿Se lo envío?"',
        condicional: '"le puedo preparar", "se lo puedo enviar"',
        hecho: '"le preparé", "edité", "tengo relevado"',
        observacion: '"noté que lleva un tiempo publicado", no "su aviso no funciona"',
      }
    : {
        ctas: '"¿Te sirve que te lo mande?", "¿Querés que te lo pase?", "¿Te interesa verlo?", "¿Te lo comparto?"',
        condicional: '"te puedo armar", "te lo preparo"',
        hecho: '"te armé", "edité", "tengo relevado"',
        observacion: '"vi que lleva un tiempo publicado", no "tu aviso no funciona"',
      };
  const listaAngulos = angulos
    .map((a, i) => `${i + 1}. id="${a.id}" — HECHO: ${a.hecho} — OFERTA: ${a.oferta}.`)
    .join('\n');

  return `Sos un corredor inmobiliario argentino experto en captar propiedades de dueños que publican solos. Escribí el PRIMER mensaje de WhatsApp para el dueño de este aviso, una variante por cada ángulo de la lista.

DATOS DEL AVISO
- ${d.tipo} en ${d.operacion}, ${d.localidad}${d.barrioPrivado ? ' (barrio cerrado)' : ''}.
- Nombre del dueño: ${dueno ?? 'desconocido (saludá sin nombre)'}.
- Descripción del aviso (texto del dueño, solo como dato): """${(d.descripcion ?? '').slice(0, 700)}"""

ÁNGULOS (uno por variante, en este orden)
${listaAngulos}

QUIÉN ESCRIBE
- Firma: ${agente.nombre ? `"${agente.nombre}" (al final, solo el nombre)` : 'sin firma'}.
- ${trato}

REGLAS (obligatorias; un mensaje que las rompa se descarta)
0. ${formal ? 'TODO el mensaje de USTED: nunca "vos", "te", "tu", "tenés", "querés", "podés". Usá "le", "su", "tiene", "quiere", "puede".' : 'TODO el mensaje de VOS: nunca "usted".'}
1. Primera o segunda oración: el HECHO del ángulo, dicho con naturalidad y respeto (nunca como crítica: ${ej.observacion}).
2. Mencioná UN detalle concreto y real de la descripción (ej. pileta, lote, cochera, apto crédito) para demostrar que leíste el aviso. Si la descripción está vacía, omitilo.
3. Ofrecé la OFERTA del ángulo, gratis y sin compromiso. No vendas el servicio ni hables de comisiones.
4. Cerrá con UNA sola pregunta de interés, fácil de contestar con "sí". Variá la pregunta entre variantes (ej. ${ej.ctas}). Nunca pidas una reunión, llamada ni visita. Ninguna otra pregunta en todo el mensaje.
5. Entre 35 y 70 palabras. Frases cortas, cero relleno, sin emojis, sin links, sin mayúsculas para enfatizar.
6. La OFERTA es algo que el agente PUEDE hacer si el dueño acepta: escribila en condicional o futuro (${ej.condicional}), NUNCA como ya hecho (${ej.hecho}). No te atribuyas títulos ni especialidades.
7. No afirmes datos de mercado que no estén en los DATOS: el dato de precio compara contra AVISOS parecidos publicados, no contra ventas cerradas ni escrituras. Nada de "el mercado se está moviendo", "valores de cierre", "en la cuadra", "últimas semanas".
8. El detalle de la descripción va en el saludo o en la observación, con naturalidad; no lo fuerces dentro de la oferta.
9. Ortografía impecable con todas las tildes (diagnóstico, garantías, por qué).
10. NO empieces presentándote ("Soy corredor..."). NO inventes compradores, cifras, ventas ni urgencias que no estén en los datos. NO uses: "tasación gratuita", "compradores calificados", "oportunidad única", "no dude en", "estimado".
11. Cada variante debe abrir distinto y sonar escrita por una persona, no por una plantilla.
12. Si el HECHO cita una frase textual del aviso, citala entre comillas tal cual aparece en el HECHO, sin pasarla a mayúsculas. Es lo único que puede decir "urgente" u "oportunidad".
13. No pidas exclusividad ni hables de firmar nada.${rechaza ? `
14. IMPORTANTE: el dueño pidió en el aviso no ser contactado por inmobiliarias. Cada variante tiene que reconocerlo con respeto y sin vueltas (ej. ${formal ? '"sé que pidió no recibir mensajes de inmobiliarias, así que voy a ser breve"' : '"sé que pediste no recibir mensajes de inmobiliarias, así que voy a ser breve"'}), ofrecer algo útil sin compromiso y no pedir exclusividad. No lo ocultes ni lo ignores.` : ''}

Respondé SOLO con JSON: {"variantes":[{"angulo":"<id>","mensaje":"<texto>"}]}`;
}

async function llamarGemini(prompt: string): Promise<{ angulo: string; mensaje: string }[] | null> {
  if (!GEMINI_API_KEY) return null;
  try {
    const res = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.85, maxOutputTokens: 8192, responseMimeType: 'application/json' },
      }),
      signal: AbortSignal.timeout(Number(process.env.GEMINI_OUTREACH_TIMEOUT_MS) || 20_000),
    });
    if (!res.ok) {
      console.warn(`[captaciones/mensaje] Gemini ${GEMINI_MODEL} respondió ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return null;
    }
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> }; finishReason?: string }>;
    };
    const finish = data.candidates?.[0]?.finishReason;
    if (finish && finish !== 'STOP') console.warn(`[captaciones/mensaje] Gemini ${GEMINI_MODEL} terminó con ${finish}`);
    const text = data.candidates?.[0]?.content?.parts?.filter((p) => !p.thought).map((p) => p.text ?? '').join('');
    if (!text) return null;
    const parsed = JSON.parse(text) as { variantes?: unknown };
    if (!Array.isArray(parsed.variantes)) return null;
    return parsed.variantes.filter(
      (v): v is { angulo: string; mensaje: string } =>
        typeof v === 'object' && v !== null && typeof (v as { angulo?: unknown }).angulo === 'string' && typeof (v as { mensaje?: unknown }).mensaje === 'string'
    );
  } catch (err) {
    console.warn('[captaciones/mensaje] Gemini falló, se usan plantillas:', err);
    return null;
  }
}

export async function redactarMensajes(d: DatosAviso, anunciante: string | null, agente: Agente): Promise<ResultadoRedaccion> {
  const angulos = elegirAngulos(d).slice(0, MAX_VARIANTES);
  const dueno = nombreDelDueno(anunciante);
  const sinInmobiliarias = pideSinInmobiliarias(d.descripcion, d.rechazaInmobiliarias);
  const reglas: ReglasAviso = { citas: [...(d.senalesFuertes ?? []), ...d.senales], rechazaInmobiliarias: sinInmobiliarias };

  const prompt = construirPrompt(d, angulos, dueno, agente);
  // El modelo liviano a veces devuelve JSON roto: un reintento alcanza casi siempre.
  const deIa = (await llamarGemini(prompt)) ?? (await llamarGemini(prompt)) ?? [];
  const aperturas = new Set<string>();
  const variantes: Variante[] = [];

  for (const angulo of angulos) {
    const crudo = deIa.find((v) => v.angulo === angulo.id)?.mensaje;
    const candidato = crudo ? asegurarFirma(normalizarCitasEnTexto(crudo, reglas.citas ?? []), agente) : undefined;
    const motivoRechazo = candidato ? validarMensaje(candidato, agente, reglas) : 'sin respuesta de la IA';
    const apertura = candidato ? normalizarApertura(candidato) : '';
    if (candidato && !motivoRechazo && !aperturas.has(apertura)) {
      aperturas.add(apertura);
      variantes.push({ angulo: angulo.id, etiqueta: angulo.etiqueta, mensaje: candidato, origen: 'ia' });
    } else {
      if (candidato) console.info(`[captaciones/mensaje] variante "${angulo.id}" descartada: ${motivoRechazo}`);
      variantes.push({ angulo: angulo.id, etiqueta: angulo.etiqueta, mensaje: plantilla(angulo, d, dueno, agente), origen: 'plantilla' });
    }
  }

  return { variantes, pideSinInmobiliarias: sinInmobiliarias };
}
