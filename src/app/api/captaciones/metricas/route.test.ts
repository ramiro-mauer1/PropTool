import { describe, expect, it, vi, beforeEach } from 'vitest';

type Row = { anguloEnviado: string | null; estado: string; respondioEn: Date | null; captadoEn: Date | null };
let rows: Row[];
let user: { id: string } | null;

vi.mock('@/lib/db', () => ({
  prisma: {
    captacion: {
      findMany: vi.fn(async () => rows.filter((r) => r.anguloEnviado !== null)),
    },
  },
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ auth: { getUser: async () => ({ data: { user } }) } }),
}));

const { GET } = await import('./route');
const d = new Date('2026-10-10T12:00:00Z');

beforeEach(() => {
  user = { id: 'u1' };
  rows = [];
});

describe('GET /api/captaciones/metricas', () => {
  it('cuenta por ángulo usando los hitos, no el estado actual', async () => {
    rows = [
      { anguloEnviado: 'senal', estado: 'contactado', respondioEn: null, captadoEn: null },
      // Respondió y después se descartó: sigue contando como respuesta.
      { anguloEnviado: 'senal', estado: 'descartado', respondioEn: d, captadoEn: null },
      // Captada y después vuelta atrás: sigue contando como captada.
      { anguloEnviado: 'senal', estado: 'tasacion', respondioEn: d, captadoEn: d },
      { anguloEnviado: 'mercado', estado: 'respondio', respondioEn: d, captadoEn: null },
      // Estado "respondio" sin hito: no cuenta (la métrica es el hito).
      { anguloEnviado: 'mercado', estado: 'respondio', respondioEn: null, captadoEn: null },
      { anguloEnviado: null, estado: 'captado', respondioEn: d, captadoEn: d },
    ];
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).angulos).toEqual([
      { angulo: 'senal', enviados: 3, respondieron: 2, captados: 1 },
      { angulo: 'mercado', enviados: 2, respondieron: 1, captados: 0 },
    ]);
  });

  it('exige sesión', async () => {
    user = null;
    expect((await GET()).status).toBe(401);
  });
});
