'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Send, Square, Loader2, AlertCircle } from 'lucide-react';

interface CaptureInputProps {
  disabled?: boolean;
  onSubmitText: (text: string) => void;
  onSubmitAudio: (blob: Blob) => void;
  onRecordingChange?: (isRecording: boolean) => void;
  onMicLevel?: (level: number) => void;
}

export function CaptureInput({
  disabled,
  onSubmitText,
  onSubmitAudio,
  onRecordingChange,
  onMicLevel,
}: CaptureInputProps) {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const levelRafRef = useRef<number | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopLevelMeter = useCallback(() => {
    if (levelRafRef.current) {
      cancelAnimationFrame(levelRafRef.current);
      levelRafRef.current = null;
    }
    analyserRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    onMicLevel?.(0);
  }, [onMicLevel]);

  const startLevelMeter = useCallback(
    (stream: MediaStream) => {
      try {
        const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        const audioCtx = new AudioCtx();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.6;
        source.connect(analyser);
        audioCtxRef.current = audioCtx;
        analyserRef.current = analyser;

        const data = new Uint8Array(analyser.fftSize);
        const tick = () => {
          const currentAnalyser = analyserRef.current;
          if (!currentAnalyser) return;
          currentAnalyser.getByteTimeDomainData(data);
          let sumSquares = 0;
          for (let i = 0; i < data.length; i++) {
            const centered = (data[i] - 128) / 128;
            sumSquares += centered * centered;
          }
          const rms = Math.sqrt(sumSquares / data.length);
          // voice RMS rarely clears ~0.35; scale up so the orb actually swings
          onMicLevel?.(Math.min(1, rms * 3.2));
          levelRafRef.current = requestAnimationFrame(tick);
        };
        levelRafRef.current = requestAnimationFrame(tick);
      } catch (err) {
        console.warn('[CaptureInput] level meter failed:', err);
      }
    },
    [onMicLevel]
  );

  useEffect(() => () => {
    stopTimer();
    stopLevelMeter();
  }, [stopTimer, stopLevelMeter]);

  const handleSubmitText = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSubmitText(trimmed);
    setText('');
  }, [text, disabled, onSubmitText]);

  const startRecording = useCallback(async () => {
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (blob.size > 0) onSubmitAudio(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      onRecordingChange?.(true);
      setRecordSeconds(0);
      timerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
      startLevelMeter(stream);
    } catch (err) {
      console.warn('[CaptureInput] mic access failed:', err);
      setMicError('No se pudo acceder al micrófono. Revisá los permisos del navegador.');
    }
  }, [onSubmitAudio, onRecordingChange, startLevelMeter]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    onRecordingChange?.(false);
    stopTimer();
    stopLevelMeter();
  }, [stopTimer, stopLevelMeter, onRecordingChange]);

  const formattedTime = `${Math.floor(recordSeconds / 60)}:${String(recordSeconds % 60).padStart(2, '0')}`;

  return (
    <div className="rounded-card border border-border bg-surface p-4 space-y-3">
      <label className="text-xs font-semibold text-secondary uppercase tracking-wide">
        Nueva interacción con cliente
      </label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={disabled || isRecording}
        placeholder='Ej: "Ivan me habló hoy por el departamento en Ramos Mejía, todavía no sabe si va a vender, tengo que hacerle seguimiento"'
        rows={3}
        className="w-full resize-none rounded-subtle border border-border-subtle bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmitText();
        }}
      />

      {micError && (
        <div className="flex items-center gap-2 text-xs text-error">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{micError}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          disabled={disabled}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors active:scale-[0.98] disabled:opacity-40 ${
            isRecording
              ? 'bg-error/10 text-error border border-error/30'
              : 'bg-surface-raised text-secondary border border-border hover:border-accent hover:text-accent'
          }`}
        >
          {isRecording ? (
            <>
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Detener · {formattedTime}</span>
            </>
          ) : (
            <>
              <Mic className="w-3.5 h-3.5" />
              <span>Grabar audio</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleSubmitText}
          disabled={disabled || isRecording || !text.trim()}
          className="flex items-center gap-2 px-4 py-1.5 rounded-md bg-accent text-zinc-950 text-xs font-semibold shadow-subtle hover:bg-accent-hover transition-colors active:scale-[0.98] disabled:opacity-40 disabled:cursor-default"
        >
          {disabled ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          <span>Extraer</span>
        </button>
      </div>
    </div>
  );
}
