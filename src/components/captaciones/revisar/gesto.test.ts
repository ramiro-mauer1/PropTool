import { describe, expect, it } from 'vitest';
import { formatAntiguedad } from '../format';
import { decisionDelGesto } from './RevisarTarjeta';

const quieto = { x: 0, y: 0 };

describe('decisionDelGesto (tarjeta de 400 px: umbral 140 px)', () => {
  it('confirma por desplazamiento mayor al 35% del ancho', () => {
    expect(decisionDelGesto({ x: 150, y: 10 }, quieto, 400)).toBe('contactar');
    expect(decisionDelGesto({ x: -150, y: 10 }, quieto, 400)).toBe('descartar');
    expect(decisionDelGesto({ x: 10, y: -150 }, quieto, 400)).toBe('despues');
  });

  it('confirma por velocidad aunque el desplazamiento sea corto', () => {
    expect(decisionDelGesto({ x: 40, y: 0 }, { x: 800, y: 0 }, 400)).toBe('contactar');
    expect(decisionDelGesto({ x: -40, y: 0 }, { x: -800, y: 0 }, 400)).toBe('descartar');
    expect(decisionDelGesto({ x: 0, y: -40 }, { x: 0, y: -800 }, 400)).toBe('despues');
  });

  it('vuelve si no llega a ningún umbral, o si se arrastra hacia abajo', () => {
    expect(decisionDelGesto({ x: 100, y: 0 }, { x: 200, y: 0 }, 400)).toBeNull();
    expect(decisionDelGesto({ x: 0, y: 300 }, { x: 0, y: 900 }, 400)).toBeNull();
  });

  it('un tirón en contra del desplazamiento no confirma', () => {
    expect(decisionDelGesto({ x: -20, y: 0 }, { x: 900, y: 0 }, 400)).toBeNull();
  });
});

describe('formatAntiguedad', () => {
  it('días, meses y años', () => {
    expect(formatAntiguedad(null)).toBeNull();
    expect(formatAntiguedad(0)).toBe('Hoy');
    expect(formatAntiguedad(1)).toBe('1 día');
    expect(formatAntiguedad(29)).toBe('29 días');
    expect(formatAntiguedad(45)).toBe('+1 mes');
    expect(formatAntiguedad(280)).toBe('+9 meses');
    expect(formatAntiguedad(800)).toBe('+2 años');
  });
});
