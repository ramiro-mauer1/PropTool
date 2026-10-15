import { describe, expect, it } from 'vitest';
import type { CaptacionEventoDTO } from '@/types/captaciones';
import { autoresDe, cambiadaPor, describirEvento, fechaHora, lineaUltimoCambio } from './historial';

function evento(over: Partial<CaptacionEventoDTO>): CaptacionEventoDTO {
  return {
    id: 'e1',
    tipo: 'estado',
    estadoAnterior: 'nuevo',
    estadoNuevo: 'descartado',
    notasCambiaron: false,
    usuarioId: 'u2',
    usuarioEmail: 'thiago@plinth.lat',
    usuarioNombre: 'Thiago',
    origen: 'app',
    // 11:12 UTC = 08:12 en Buenos Aires
    creadoEn: '2026-10-15T11:12:00.000Z',
    ...over,
  };
}

describe('historial de captaciones', () => {
  it('fecha y hora en horario de Buenos Aires', () => {
    expect(fechaHora('2026-10-15T11:12:00.000Z')).toBe('15/10 08:12');
  });

  it('la tarjeta dice quién y cuándo', () => {
    expect(
      lineaUltimoCambio({ estado: 'descartado', estadoActualizadoEn: '2026-10-15T11:12:00.000Z', eventos: [evento({})] })
    ).toBe('Descartada por Thiago · 15/10 08:12');
  });

  it('sin nombre en el perfil usa el email', () => {
    expect(
      lineaUltimoCambio({
        estado: 'descartado',
        estadoActualizadoEn: '2026-10-15T11:12:00.000Z',
        eventos: [evento({ usuarioNombre: null })],
      })
    ).toBe('Descartada por thiago@plinth.lat · 15/10 08:12');
  });

  it('las descartadas antes del registro no inventan autor', () => {
    expect(lineaUltimoCambio({ estado: 'descartado', estadoActualizadoEn: '2026-10-15T11:50:51.637Z', eventos: [] })).toBe(
      'Descartada · 15/10 (antes del registro)'
    );
  });

  it('si el último evento no explica el estado actual, cae en "antes del registro"', () => {
    // Solo hay un alta, pero la captación está descartada: el descarte fue antes del registro.
    const alta = evento({ tipo: 'alta', estadoAnterior: null, estadoNuevo: 'nuevo', usuarioId: null, usuarioEmail: null, usuarioNombre: null, origen: 'importacion' });
    expect(lineaUltimoCambio({ estado: 'descartado', estadoActualizadoEn: '2026-10-14T23:29:00.000Z', eventos: [alta] })).toBe(
      'Descartada · 14/10 (antes del registro)'
    );
  });

  it('una nueva sin cambios no muestra línea', () => {
    expect(lineaUltimoCambio({ estado: 'nuevo', estadoActualizadoEn: '2026-10-15T11:12:00.000Z', eventos: [] })).toBeNull();
  });

  it('un cambio de notas no tapa quién cambió el estado', () => {
    const notas = evento({ id: 'e2', tipo: 'notas', estadoAnterior: 'descartado', notasCambiaron: true, usuarioId: 'u1', usuarioNombre: 'Jota' });
    expect(
      lineaUltimoCambio({ estado: 'descartado', estadoActualizadoEn: '2026-10-15T11:12:00.000Z', eventos: [evento({}), notas] })
    ).toBe('Descartada por Thiago · 15/10 08:12');
  });

  it('describe cada fila del historial', () => {
    expect(describirEvento(evento({ estadoAnterior: 'tasacion' }))).toBe('Tasación → Descartada');
    expect(describirEvento(evento({ notasCambiaron: true }))).toBe('Nueva → Descartada (con motivo)');
    expect(describirEvento(evento({ tipo: 'notas', notasCambiaron: true }))).toBe('Cambió las notas');
    expect(describirEvento(evento({ tipo: 'alta', estadoAnterior: null, estadoNuevo: 'nuevo' }))).toBe('Entró por la importación automática');
  });

  it('el filtro "Cambiado por" lista a las personas, no a la importación', () => {
    const caps = [
      { eventos: [evento({}), evento({ id: 'e3', usuarioId: null, usuarioNombre: null, usuarioEmail: null, tipo: 'alta' })] },
      { eventos: [evento({ id: 'e4', usuarioId: 'u1', usuarioNombre: 'Jota', usuarioEmail: 'jota@plinth.lat' })] },
    ];
    expect(autoresDe(caps)).toEqual([
      { id: 'u1', label: 'Jota' },
      { id: 'u2', label: 'Thiago' },
    ]);
    expect(caps.filter((c) => cambiadaPor(c, 'u1'))).toEqual([caps[1]]);
  });
});
