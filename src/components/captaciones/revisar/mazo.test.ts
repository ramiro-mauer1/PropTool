import { describe, expect, it } from 'vitest';
import {
  CLAVE_DESPUES,
  actual,
  armarOrden,
  crearMazo,
  decidir,
  despuesAGuardar,
  deshacer,
  guardarDespues,
  leerDespues,
  posicion,
  quitar,
  resumen,
  terminado,
  volverADespues,
} from './mazo';

const mazo = () => crearMazo(['a', 'b', 'c', 'd']);

function memoria() {
  const datos = new Map<string, string>();
  return {
    datos,
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => void datos.set(k, v),
  };
}

describe('armarOrden', () => {
  it('ordena por score descendente y respeta el orden original en los empates', () => {
    const orden = armarOrden([
      { id: 'a', score: 30 },
      { id: 'b', score: 45 },
      { id: 'c', score: 30 },
      { id: 'd', score: 50 },
    ]);
    expect(orden).toEqual(['d', 'b', 'a', 'c']);
  });

  it('deja al final las que ya se mandaron a después hoy', () => {
    const orden = armarOrden(
      [
        { id: 'a', score: 50 },
        { id: 'b', score: 40 },
        { id: 'c', score: 30 },
      ],
      ['a', 'zz']
    );
    expect(orden).toEqual(['b', 'c', 'a']);
  });

  it('es un snapshot: no cambia si después cambian las candidatas', () => {
    const candidatas = [
      { id: 'a', score: 50 },
      { id: 'b', score: 40 },
    ];
    const m = crearMazo(armarOrden(candidatas));
    candidatas[1].score = 99;
    candidatas.push({ id: 'c', score: 100 });
    expect(m.cola).toEqual(['a', 'b']);
  });
});

describe('mazo', () => {
  it('avanza con cada decisión y lleva la posición', () => {
    let m = mazo();
    expect(actual(m)).toBe('a');
    expect(posicion(m)).toBe(1);
    m = decidir(m, 'contactar');
    m = decidir(m, 'descartar');
    expect(actual(m)).toBe('c');
    expect(posicion(m)).toBe(3);
    expect(m.total).toBe(4);
  });

  it('"después" la saca de la vuelta y la guarda para la siguiente', () => {
    let m = decidir(mazo(), 'despues');
    expect(m.cola).toEqual(['b', 'c', 'd']);
    expect(m.despues).toEqual(['a']);
    m = decidir(decidir(decidir(m, 'contactar'), 'despues'), 'descartar');
    expect(terminado(m)).toBe(true);
    m = volverADespues(m);
    expect(m.cola).toEqual(['a', 'c']);
    expect(m.despues).toEqual([]);
    expect(m.total).toBe(2);
    expect(posicion(m)).toBe(1);
  });

  it('deshacer devuelve la tarjeta arriba y la saca de "después"', () => {
    let m = decidir(decidir(mazo(), 'contactar'), 'despues');
    m = deshacer(m);
    expect(actual(m)).toBe('b');
    expect(m.despues).toEqual([]);
    m = deshacer(m);
    expect(actual(m)).toBe('a');
    expect(m.historial).toHaveLength(0);
    expect(deshacer(m)).toBe(m);
  });

  it('deshacer al final de la vuelta vuelve a la última tarjeta', () => {
    let m = crearMazo(['a']);
    m = decidir(m, 'descartar');
    expect(terminado(m)).toBe(true);
    m = deshacer(m);
    expect(actual(m)).toBe('a');
    expect(terminado(m)).toBe(false);
  });

  it('quitar saca una tarjeta que desapareció sin dejar historial', () => {
    const m = quitar(mazo(), 'b');
    expect(m.cola).toEqual(['a', 'c', 'd']);
    expect(m.total).toBe(3);
    expect(m.historial).toHaveLength(0);
  });
});

describe('resumen', () => {
  it('cuenta la última decisión de cada captación', () => {
    let m = mazo();
    m = decidir(m, 'contactar'); // a
    m = decidir(m, 'descartar'); // b
    m = decidir(m, 'despues'); // c
    m = decidir(m, 'despues'); // d
    m = volverADespues(m);
    m = decidir(m, 'descartar'); // c, ahora descartada
    expect(resumen(m)).toEqual({ revisadas: 4, contactar: 1, descartadas: 2, despues: 1 });
  });

  it('lo deshecho no cuenta', () => {
    const m = deshacer(decidir(decidir(mazo(), 'contactar'), 'descartar'));
    expect(resumen(m)).toEqual({ revisadas: 1, contactar: 1, descartadas: 0, despues: 0 });
  });
});

describe('persistencia de "después"', () => {
  it('guarda y lee solo los del mismo día', () => {
    const store = memoria();
    guardarDespues(['a', 'b'], '2026-10-09', store);
    expect(leerDespues('2026-10-09', store)).toEqual(['a', 'b']);
    expect(leerDespues('2026-10-10', store)).toEqual([]);
  });

  it('tolera datos rotos y almacenamiento que falla', () => {
    const store = memoria();
    store.datos.set(CLAVE_DESPUES, '{no es json');
    expect(leerDespues('2026-10-09', store)).toEqual([]);
    const roto = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('lleno');
      },
    };
    expect(leerDespues('2026-10-09', roto)).toEqual([]);
    expect(() => guardarDespues(['a'], '2026-10-09', roto)).not.toThrow();
    expect(leerDespues('2026-10-09', null)).toEqual([]);
  });

  it('combina las guardadas al abrir con las decisiones de la sesión', () => {
    // "c" y "d" estaban en después; "c" ahora se descartó y "a" se mandó a después.
    let m = crearMazo(['a', 'b', 'c', 'd']);
    m = decidir(m, 'despues'); // a
    m = decidir(m, 'contactar'); // b
    m = decidir(m, 'descartar'); // c
    expect(despuesAGuardar(['c', 'd'], m)).toEqual(['d', 'a']);
  });
});
