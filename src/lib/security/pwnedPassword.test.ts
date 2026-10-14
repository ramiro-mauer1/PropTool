import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { COMMON_PASSWORD_MIN_COUNT, isPwnedPassword } from './pwnedPassword';

const suffixOf = (password: string) => createHash('sha1').update(password).digest('hex').toUpperCase().slice(5);

/** HIBP answers with every suffix sharing the prefix; this one lists ours `count` times. */
function stubHibp(password: string, count: number) {
  const body = `0000000000000000000000000000000000A:12\r\n${suffixOf(password)}:${count}\r\n`;
  vi.stubGlobal('fetch', vi.fn(async () => new Response(body)));
}

afterEach(() => vi.unstubAllGlobals());

describe('isPwnedPassword', () => {
  it('rechaza las contraseñas archiconocidas', async () => {
    stubHibp('12345678', 2_000_000);
    expect(await isPwnedPassword('12345678')).toBe(true);
  });

  it('deja pasar una que apareció pocas veces', async () => {
    stubHibp('mariana1990', COMMON_PASSWORD_MIN_COUNT - 1);
    expect(await isPwnedPassword('mariana1990')).toBe(false);
  });

  it('deja pasar una que nunca apareció', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('0000000000000000000000000000000000A:12\r\n')));
    expect(await isPwnedPassword('una-clave-nueva-de-verdad')).toBe(false);
  });

  it('si HIBP no responde, no bloquea a nadie', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('timeout'); }));
    expect(await isPwnedPassword('12345678')).toBe(false);
  });

  it('solo manda los primeros 5 caracteres del hash', async () => {
    stubHibp('12345678', 1);
    await isPwnedPassword('12345678');
    const url = String(vi.mocked(fetch).mock.calls[0][0]);
    expect(url).toMatch(/\/range\/[0-9A-F]{5}$/);
  });
});
