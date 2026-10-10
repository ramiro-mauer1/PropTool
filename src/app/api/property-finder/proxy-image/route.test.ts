import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

const { GET } = await import('./route');

function call(url: string) {
  return GET(new NextRequest(`http://localhost/api/property-finder/proxy-image?url=${encodeURIComponent(url)}`));
}

function image(type = 'image/jpeg', init: ResponseInit = {}) {
  return new Response(new Uint8Array([1, 2, 3]), { status: 200, ...init, headers: { 'content-type': type, ...init.headers } });
}

beforeEach(() => fetchMock.mockReset());

describe('GET /api/property-finder/proxy-image', () => {
  it('sirve fotos de los portales permitidos, con headers que impiden ejecutar nada', async () => {
    fetchMock.mockResolvedValueOnce(image());
    const res = await call('https://imgar.zonapropcdn.com/avisos/1/foto.jpg');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/jpeg');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('content-security-policy')).toContain("default-src 'none'");
  });

  it('rechaza hosts fuera de la lista sin hacer el pedido', async () => {
    for (const url of [
      'https://evil.example.com/x.jpg',
      'https://zonaprop.com.evil.com/x.jpg',
      'http://http2.mlstatic.com/x.jpg',
      'https://http2.mlstatic.com:8443/x.jpg',
      'https://169.254.169.254/latest/meta-data',
    ]) {
      expect((await call(url)).status).toBe(403);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('nunca sirve SVG ni HTML', async () => {
    fetchMock.mockResolvedValueOnce(image('image/svg+xml'));
    expect((await call('https://http2.mlstatic.com/x.svg')).status).toBe(415);
    fetchMock.mockResolvedValueOnce(image('text/html'));
    expect((await call('https://http2.mlstatic.com/x.jpg')).status).toBe(415);
  });

  it('sigue redirecciones solo dentro de la lista', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'https://evil.example.com/x.jpg' } }));
    expect((await call('https://http2.mlstatic.com/x.jpg')).status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: 'https://img.zonaprop.com/x.jpg' } }))
      .mockResolvedValueOnce(image('image/webp'));
    expect((await call('https://http2.mlstatic.com/x.jpg')).status).toBe(200);
  });
});
