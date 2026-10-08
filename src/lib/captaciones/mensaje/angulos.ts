import { normalizarCita, parseMotivo } from '@/lib/captaciones/motivo';

/**
 * Elige con qué "ángulo" abrir la conversación con el dueño, a partir de los
 * datos que ya calculó el buscador. Es la pieza que más mueve la tasa de
 * respuesta: un mensaje que nombra un problema real y concreto del aviso
 * (precio, visibilidad, presentación) en vez de una oferta genérica.
 *
 * Determinístico y sin IA: la IA solo redacta el ángulo elegido acá, así no
 * puede inventar hechos que no estén en los datos.
 *
 * El precio NO es un ángulo de primer mensaje: el dato compara contra precios
 * pedidos, no de cierre, y decirle a un dueño que está caro lo pone a la
 * defensiva. Queda en `anguloPrecioSeguimiento` para un mensaje posterior.
 */

export const ANGULO_IDS = ['corredores', 'senal', 'visibilidad', 'presentacion', 'recien', 'alquiler', 'mercado', 'precio'] as const;
export type AnguloId = (typeof ANGULO_IDS)[number];

export interface Angulo {
  id: AnguloId;
  /** Rótulo corto para la UI ("Dato de precio"). */
  etiqueta: string;
  /** Hecho verificable que el mensaje puede mencionar. Nunca un número inventado. */
  hecho: string;
  /** Frase neutra (vale de vos y de usted) para la plantilla de respaldo. */
  frase: string;
  /** Qué ofrecer gratis, como sustantivo: "un comparativo de…". */
  oferta: string;
}

export interface DatosAviso {
  operacion: string;
  tipo: string;
  localidad: string;
  motivo: string;
  senales: string[];
  problemasAviso: string[];
  diasPublicado: number | null;
  barrioPrivado: boolean;
  descripcion: string | null;
  /** Frases textuales del aviso con apuro real; se pueden citar tal cual. */
  senalesFuertes?: string[];
  rechazaInmobiliarias?: boolean | null;
  abiertoACorredores?: boolean | null;
}

const NO_INMOBILIARIAS =
  /abstenerse\s+(inmobiliarias|agencias|corredores)|sin\s+inmobiliarias|no\s+(atiendo|acepto|trabajo con)\s+inmobiliarias|inmobiliarias\s+abstenerse|solo\s+particulares/i;

/** El dueño pidió explícitamente no ser contactado por inmobiliarias. */
export function pideSinInmobiliarias(descripcion: string | null, rechazaInmobiliarias?: boolean | null): boolean {
  return rechazaInmobiliarias === true || (!!descripcion && NO_INMOBILIARIAS.test(descripcion));
}

/** El buscador marca así los avisos viejos que probablemente ya se vendieron o alquilaron. */
function puedeEstarDesactualizado(motivo: string) {
  return /puede estar desactualizado/i.test(motivo);
}

function esAlquiler(operacion: string) {
  return /alquiler/i.test(operacion);
}

interface Metricas {
  precioPct: number | null; // + = arriba de similares
  precioReferencia: string | null; // "su partido" / "su barrio"
  visitasDia: number | null;
  pagaDestacado: boolean;
  avisoFlojo: boolean;
}

function leerMetricas(motivo: string): Metricas {
  const m: Metricas = { precioPct: null, precioReferencia: null, visitasDia: null, pagaDestacado: false, avisoFlojo: false };
  for (const { texto } of parseMotivo(motivo)) {
    const precio = /precio\/m²\s*(\d+(?:[.,]\d+)?)%\s*(sobre|bajo)\s+similares de (su \w+)/i.exec(texto);
    if (precio) {
      const pct = Number(precio[1].replace(',', '.'));
      m.precioPct = precio[2].toLowerCase() === 'sobre' ? pct : -pct;
      m.precioReferencia = precio[3];
    }
    const visitas = /(\d+(?:[.,]\d+)?)\s*visitas\/día/i.exec(texto);
    if (visitas) m.visitasDia = Number(visitas[1].replace(',', '.'));
    if (/destacado/i.test(texto)) m.pagaDestacado = true;
    if (/aviso flojo/i.test(texto)) m.avisoFlojo = true;
  }
  return m;
}

function zona(localidad: string) {
  return localidad.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Devuelve los ángulos aplicables, del más fuerte al más débil. Siempre hay al
 * menos uno (`mercado`), así que nunca queda sin qué decir.
 */
export function elegirAngulos(d: DatosAviso): Angulo[] {
  const m = leerMetricas(d.motivo);
  const out: Angulo[] = [];
  const lugar = zona(d.localidad);
  const alquiler = esAlquiler(d.operacion);

  // 1. Acepta corredores: la puerta ya está abierta, se ofrece trabajar en conjunto.
  if (d.abiertoACorredores) {
    out.push({
      id: 'corredores',
      etiqueta: 'Trabajo en conjunto',
      hecho: 'El aviso dice que acepta propuestas de corredores, sin exclusividad.',
      frase: 'Vi que en el aviso aceptan propuestas de corredores.',
      oferta: 'una propuesta para trabajar la propiedad en conjunto, sin exclusividad',
    });
  }

  // 2. Señales del propio dueño: es lo que más predispone a responder. Las
  // señales fuertes son frases textuales del aviso, así que se citan tal cual.
  const fuerte = d.senalesFuertes?.find((s) => s.trim());
  const senal = fuerte ?? d.senales.find((s) => /oferta|permuta|parte de pago|urgente|financ|apto cr[eé]dito|due[ñn]o vende/i.test(s));
  if (senal) {
    const cita = normalizarCita(senal);
    out.push({
      id: 'senal',
      etiqueta: 'Lo que pide el dueño',
      hecho: `En el aviso dice textualmente: "${cita}".`,
      frase: `Me llamó la atención que en el aviso dice "${cita}".`,
      oferta: alquiler
        ? 'el perfil de interesados que suele aceptar esa condición en la zona'
        : fuerte
        ? 'un resumen de qué se publicó parecido en la zona y a qué valores, para decidir rápido y con datos'
        : 'qué perfil de comprador está buscando justo eso en la zona y cómo se viene moviendo',
    });
  }

  // 3. Mucho tiempo publicado / pocas visitas: el aviso no está rindiendo.
  const dias = d.diasPublicado;
  const pocasVisitas = m.visitasDia !== null && m.visitasDia < 2;
  // Un aviso posiblemente desactualizado ya se habrá vendido o alquilado: no
  // tiene sentido hablarle de la visibilidad.
  if (!puedeEstarDesactualizado(d.motivo) && ((dias !== null && dias >= 45) || pocasVisitas || m.pagaDestacado)) {
    const partes: string[] = [];
    if (dias !== null && dias >= 45) partes.push(`lleva ${dias} días publicado`);
    if (pocasVisitas) partes.push(`recibe pocas visitas (${m.visitasDia} por día)`);
    if (m.pagaDestacado) partes.push('paga aviso destacado');
    out.push({
      id: 'visibilidad',
      etiqueta: 'Visibilidad del aviso',
      hecho: `El aviso ${partes.join(', ')}.`,
      frase:
        dias !== null && dias >= 45
          ? `Noté que ya lleva ${dias} días publicado.`
          : 'Noté que está teniendo pocas visitas.',
      oferta: 'un diagnóstico corto de por qué el aviso no está generando consultas',
    });
  }

  // 4. Fotos o descripción flojas: podemos mostrar el antes/después con Plinth.
  if (d.problemasAviso.length > 0 || m.avisoFlojo) {
    const problemas = d.problemasAviso.length ? d.problemasAviso.join(', ') : 'fotos o descripción mejorables';
    out.push({
      id: 'presentacion',
      etiqueta: 'Fotos del aviso',
      hecho: `Detectamos en el aviso: ${problemas}.`,
      frase: 'Me parece que las fotos no le hacen justicia a la propiedad.',
      oferta: 'una de las fotos del aviso mejorada (más luz y nitidez, sin marcas) para comparar',
    });
  }

  // 5. Recién publicado: la ventana de mayor respuesta; ayudar a que arranque bien.
  if (dias !== null && dias <= 3) {
    out.push({
      id: 'recien',
      etiqueta: 'Recién publicado',
      hecho: `Publicó hace ${dias === 0 ? 'menos de un día' : `${dias} días`}.`,
      frase: 'Vi que el aviso se publicó hace muy poco.',
      oferta: alquiler
        ? 'un resumen de a qué valores se publican y alquilan propiedades parecidas en la zona, para arrancar con el precio justo'
        : 'un resumen de a qué valores se publican y venden propiedades parecidas en la zona, para arrancar con el precio justo',
    });
  }

  // 6. Alquiler: el dolor es el inquilino y la garantía, no el precio.
  if (alquiler) {
    out.push({
      id: 'alquiler',
      etiqueta: 'Inquilino seguro',
      hecho: `Es un alquiler${d.barrioPrivado ? ' en barrio cerrado' : ''} en ${lugar}.`,
      frase: 'Lo más delicado en un alquiler suele ser elegir bien al inquilino.',
      oferta: 'un resumen de cómo filtro inquilinos y verifico garantías',
    });
  }

  // Siempre disponible.
  out.push({
    id: 'mercado',
    etiqueta: 'Panorama de la zona',
    hecho: `Es ${/^[aeiou]/i.test(d.tipo) ? 'un' : 'una'} ${d.tipo.toLowerCase()} en ${lugar}${d.barrioPrivado ? ', en barrio cerrado' : ''}.`,
    frase: 'Vengo siguiendo de cerca cómo se mueve la zona.',
    oferta: alquiler
      ? 'un resumen de a qué valores se alquilan propiedades parecidas en la zona'
      : 'un resumen de qué se vendió parecido en la zona y a qué valores',
  });

  return out;
}

/**
 * Ángulo de precio, solo para un seguimiento (nunca para el primer mensaje).
 * Null si no hay dato o si la diferencia es chica. No aplica a alquileres.
 */
export function anguloPrecioSeguimiento(d: DatosAviso): Angulo | null {
  const m = leerMetricas(d.motivo);
  if (m.precioPct === null || m.precioPct < 15 || esAlquiler(d.operacion)) return null;
  return {
    id: 'precio',
    etiqueta: 'Dato de precio',
    hecho: `Su precio por m² está aproximadamente ${Math.round(m.precioPct)}% por encima de avisos similares de ${m.precioReferencia ?? 'la zona'} (${zona(d.localidad)}).`,
    frase: `Comparando con avisos parecidos de la zona, el precio por m² quedó cerca de un ${Math.round(m.precioPct)}% arriba.`,
    oferta: 'un comparativo de lo que se publicó parecido en la zona',
  };
}

/** Primer nombre del anunciante si parece una persona; si no, null (saludo sin nombre). */
export function nombreDelDueno(anunciante: string | null): string | null {
  if (!anunciante) return null;
  const limpio = anunciante.trim();
  if (/due[ñn]o|propietari|particular|inmobiliaria|propiedades|negocios|bienes|s\.?a\.?|srl|\d/i.test(limpio)) return null;
  const primero = limpio.split(/\s+/)[0];
  if (!/^[A-Za-zÁÉÍÓÚÑáéíóúñ]{2,20}$/.test(primero)) return null;
  return primero.charAt(0).toUpperCase() + primero.slice(1).toLowerCase();
}
