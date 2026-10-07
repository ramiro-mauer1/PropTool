import { describe, expect, it } from 'vitest';
import { parseMotivo } from './motivo';

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
