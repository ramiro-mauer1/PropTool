export const LEAD_STATUSES = [
  'nuevo',
  'contactado',
  'indeciso',
  'interesado',
  'negociacion',
  'cerrado_ganado',
  'cerrado_perdido',
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const URGENCY_LEVELS = ['baja', 'media', 'alta'] as const;
export type Urgency = (typeof URGENCY_LEVELS)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  nuevo: 'Nuevo',
  contactado: 'Contactado',
  indeciso: 'Indeciso',
  interesado: 'Interesado',
  negociacion: 'Negociación',
  cerrado_ganado: 'Cerrado (ganado)',
  cerrado_perdido: 'Cerrado (perdido)',
};

export const URGENCY_LABELS: Record<Urgency, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
};

export interface ExtractedInteraction {
  contact_name: string;
  property_reference: string;
  lead_status: LeadStatus;
  urgency: Urgency;
  summary: string;
  raw_transcript: string | null;
}

export interface EntityCandidate {
  id: string;
  score: number;
}

export interface ContactCandidate extends EntityCandidate {
  name: string;
  leadStatus: LeadStatus;
}

export interface PropertyCandidate extends EntityCandidate {
  addressOrZone: string;
}

export interface ExtractResponse {
  extracted: ExtractedInteraction;
  contact: { autoSelectedId: string | null; candidates: ContactCandidate[] };
  property: { autoSelectedId: string | null; candidates: PropertyCandidate[] };
}

export interface ConfirmRequestBody {
  idempotencyKey: string;
  origin: 'texto' | 'voz';
  rawText: string;
  contactName: string;
  propertyReference: string;
  leadStatus: LeadStatus;
  urgency: Urgency;
  summary: string;
  rawTranscript: string | null;
  contactId: string | null;
  propertyId: string | null;
  agent?: string | null;
}

export interface ContactRecord {
  id: string;
  name: string;
  leadStatus: LeadStatus;
  phone: string | null;
  email: string | null;
  lastContactAt: string | null;
}

export interface FollowupTaskRecord {
  id: string;
  dueAt: string;
  status: 'pendiente' | 'hecho';
  suggestedMessage: string;
  channel: 'whatsapp' | 'llamada' | 'email';
  contact: ContactRecord;
}

export type CrmAssistantStatus =
  | 'idle'
  | 'capturing'
  | 'extracting'
  | 'confirming'
  | 'saving'
  | 'saved'
  | 'error';
