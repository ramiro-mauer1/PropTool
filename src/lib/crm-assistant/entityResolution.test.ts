import { describe, expect, it, vi } from 'vitest';

const contactFixtures = [
  { id: 'c1', name: 'Ivan Gutierrez', leadStatus: 'nuevo' },
  { id: 'c2', name: 'Ivan Lopez', leadStatus: 'nuevo' },
  { id: 'c3', name: 'Maria Fernandez', leadStatus: 'nuevo' },
];

const propertyFixtures = [
  { id: 'p1', addressOrZone: 'Departamento en Ramos Mejía' },
  { id: 'p2', addressOrZone: 'Casa en Belgrano' },
];

vi.mock('@/lib/db', () => ({
  prisma: {
    contact: { findMany: vi.fn(async () => contactFixtures) },
    property: { findMany: vi.fn(async () => propertyFixtures) },
  },
}));

const { resolveContact, resolveProperty } = await import('./entityResolution');

describe('entityResolution', () => {
  it('auto-selects a single clearly-best contact match', async () => {
    const result = await resolveContact('Maria Fernandez');
    expect(result.autoSelected?.id).toBe('c3');
  });

  it('does not auto-select when two candidates are similarly close (ambiguous first name)', async () => {
    const result = await resolveContact('Ivan');
    expect(result.autoSelected).toBeNull();
    const ids = result.candidates.map((c) => c.record.id);
    expect(ids).toContain('c1');
    expect(ids).toContain('c2');
  });

  it('returns no candidates for a name unlike anything on file', async () => {
    const result = await resolveContact('Zzyzx Qwerty');
    expect(result.autoSelected).toBeNull();
    expect(result.candidates).toHaveLength(0);
  });

  it('returns empty result for an empty query without hitting the db', async () => {
    const result = await resolveContact('');
    expect(result.autoSelected).toBeNull();
    expect(result.candidates).toHaveLength(0);
  });

  it('auto-selects a single clearly-best property match', async () => {
    const result = await resolveProperty('depto en Ramos Mejia');
    expect(result.autoSelected?.id).toBe('p1');
  });
});
