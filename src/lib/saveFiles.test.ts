import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  dedupeFileNames,
  describeOutcome,
  pendingSaveCount,
  retryPendingSave,
  saveResults,
  shouldUseShareSheet,
  zipFileName,
} from './saveFiles';

const png = (name = 'x') => new Blob([name], { type: 'image/png' });
const file = (name: string) => new File(['x'], name, { type: 'image/png' });

/** Simula un celular (pantalla táctil) con hoja de compartir. */
function stubPhone(share: (data: ShareData) => Promise<void>) {
  vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) });
  vi.stubGlobal('navigator', {
    maxTouchPoints: 5,
    userAgent: 'iPhone',
    share: vi.fn(share),
    canShare: (data: ShareData) => Boolean(data.files?.length),
  });
}

/** Simula una computadora: sin pantalla táctil, descarga con <a download>. */
function stubDesktop() {
  const clicks: string[] = [];
  vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
  vi.stubGlobal('navigator', { maxTouchPoints: 0, userAgent: 'Windows' });
  vi.stubGlobal('document', {
    createElement: () => {
      const a = { href: '', download: '', rel: '', click: () => clicks.push(a.download) };
      return a;
    },
    body: { appendChild: () => {}, removeChild: () => {} },
  });
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  return clicks;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('shouldUseShareSheet', () => {
  const nav = { share: async () => {}, canShare: () => true };

  it('usa la hoja de compartir en celular si el navegador la soporta', () => {
    expect(shouldUseShareSheet([file('a.png')], nav, true)).toBe(true);
  });

  it('en escritorio descarga aunque el navegador pueda compartir (Safari en Mac)', () => {
    expect(shouldUseShareSheet([file('a.png')], nav, false)).toBe(false);
  });

  it('descarga si el navegador no puede compartir archivos', () => {
    expect(shouldUseShareSheet([file('a.png')], { share: async () => {} }, true)).toBe(false);
    expect(shouldUseShareSheet([file('a.png')], { ...nav, canShare: () => false }, true)).toBe(false);
    expect(
      shouldUseShareSheet([file('a.png')], { ...nav, canShare: () => { throw new TypeError(); } }, true)
    ).toBe(false);
  });
});

describe('nombres', () => {
  it('no repite nombres de archivo', () => {
    expect(dedupeFileNames(['a.png', 'b.png', 'a.png', 'a.png'])).toEqual([
      'a.png',
      'b.png',
      'a_2.png',
      'a_3.png',
    ]);
  });

  it('arma el nombre del ZIP con la fecha', () => {
    expect(zipFileName('plinth_fotos', new Date('2026-10-15T12:00:00Z'))).toBe('plinth_fotos_2026-10-15.zip');
  });
});

describe('saveResults en celular', () => {
  it('comparte todas las fotos juntas en una sola hoja', async () => {
    stubPhone(async () => {});
    const outcome = await saveResults([
      { source: png('1'), baseName: 'living' },
      { source: png('2'), baseName: 'cocina' },
    ]);
    expect(outcome).toBe('shared');
    const share = (navigator as unknown as { share: ReturnType<typeof vi.fn> }).share;
    expect(share).toHaveBeenCalledTimes(1);
    const files = share.mock.calls[0][0].files as File[];
    expect(files.map((f) => f.name)).toEqual(['living.png', 'cocina.png']);
    expect(files.every((f) => f.type === 'image/png')).toBe(true);
  });

  it('si la persona cierra la hoja no descarga nada ni avisa error', async () => {
    stubPhone(async () => {
      throw new DOMException('cancelado', 'AbortError');
    });
    expect(await saveResults([{ source: png(), baseName: 'a' }])).toBe('cancelled');
    expect(pendingSaveCount()).toBe(0);
  });

  it('si el celular pide otro toque, deja las fotos listas para "Guardar"', async () => {
    let calls = 0;
    stubPhone(async () => {
      calls++;
      if (calls === 1) throw new DOMException('sin toque', 'NotAllowedError');
    });
    expect(await saveResults([{ source: png(), baseName: 'a' }, { source: png(), baseName: 'b' }])).toBe(
      'needs-tap'
    );
    expect(pendingSaveCount()).toBe(2);
    expect(await retryPendingSave()).toBe('shared');
    expect(pendingSaveCount()).toBe(0);
  });
});

describe('saveResults en escritorio', () => {
  it('una foto se descarga suelta', async () => {
    const clicks = stubDesktop();
    expect(await saveResults([{ source: png(), baseName: 'living' }])).toBe('downloaded');
    expect(clicks).toEqual(['living.png']);
  });

  it('varias fotos se descargan en un solo ZIP', async () => {
    const clicks = stubDesktop();
    const outcome = await saveResults(
      [
        { source: png('1'), baseName: 'living' },
        { source: png('2'), baseName: 'cocina' },
      ],
      { zipPrefix: 'plinth_fotos_mejoradas' }
    );
    expect(outcome).toBe('downloaded');
    expect(clicks).toHaveLength(1);
    expect(clicks[0]).toMatch(/^plinth_fotos_mejoradas_\d{4}-\d{2}-\d{2}\.zip$/);
  });
});

describe('describeOutcome', () => {
  it('avisa solo cuando hace falta', () => {
    expect(describeOutcome('shared', 3)).toBeNull();
    expect(describeOutcome('cancelled', 3)).toBeNull();
    expect(describeOutcome('downloaded', 1)).toBeNull();
    expect(describeOutcome('downloaded', 3)).toBe('Se descargó un ZIP con 3 fotos.');
    expect(describeOutcome('needs-tap', 2)).toContain('las 2 fotos');
  });
});
