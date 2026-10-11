'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, MessageCircle } from 'lucide-react';
import { useCrmAssistant } from '@/hooks/useCrmAssistant';
import MatrixOrb, { type MatrixOrbState } from '@/components/ui/matrix-orb';
import { CaptureInput } from './CaptureInput';
import { ConfirmationCard } from './ConfirmationCard';
import { FollowupTasksList } from './FollowupTasksList';

interface CrmAssistantModuleProps {
  agentName?: string | null;
  /** Cómo el agente eligió que lo llamen (bienvenida / Configuración). */
  preferredName?: string | null;
}

const ORB_LABELS: Record<MatrixOrbState, string> = {
  idle: 'Tu asistente está listo',
  listening: 'Escuchando…',
  thinking: 'Analizando la interacción…',
};

export function CrmAssistantModule({ agentName, preferredName }: CrmAssistantModuleProps) {
  const [tasksRefreshKey, setTasksRefreshKey] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [micLevel, setMicLevel] = useState(0);

  // El orbe se dibuja en un canvas de tamaño fijo: en teléfonos se achica para
  // dejar aire al capturador de texto y a la lista de seguimientos.
  const [orbSize, setOrbSize] = useState(200);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const apply = () => setOrbSize(mq.matches ? 144 : 200);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const { status, errorMessage, draft, savedResult, submitText, submitAudio, updateDraft, confirm, discard, reset } =
    useCrmAssistant({
      agent: agentName,
      onSaved: () => setTasksRefreshKey((k) => k + 1),
    });

  const orbState: MatrixOrbState = status === 'extracting' ? 'thinking' : isRecording ? 'listening' : 'idle';
  const orbLevel = orbState === 'listening' ? micLevel : undefined;

  const handleDismissSaved = useCallback(() => reset(), [reset]);

  return (
    <div className="flex-1 overflow-y-auto lg:overflow-hidden p-3 sm:p-6 overscroll-contain">
      <div className="max-w-6xl mx-auto min-h-full lg:h-full flex flex-col gap-3 sm:gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-foreground">Cartera Inteligente</h2>
          <p className="text-xs text-muted mt-0.5">
            Contale al asistente cómo fue la charla con el cliente — texto o voz — y confirmá antes de que se guarde nada.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center gap-2 sm:gap-3 py-1 sm:py-2 shrink-0">
          <div className="rounded-full shadow-[0_0_70px_-12px_var(--color-accent-muted)]">
            <MatrixOrb
              state={orbState}
              level={orbLevel}
              size={orbSize}
              dots={13}
              color="#d4ff32"
              hideLabel
            />
          </div>
          <span className="text-xs font-medium text-secondary tracking-wide">
            {orbState === 'idle' && preferredName ? `Hola, ${preferredName}. ¿Cómo te fue con el cliente?` : ORB_LABELS[orbState]}
          </span>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 min-h-0 lg:overflow-hidden">
          <div className="space-y-4 lg:overflow-y-auto lg:pr-1">
            {status === 'saved' && savedResult ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-card border border-accent/30 bg-accent/5 p-4 space-y-2"
              >
                <div className="flex items-center gap-2 text-accent text-sm font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  Interacción guardada
                </div>
                <p className="text-xs text-secondary">
                  Se actualizó el lead de <strong>{savedResult.contactName}</strong> y se creó una tarea de seguimiento para el{' '}
                  {new Date(savedResult.followupDueAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'long' })}.
                </p>
                <div className="flex items-start gap-1.5 text-2xs text-muted bg-background rounded-subtle border border-border-subtle p-2">
                  <MessageCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{savedResult.suggestedMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={handleDismissSaved}
                  className="text-2xs font-semibold text-accent hover:text-accent-hover transition-colors"
                >
                  Registrar otra interacción →
                </button>
              </motion.div>
            ) : (
              <CaptureInput
                disabled={status === 'extracting'}
                onSubmitText={submitText}
                onSubmitAudio={submitAudio}
                onRecordingChange={setIsRecording}
                onMicLevel={setMicLevel}
              />
            )}

            {status === 'error' && !draft && (
              <div className="text-xs text-error bg-error-muted/20 border border-error/30 rounded-subtle px-3 py-2">
                {errorMessage}
              </div>
            )}

            <AnimatePresence>
              {draft && status !== 'saved' && (
                <ConfirmationCard
                  draft={draft}
                  isSaving={status === 'saving'}
                  errorMessage={status === 'error' ? errorMessage : null}
                  onUpdate={updateDraft}
                  onConfirm={confirm}
                  onDiscard={discard}
                />
              )}
            </AnimatePresence>
          </div>

          <div className="min-h-[240px] lg:min-h-0 pb-2 lg:pb-0">
            <FollowupTasksList refreshKey={tasksRefreshKey} />
          </div>
        </div>
      </div>
    </div>
  );
}
