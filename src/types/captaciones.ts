export const CAPTACION_ESTADOS = [
  'nuevo',
  'contactado',
  'respondio',
  'tasacion',
  'captado',
  'descartado',
  'cerrado',
] as const;

export type CaptacionEstadoValue = (typeof CAPTACION_ESTADOS)[number];

export function isCaptacionEstado(v: unknown): v is CaptacionEstadoValue {
  return typeof v === 'string' && (CAPTACION_ESTADOS as readonly string[]).includes(v);
}

/** Un cambio en el historial de una captación (tabla CaptacionEvento). */
export interface CaptacionEventoDTO {
  id: string;
  /** "estado" | "notas" | "alta" */
  tipo: string;
  estadoAnterior: CaptacionEstadoValue | null;
  estadoNuevo: CaptacionEstadoValue | null;
  notasCambiaron: boolean;
  /** null solo en la importación automática. */
  usuarioId: string | null;
  usuarioEmail: string | null;
  usuarioNombre: string | null;
  /** "app" | "revisar" | "importacion" */
  origen: string;
  creadoEn: string;
}

/** Shape returned by GET /api/captaciones (dates serialized as ISO strings). */
export interface CaptacionDTO {
  id: string;
  clave: string;
  portal: string;
  url: string;
  operacion: string;
  tipo: string;
  precio: number | null;
  moneda: string | null;
  m2Cubiertos: number | null;
  m2Total: number | null;
  ambientes: number | null;
  direccion: string | null;
  localidad: string;
  partido: string;
  anunciante: string | null;
  telefono: string | null;
  tieneWhatsappEnPortal: boolean | null;
  fotoUrl: string | null;
  score: number;
  motivo: string;
  senales: string[];
  barrioPrivado: boolean;
  problemasAviso: string[];
  borradorMensaje: string | null;
  diasPublicado: number | null;
  visitas: number | null;
  fechaPublicacion: string | null;
  senalesFuertes: string[];
  rechazaInmobiliarias: boolean | null;
  abiertoACorredores: boolean | null;
  republicado: boolean | null;
  otrosPortales: string[];
  estado: CaptacionEstadoValue;
  notas: string | null;
  estadoActualizadoEn: string;
  telefonoAdquiridoEn: string | null;
  telefonoIntentadoEn: string | null;
  primeraVezVista: string;
  ultimaVezVista: string;
  contactId: string | null;
  propertyId: string | null;
  /** Del más viejo al más nuevo. Vacío si la captación no cambió desde que existe el registro. */
  eventos: CaptacionEventoDTO[];
}
