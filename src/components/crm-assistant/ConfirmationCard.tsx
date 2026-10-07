'use client';

import { CheckCircle2, Loader2, UserPlus, XCircle, AlertTriangle } from 'lucide-react';
import type { CrmDraft } from '@/hooks/useCrmAssistant';
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  URGENCY_LEVELS,
  URGENCY_LABELS,
  type LeadStatus,
  type Urgency,
} from '@/types/crm-assistant';

// Mirrors src/lib/crm-assistant/followupLogic.ts — display only, the real
// date is always computed server-side.
const URGENCY_DELAY_HINT: Record<Urgency, string> = {
  alta: '2-3 días',
  media: '5-7 días',
  baja: '15-20 días',
};

interface ConfirmationCardProps {
  draft: CrmDraft;
  isSaving: boolean;
  errorMessage: string | null;
  onUpdate: (patch: Partial<CrmDraft>) => void;
  onConfirm: () => void;
  onDiscard: () => void;
}

export function ConfirmationCard({ draft, isSaving, errorMessage, onUpdate, onConfirm, onDiscard }: ConfirmationCardProps) {
  const contactAmbiguous = !draft.contactId && draft.contactCandidates.length > 0;
  const propertyAmbiguous = !draft.propertyId && draft.propertyCandidates.length > 0;

  return (
    <div className="rounded-card border border-border bg-surface-raised p-4 space-y-4 animate-fade-in-up">
      <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-0.5">
        <h3 className="text-sm font-semibold text-foreground">Confirmá antes de guardar</h3>
        <span className="text-2xs text-muted">Nada se guarda hasta que confirmes</span>
      </div>

      {/* Contact */}
      <div className="space-y-1.5">
        <label className="text-2xs font-semibold text-secondary uppercase tracking-wide">Contacto</label>
        <input
          value={draft.contactName}
          onChange={(e) => onUpdate({ contactName: e.target.value, contactId: null })}
          className="w-full rounded-subtle border border-border-subtle bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
        />
        {contactAmbiguous && (
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center gap-1.5 text-2xs text-accent">
              <AlertTriangle className="w-3 h-3" />
              <span>Más de un contacto posible — elegí uno o creá uno nuevo</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {draft.contactCandidates.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onUpdate({ contactId: c.id, contactName: c.name })}
                  className={`px-2.5 py-1 rounded-md text-2xs border transition-colors ${
                    draft.contactId === c.id
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border text-secondary hover:border-accent/50'
                  }`}
                >
                  {c.name} · {Math.round(c.score * 100)}%
                </button>
              ))}
              <button
                type="button"
                onClick={() => onUpdate({ contactId: null })}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-2xs border transition-colors ${
                  draft.contactId === null ? 'border-accent bg-accent/10 text-accent' : 'border-border text-secondary hover:border-accent/50'
                }`}
              >
                <UserPlus className="w-3 h-3" />
                <span>Crear nuevo</span>
              </button>
            </div>
          </div>
        )}
        {!contactAmbiguous && !draft.contactId && (
          <p className="text-2xs text-muted">Sin coincidencias — se creará un contacto nuevo.</p>
        )}
      </div>

      {/* Property */}
      <div className="space-y-1.5">
        <label className="text-2xs font-semibold text-secondary uppercase tracking-wide">Propiedad</label>
        <input
          value={draft.propertyReference}
          onChange={(e) => onUpdate({ propertyReference: e.target.value, propertyId: null })}
          placeholder="Sin propiedad mencionada"
          className="w-full rounded-subtle border border-border-subtle bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
        />
        {propertyAmbiguous && (
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center gap-1.5 text-2xs text-accent">
              <AlertTriangle className="w-3 h-3" />
              <span>Más de una propiedad posible — elegí una</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {draft.propertyCandidates.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onUpdate({ propertyId: p.id, propertyReference: p.addressOrZone })}
                  className={`px-2.5 py-1 rounded-md text-2xs border transition-colors ${
                    draft.propertyId === p.id
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border text-secondary hover:border-accent/50'
                  }`}
                >
                  {p.addressOrZone} · {Math.round(p.score * 100)}%
                </button>
              ))}
              <button
                type="button"
                onClick={() => onUpdate({ propertyId: null })}
                className={`px-2.5 py-1 rounded-md text-2xs border transition-colors ${
                  draft.propertyId === null ? 'border-accent bg-accent/10 text-accent' : 'border-border text-secondary hover:border-accent/50'
                }`}
              >
                Sin vincular
              </button>
            </div>
          </div>
        )}
        {!draft.propertyId && !propertyAmbiguous && !draft.propertyReference && (
          <p className="text-2xs text-muted">No se encontró ninguna propiedad en el inventario para este texto.</p>
        )}
      </div>

      {/* Lead status + urgency */}
      <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-2xs font-semibold text-secondary uppercase tracking-wide">Estado del lead</label>
          <select
            value={draft.leadStatus}
            onChange={(e) => onUpdate({ leadStatus: e.target.value as LeadStatus })}
            className="w-full rounded-subtle border border-border-subtle bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          >
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {LEAD_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-2xs font-semibold text-secondary uppercase tracking-wide">Urgencia</label>
          <select
            value={draft.urgency}
            onChange={(e) => onUpdate({ urgency: e.target.value as Urgency })}
            className="w-full rounded-subtle border border-border-subtle bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          >
            {URGENCY_LEVELS.map((u) => (
              <option key={u} value={u}>
                {URGENCY_LABELS[u]} · seguimiento en {URGENCY_DELAY_HINT[u]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary */}
      <div className="space-y-1.5">
        <label className="text-2xs font-semibold text-secondary uppercase tracking-wide">Resumen</label>
        <textarea
          value={draft.summary}
          onChange={(e) => onUpdate({ summary: e.target.value })}
          rows={2}
          className="w-full resize-none rounded-subtle border border-border-subtle bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {draft.rawTranscript && (
        <div className="space-y-1">
          <label className="text-2xs font-semibold text-muted uppercase tracking-wide">Transcripción original</label>
          <p className="text-2xs text-muted italic leading-relaxed">{draft.rawTranscript}</p>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center gap-2 text-xs text-error bg-error-muted/20 border border-error/30 rounded-subtle px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onDiscard}
          disabled={isSaving}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-secondary hover:text-error border border-transparent hover:border-error/30 transition-colors disabled:opacity-40"
        >
          <XCircle className="w-3.5 h-3.5" />
          <span>Descartar</span>
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isSaving || !draft.contactName.trim()}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-accent text-zinc-950 text-xs font-semibold shadow-subtle hover:bg-accent-hover transition-colors active:scale-[0.98] disabled:opacity-40"
        >
          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
          <span>Confirmar y guardar</span>
        </button>
      </div>
    </div>
  );
}
