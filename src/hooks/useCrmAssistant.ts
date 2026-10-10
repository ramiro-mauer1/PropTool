import { useCallback, useState } from 'react';
import type {
  ConfirmRequestBody,
  ContactCandidate,
  CrmAssistantStatus,
  LeadStatus,
  PropertyCandidate,
  Urgency,
} from '@/types/crm-assistant';

export interface CrmDraft {
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
  contactCandidates: ContactCandidate[];
  propertyCandidates: PropertyCandidate[];
}

export interface SavedResult {
  contactId: string;
  contactName: string;
  followupDueAt: string;
  suggestedMessage: string;
}

interface UseCrmAssistantOptions {
  agent?: string | null;
  onSaved?: (result: SavedResult) => void;
}

async function fileToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function useCrmAssistant({ agent, onSaved }: UseCrmAssistantOptions = {}) {
  const [status, setStatus] = useState<CrmAssistantStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState<CrmDraft | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [savedResult, setSavedResult] = useState<SavedResult | null>(null);

  const reset = useCallback(() => {
    setStatus('idle');
    setErrorMessage(null);
    setDraft(null);
    setIdempotencyKey(null);
    setSavedResult(null);
  }, []);

  const runExtraction = useCallback(
    async (body: { text?: string; audio?: { base64: string; mimeType: string } }, origin: 'texto' | 'voz', rawText: string) => {
      setStatus('extracting');
      setErrorMessage(null);
      try {
        const res = await fetch('/api/crm/interactions/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, agent: agent ?? null }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'No se pudo extraer la interacción.');
        }

        setDraft({
          origin,
          rawText,
          contactName: data.extracted.contact_name,
          propertyReference: data.extracted.property_reference,
          leadStatus: data.extracted.lead_status,
          urgency: data.extracted.urgency,
          summary: data.extracted.summary,
          rawTranscript: data.extracted.raw_transcript,
          contactId: data.contact.autoSelectedId,
          propertyId: data.property.autoSelectedId,
          contactCandidates: data.contact.candidates,
          propertyCandidates: data.property.candidates,
        });
        setIdempotencyKey(crypto.randomUUID());
        setStatus('confirming');
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Error inesperado al extraer.');
        setStatus('error');
      }
    },
    [agent]
  );

  const submitText = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      void runExtraction({ text: trimmed }, 'texto', trimmed);
    },
    [runExtraction]
  );

  const submitAudio = useCallback(
    async (blob: Blob) => {
      setStatus('extracting');
      try {
        const base64 = await fileToBase64(blob);
        await runExtraction(
          { audio: { base64, mimeType: blob.type || 'audio/webm' } },
          'voz',
          '' // filled in from raw_transcript once extraction returns
        );
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'No se pudo procesar el audio.');
        setStatus('error');
      }
    },
    [runExtraction]
  );

  const updateDraft = useCallback((patch: Partial<CrmDraft>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const discard = useCallback(() => {
    reset();
  }, [reset]);

  const confirm = useCallback(async () => {
    if (!draft || !idempotencyKey) return;
    setStatus('saving');
    setErrorMessage(null);

    const rawText = draft.rawText || draft.rawTranscript || draft.summary;

    const body: ConfirmRequestBody = {
      idempotencyKey,
      origin: draft.origin,
      rawText,
      contactName: draft.contactName,
      propertyReference: draft.propertyReference,
      leadStatus: draft.leadStatus,
      urgency: draft.urgency,
      summary: draft.summary,
      rawTranscript: draft.rawTranscript,
      contactId: draft.contactId,
      propertyId: draft.propertyId,
      agent: agent ?? null,
    };

    try {
      const res = await fetch('/api/crm/interactions/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo guardar la interacción.');
      }

      const result: SavedResult = {
        contactId: data.contact.id,
        contactName: data.contact.name,
        followupDueAt: data.followupTask.dueAt,
        suggestedMessage: data.followupTask.suggestedMessage,
      };
      setSavedResult(result);
      setStatus('saved');
      onSaved?.(result);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Error inesperado al guardar.');
      setStatus('error');
    }
  }, [draft, idempotencyKey, agent, onSaved]);

  return {
    status,
    errorMessage,
    draft,
    savedResult,
    submitText,
    submitAudio,
    updateDraft,
    confirm,
    discard,
    reset,
  };
}
