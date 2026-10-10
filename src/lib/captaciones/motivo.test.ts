import { describe, expect, it } from 'vitest';
import { normalizarCita, parseMotivo, quitarCitaDelDesglose } from './motivo';

describe('parseMotivo', () => {
  it('separa por ";" y extrae los puntos', () => {
    expect(
      parseMotivo(
        '27 días publicado (+6); precio/m² 70% sobre similares de su partido (+14); señales: Escucho ofertas, Acepto casa menor valor como parte de pago (+13)'
      )
    ).toEqual([
      { texto: '27 días publicado', puntos: 6 },
      { texto: 'precio/m² 70% sobre similares de su partido', puntos: 14 },
      { texto: 'señales: Escucho ofertas, Acepto casa menor valor como parte de pago', puntos: 13 },
    ]);
  });

  it('tolera ítems sin puntos y separadores sobrantes', () => {
    expect(parseMotivo('dueño directo; ; precio bajo (-3);')).toEqual([
      { texto: 'dueño directo', puntos: null },
      { texto: 'precio bajo', puntos: -3 },
    ]);
  });

  it('vacío → []', () => {
    expect(parseMotivo('')).toEqual([]);
    expect(parseMotivo(null)).toEqual([]);
  });
});

describe('normalizarCita', () => {
  it('pasa a mayúscula inicial las citas escritas todas en mayúsculas', () => {
    expect(normalizarCita('VENTA URGENTE')).toBe('Venta urgente');
    expect(normalizarCita('  ÚNICO DUEÑO  ')).toBe('Único dueño');
  });
  it('deja como están las citas con minúsculas o sin letras', () => {
    expect(normalizarCita('Venta por viaje')).toBe('Venta por viaje');
    expect(normalizarCita('Liquído Urg')).toBe('Liquído Urg');
    expect(normalizarCita('2x1')).toBe('2x1');
  });
});

describe('quitarCitaDelDesglose', () => {
  const items = parseMotivo('7 días publicado (+2); señales: VENTA URGENTE (+23); departamento (+15)');
  it('saca la fila cuando la cita es su única señal y devuelve sus puntos', () => {
    const r = quitarCitaDelDesglose(items, 'VENTA URGENTE');
    expect(r.puntosCita).toBe(23);
    expect(r.items.map((i) => i.texto)).toEqual(['7 días publicado', 'departamento']);
  });
  it('si la fila tiene más señales, saca solo la cita', () => {
    const r = quitarCitaDelDesglose(parseMotivo('señales: VENTA POR VIAJE, ESCUCHO OFERTAS AL CONTADO (+23)'), 'VENTA POR VIAJE');
    expect(r.puntosCita).toBeNull();
    expect(r.items).toEqual([{ texto: 'señales: ESCUCHO OFERTAS AL CONTADO', puntos: 23 }]);
  });
  it('sin cita no cambia nada', () => {
    expect(quitarCitaDelDesglose(items, null).items).toBe(items);
  });
});
