'use client';

import { useSyncExternalStore } from 'react';
import { toExportBlob } from '@/lib/settings';

/**
 * Guardado de resultados (fotos mejoradas / limpias) sin sacar a la persona de la app.
 *
 * Por qué no alcanza con `<a download href="blob:...">`: en el iPhone, con Plinth
 * instalada en la pantalla de inicio (PWA standalone), ese link hace que la app
 * navegue al blob para mostrar la descarga; al volver, iOS recarga la PWA desde
 * `start_url` y se pierde todo lo que estaba en memoria (las fotos mejoradas).
 *
 * En celular se usa la hoja de compartir (`navigator.share` con archivos): se abre
 * encima de la app, tiene "Guardar imagen" (iOS) / Fotos o Archivos (Android) y al
 * cerrarla la persona sigue exactamente donde estaba. En escritorio se descarga:
 * un archivo suelto o, si son varios, un ZIP (una sola descarga, sin el aviso de
 * "este sitio quiere descargar varios archivos").
 */

export type SaveOutcome =
  /** Se abrió la hoja de compartir y la persona eligió dónde guardar. */
  | 'shared'
  /** Se descargó (un archivo o un ZIP). */
  | 'downloaded'
  /** La persona cerró la hoja de compartir sin guardar. */
  | 'cancelled'
  /**
   * El navegador pidió un toque nuevo (preparar las fotos tardó y se venció el
   * permiso del toque original). Los archivos quedan listos en `retryPendingSave`.
   */
  | 'needs-tap';

export interface SaveTarget {
  /** Resultado tal como lo devuelve el worker (blob o blob URL). */
  source: Blob | string;
  /** Nombre sin extensión: la extensión sale del formato de exportación. */
  baseName: string;
}

interface ShareCapableNavigator {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
  maxTouchPoints?: number;
}

/**
 * Decide si conviene la hoja de compartir: solo en pantallas táctiles (celular o
 * tablet) y si el navegador puede compartir estos archivos. En una Mac con Safari
 * `canShare` también da true, pero ahí se espera una descarga común.
 */
export function shouldUseShareSheet(
  files: File[],
  nav: ShareCapableNavigator | undefined,
  isTouchDevice: boolean
): boolean {
  if (!isTouchDevice || !nav || files.length === 0) return false;
  if (typeof nav.share !== 'function' || typeof nav.canShare !== 'function') return false;
  try {
    return nav.canShare({ files });
  } catch {
    return false;
  }
}

function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  // `pointer: coarse` = el puntero principal es un dedo. El iPad con "sitio de
  // escritorio" se reporta como Mac, pero con maxTouchPoints > 1.
  return (
    window.matchMedia?.('(pointer: coarse)').matches ||
    (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent))
  );
}

/** Nombre del ZIP de escritorio cuando se bajan varias fotos juntas. */
export function zipFileName(prefix: string, date = new Date()): string {
  return `${prefix}_${date.toISOString().slice(0, 10)}.zip`;
}

/** Evita nombres repetidos dentro del ZIP o de la hoja de compartir. */
export function dedupeFileNames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const count = seen.get(name) ?? 0;
    seen.set(name, count + 1);
    if (count === 0) return name;
    const dot = name.lastIndexOf('.');
    return dot > 0 ? `${name.slice(0, dot)}_${count + 1}${name.slice(dot)}` : `${name}_${count + 1}`;
  });
}

/** Convierte los resultados al formato de exportación elegido y les pone nombre. */
export async function prepareFiles(targets: SaveTarget[]): Promise<File[]> {
  const prepared: { blob: Blob; name: string }[] = [];
  for (const target of targets) {
    const source =
      typeof target.source === 'string' ? await (await fetch(target.source)).blob() : target.source;
    const { blob, ext } = await toExportBlob(source);
    prepared.push({ blob, name: `${target.baseName}.${ext}` });
  }
  const names = dedupeFileNames(prepared.map((p) => p.name));
  return prepared.map((p, i) => new File([p.blob], names[i], { type: p.blob.type || 'image/png' }));
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revocar enseguida corta la descarga en algunos navegadores: se da margen.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function downloadFiles(files: File[], zipName: string) {
  if (files.length === 1) {
    triggerDownload(files[0], files[0].name);
    return;
  }
  // JSZip se pide recién acá (solo escritorio, varias fotos): no pesa en la
  // carga inicial de la app.
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  for (const file of files) zip.file(file.name, await file.arrayBuffer());
  // Las imágenes ya vienen comprimidas: STORE es igual de chico y mucho más rápido.
  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'STORE' });
  triggerDownload(new Blob([bytes as BlobPart], { type: 'application/zip' }), zipName);
}

let pendingFiles: File[] | null = null;
const pendingListeners = new Set<() => void>();

function setPending(files: File[] | null) {
  pendingFiles = files;
  pendingListeners.forEach((listener) => listener());
}

/** Cantidad de fotos preparadas esperando un toque para abrir la hoja de compartir. */
export function pendingSaveCount(): number {
  return pendingFiles?.length ?? 0;
}

export function subscribePendingSave(listener: () => void): () => void {
  pendingListeners.add(listener);
  return () => pendingListeners.delete(listener);
}

/** Descarta las fotos preparadas (p. ej. si la persona cierra el aviso). */
export function clearPendingSave() {
  setPending(null);
}

async function shareOrDownload(files: File[], zipName: string): Promise<SaveOutcome> {
  if (typeof navigator !== 'undefined' && shouldUseShareSheet(files, navigator, isTouchDevice())) {
    try {
      await navigator.share({ files });
      setPending(null);
      return 'shared';
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      // AbortError: cerró la hoja. InvalidStateError: ya había una hoja abierta
      // (doble toque). En ningún caso hay que descargar por fuera.
      if (name === 'AbortError' || name === 'InvalidStateError') {
        setPending(null);
        return 'cancelled';
      }
      if (name === 'NotAllowedError') {
        setPending(files);
        return 'needs-tap';
      }
      // Otro error (p. ej. el sistema rechazó el tipo de archivo): se descarga.
      console.warn('[saveFiles] share falló, se descarga:', err);
    }
  }
  setPending(null);
  await downloadFiles(files, zipName);
  return 'downloaded';
}

/**
 * Guarda uno o varios resultados. En celular abre la hoja de compartir con todos
 * los archivos juntos; en escritorio descarga el archivo o un ZIP.
 * Llamarlo directo desde el click: la hoja de compartir exige un toque reciente.
 */
export async function saveResults(
  targets: SaveTarget[],
  options: { zipPrefix?: string } = {}
): Promise<SaveOutcome> {
  if (targets.length === 0) return 'cancelled';
  const files = await prepareFiles(targets);
  return shareOrDownload(files, zipFileName(options.zipPrefix ?? 'plinth_fotos'));
}

/** Reintenta, con un toque nuevo, el guardado que quedó en `needs-tap`. */
export async function retryPendingSave(options: { zipPrefix?: string } = {}): Promise<SaveOutcome> {
  const files = pendingFiles;
  if (!files) return 'cancelled';
  return shareOrDownload(files, zipFileName(options.zipPrefix ?? 'plinth_fotos'));
}

/** Texto para avisar el resultado. `null` = no hace falta avisar nada. */
export function describeOutcome(outcome: SaveOutcome, count: number): string | null {
  const fotos = count === 1 ? 'la foto' : `las ${count} fotos`;
  switch (outcome) {
    case 'downloaded':
      return count === 1 ? null : `Se descargó un ZIP con ${count} fotos.`;
    case 'needs-tap':
      return `Ya están listas ${fotos}. Tocá "Guardar" para elegir dónde guardarlas.`;
    default:
      return null;
  }
}

/** Cantidad de fotos esperando el toque de "Guardar" (0 = nada pendiente). */
export function usePendingSaveCount(): number {
  return useSyncExternalStore(subscribePendingSave, pendingSaveCount, () => 0);
}
