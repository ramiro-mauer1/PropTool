import { describe, expect, it } from 'vitest';
import { APP_SECTIONS, isSectionActive, startHref } from './appSections';

const byModule = (m: string) => APP_SECTIONS.find((s) => s.module === m)!;

describe('isSectionActive', () => {
  it('marca la sección de la ruta exacta y de sus subrutas', () => {
    expect(isSectionActive(byModule('captaciones'), '/captaciones')).toBe(true);
    expect(isSectionActive(byModule('captaciones'), '/captaciones/123')).toBe(true);
  });

  it('no confunde rutas que sólo comparten el prefijo', () => {
    expect(isSectionActive(byModule('enhance'), '/fotosx')).toBe(false);
    expect(isSectionActive(byModule('crm'), '/')).toBe(false);
    expect(isSectionActive(byModule('crm'), null)).toBe(false);
  });

  it('deja exactamente una sección activa por ruta', () => {
    for (const s of APP_SECTIONS) {
      expect(APP_SECTIONS.filter((o) => isSectionActive(o, s.href))).toEqual([s]);
    }
  });
});

describe('startHref', () => {
  it('lleva al módulo de inicio elegido', () => {
    expect(startHref('captaciones')).toBe('/captaciones');
    expect(startHref('crm')).toBe('/cartera');
    expect(startHref('enhance')).toBe('/fotos');
  });

  it('sin preferencia abre Limpieza, como antes', () => {
    expect(startHref(null)).toBe('/limpieza');
    expect(startHref(undefined)).toBe('/limpieza');
  });
});
