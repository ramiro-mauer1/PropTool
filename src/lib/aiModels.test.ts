import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The availability check caches per module load, so each test gets a fresh copy.
async function load() {
  vi.resetModules();
  return import('./aiModels');
}

describe('isLamaModelAvailable', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('is true when the model responds OK, and only asks once', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const { isLamaModelAvailable, LAMA_MODEL_URL } = await load();

    expect(await isLamaModelAvailable()).toBe(true);
    expect(await isLamaModelAvailable()).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(LAMA_MODEL_URL, { method: 'HEAD' });
  });

  it('is false when the model is not published (404)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    const { isLamaModelAvailable } = await load();

    expect(await isLamaModelAvailable()).toBe(false);
  });

  it('asks again after a network failure', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const { isLamaModelAvailable } = await load();

    expect(await isLamaModelAvailable()).toBe(false);
    expect(await isLamaModelAvailable()).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
