import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi, beforeEach } from 'vitest';

type Row = Record<string, unknown> & { id: string; clave: string };

let rows: Row[];
let idCounter: number;

function buildFakePrisma() {
  const api = {
    captacion: {
      findMany: vi.fn(async ({ where }: { where: { clave: { in: string[] } } }) =>
        rows.filter((r) => where.clave.in.includes(r.clave)).map((r) => ({ ...r }))
      ),
      createMany: vi.fn(async ({ data }: { data: Omit<Row, 'id'>[] }) => {
        let count = 0;
        for (const d of data) {
          if (rows.some((r) => r.clave === d.clave)) continue;
          idCounter += 1;
          rows.push({ estado: 'nuevo', notas: null, contactId: null, propertyId: null, telefonoAdquiridoEn: null, ...d, id: `cap-${idCounter}` });
          count += 1;
        }
        return { count };
      }),
      update: vi.fn(async ({ where, data }: { where: { clave: string }; data: Record<string, unknown> }) => {
        const r = rows.find((x) => x.clave === where.clave)!;
        Object.assign(r, data);
        return r;
      }),
    },
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  return api;
}

vi.mock('@/lib/db', () => ({ prisma: buildFakePrisma() }));

const { POST } = await import('./route');

const TOKEN = 'token-de-prueba';
// Invented listings in the pre-2026-10 format (none of the new optional fields).
const muestra = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../../../lib/captaciones/__fixtures__/muestra_formato_viejo.json', import.meta.url)), 'utf8')
) as { corrida: { id: string }; captaciones: Record<string, unknown>[] };

function makeRequest(body: unknown, token: string | null = TOKEN) {
  return new Request('http://localhost/api/captaciones/import', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  rows = [];
  idCounter = 0;
  process.env.CAPTACION_INGEST_TOKEN = TOKEN;
});

describe('POST /api/captaciones/import', () => {
  it('rechaza sin token', async () => {
    const res = await POST(makeRequest(muestra, null));
    expect(res.status).toBe(401);
    expect(rows).toHaveLength(0);
  });

  it('rechaza con token incorrecto', async () => {
    const res = await POST(makeRequest(muestra, 'otro-token'));
    expect(res.status).toBe(401);
  });

  it('acepta la muestra', async () => {
    const res = await POST(makeRequest(muestra));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ recibidas: 3, nuevas: 3, actualizadas: 0, rechazadas: [] });
    expect(rows).toHaveLength(3);
    const primera = rows.find((r) => r.clave === 'zonaprop:10000001')!;
    expect(primera.m2Total).toBe(529);
    expect(primera.barrioPrivado).toBe(true);
    expect(primera.corridaId).toBe('2026-10-05');
  });

  it('reenviar la misma corrida no duplica nada', async () => {
    await POST(makeRequest(muestra));
    const res = await POST(makeRequest(muestra));
    const data = await res.json();
    expect(data).toEqual({ recibidas: 3, nuevas: 0, actualizadas: 3, rechazadas: [] });
    expect(rows).toHaveLength(3);
  });

  it('no pisa lo que cargó el corredor, pero sí actualiza los datos del aviso', async () => {
    await POST(makeRequest(muestra));
    const r = rows.find((x) => x.clave === 'zonaprop:10000001')!;
    const compradoEn = new Date('2026-10-06T12:00:00Z');
    Object.assign(r, {
      estado: 'tasacion',
      notas: 'Visita el jueves',
      contactId: 'contact-1',
      propertyId: 'property-1',
      telefono: '1144445555',
      telefonoAdquiridoEn: compradoEn,
    });

    const segunda = {
      corrida: { id: '2026-10-12' },
      captaciones: muestra.captaciones.map((c) =>
        c.clave === 'zonaprop:10000001' ? { ...c, precio: 280000, score: 70, telefono: '1100000000' } : c
      ),
    };
    await POST(makeRequest(segunda));

    expect(r.estado).toBe('tasacion');
    expect(r.notas).toBe('Visita el jueves');
    expect(r.contactId).toBe('contact-1');
    expect(r.propertyId).toBe('property-1');
    expect(r.telefono).toBe('1144445555');
    expect(r.precio).toBe(280000);
    expect(r.score).toBe(70);
    expect(r.corridaId).toBe('2026-10-12');
  });

  it('guarda los campos nuevos del buscador revisado', async () => {
    const con = {
      ...muestra.captaciones[0],
      senales_fuertes: ['VENTA URGENTE'],
      rechaza_inmobiliarias: true,
      abierto_a_corredores: false,
      republicado: true,
      otros_portales: ['mercadolibre'],
      analizado_por: 'agente',
    };
    const res = await POST(makeRequest({ corrida: { id: 'x' }, captaciones: [con] }));
    expect((await res.json()).rechazadas).toEqual([]);
    expect(rows[0]).toMatchObject({
      senalesFuertes: ['VENTA URGENTE'],
      rechazaInmobiliarias: true,
      abiertoACorredores: false,
      republicado: true,
      otrosPortales: ['mercadolibre'],
      analizadoPor: 'agente',
    });
  });

  it('un JSON viejo sin los campos nuevos sigue entrando, con valores vacíos', async () => {
    expect(muestra.captaciones[0]).not.toHaveProperty('senales_fuertes');
    await POST(makeRequest(muestra));
    expect(rows[0]).toMatchObject({
      senalesFuertes: [],
      rechazaInmobiliarias: null,
      abiertoACorredores: null,
      republicado: null,
      otrosPortales: [],
      analizadoPor: null,
    });
  });

  // Real owners' data: kept out of git, so this only runs where the file exists.
  const revisadaPath = fileURLToPath(new URL('../../../../../captaciones_revisadas_2026-10-05.json', import.meta.url));
  it.skipIf(!existsSync(revisadaPath))('acepta la lista revisada completa sin rechazos', async () => {
    const revisada = JSON.parse(readFileSync(revisadaPath, 'utf8'));
    const data = await (await POST(makeRequest(revisada))).json();
    expect(data).toMatchObject({ recibidas: 95, nuevas: 95, rechazadas: [] });
  });

  it('rechaza un campo nuevo con tipo incorrecto', async () => {
    const res = await POST(
      makeRequest({
        corrida: { id: 'x' },
        captaciones: [
          { ...muestra.captaciones[0], senales_fuertes: 'urgente' },
          { ...muestra.captaciones[1], rechaza_inmobiliarias: 'si' },
        ],
      })
    );
    expect((await res.json()).rechazadas).toEqual([
      { clave: muestra.captaciones[0].clave, motivo: 'senales_fuertes debe ser un array de textos.' },
      { clave: muestra.captaciones[1].clave, motivo: 'rechaza_inmobiliarias debe ser booleano o null.' },
    ]);
  });

  it('rechaza con 400 una estructura inválida', async () => {
    expect((await POST(makeRequest({ captaciones: [] }))).status).toBe(400);
    expect((await POST(makeRequest({ corrida: { id: 'x' }, captaciones: 'no' }))).status).toBe(400);
  });

  it('rechaza con 400 más de 1000 captaciones', async () => {
    const muchas = Array.from({ length: 1001 }, (_, i) => ({ ...muestra.captaciones[0], clave: `zonaprop:${i}` }));
    const res = await POST(makeRequest({ corrida: { id: 'x' }, captaciones: muchas }));
    expect(res.status).toBe(400);
    expect(rows).toHaveLength(0);
  });

  it('manda los ítems inválidos a rechazadas y guarda el resto', async () => {
    const res = await POST(
      makeRequest({
        corrida: { id: 'x' },
        captaciones: [muestra.captaciones[0], { ...muestra.captaciones[1], score: 'alto' }, muestra.captaciones[0]],
      })
    );
    const data = await res.json();
    expect(data.nuevas).toBe(1);
    expect(data.rechazadas).toEqual([
      { clave: muestra.captaciones[1].clave, motivo: 'score debe ser entero.' },
      { clave: muestra.captaciones[0].clave, motivo: 'clave repetida en la misma llamada.' },
    ]);
  });
});
