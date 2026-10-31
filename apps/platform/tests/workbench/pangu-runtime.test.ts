import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Exercise the production adapter at the browser/SDK boundary, without claiming a real SDK.
function environment() {
  const scripts: Array<{
    src: string; async: boolean; onload: (() => void) | null;
    onerror: (() => void) | null; remove: ReturnType<typeof vi.fn>;
  }> = [];
  const append = vi.fn();
  const document = {
    createElement: () => {
      const script = { src: '', async: false, onload: null, onerror: null, remove: vi.fn() };
      scripts.push(script);
      return script;
    },
    head: { append }, scripts
  };
  const instance = vi.fn(() => ({ renderChat: vi.fn(), destroy: vi.fn() }));
  const window = {
    __METRICCANVAS_PANGU__: { resourceUrl: '/sdk.js', version: '1' },
    location: { href: 'https://platform.test/' },
    setTimeout, pangu: undefined as { instance: typeof instance } | undefined
  };
  vi.stubGlobal('window', window);
  vi.stubGlobal('document', document);
  const host = (id = 'existing') => ({ id, isConnected: true }) as HTMLElement;
  const complete = (index: number) => { window.pangu = { instance }; scripts[index].onload?.(); };
  return { scripts, append, window, instance, host, complete };
}
const tick = async () => { await Promise.resolve(); await Promise.resolve(); };

beforeEach(() => { vi.resetModules(); vi.useFakeTimers(); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('Pangu resource and instance boundary', () => {
  it('reads deployment configuration lazily at every mount without using the legacy global', async () => {
    const env = environment();
    env.window.__METRICCANVAS_PANGU__ = { resourceUrl: '/wrong.js', version: 'legacy' };
    const read = vi.fn(() => ({ resourceUrl: '/sdk.js', version: '1' }));
    const { createPanguDialogueAdapter } = await import('../../src/lib/dialogue/runtime');
    const adapter = createPanguDialogueAdapter(read);
    expect(read).not.toHaveBeenCalled();
    const pending = adapter.mount(env.host()); await tick();
    expect(env.scripts[0].src).toBe('https://platform.test/sdk.js?v=1');
    env.complete(0); (await pending)();
    (await adapter.mount(env.host()))();
    expect(read).toHaveBeenCalledTimes(2);
    expect(env.scripts).toHaveLength(1);
  });

  it.each([null, undefined])('does not fall back from an explicit empty reader result (%s)', async config => {
    const env = environment();
    const { createPanguDialogueAdapter } = await import('../../src/lib/dialogue/runtime');
    await expect(createPanguDialogueAdapter(() => config).mount(env.host())).rejects.toThrow('未配置盘古静态资源地址和版本号');
    expect(env.append).not.toHaveBeenCalled();
    expect(env.instance).not.toHaveBeenCalled();
  });

  it('masks deployment reader errors and permits recovery on a later mount', async () => {
    const env = environment();
    const read = vi.fn().mockImplementationOnce(() => { throw Error('private-deployment-value'); })
      .mockReturnValue({ resourceUrl: '/sdk.js', version: '1' });
    const { createPanguDialogueAdapter } = await import('../../src/lib/dialogue/runtime');
    const adapter = createPanguDialogueAdapter(read);
    await expect(adapter.mount(env.host())).rejects.toThrow('盘古部署配置读取失败，请检查部署侧配置读取函数。');
    expect(env.append).not.toHaveBeenCalled();
    const pending = adapter.mount(env.host()); await tick();
    env.complete(0); (await pending)();
  });

  it('shares the version pin across injected readers and the legacy default adapter', async () => {
    const env = environment();
    const { createPanguDialogueAdapter, panguDialogueAdapter } = await import('../../src/lib/dialogue/runtime');
    const first = createPanguDialogueAdapter(() => ({ resourceUrl: '/sdk.js', version: '1' }));
    const pending = first.mount(env.host()); await tick(); env.complete(0); (await pending)();
    env.window.__METRICCANVAS_PANGU__.version = '2';
    await expect(panguDialogueAdapter.mount(env.host())).rejects.toThrow('重新加载页面');
    const second = createPanguDialogueAdapter(() => ({ resourceUrl: '/other.js', version: '1' }));
    await expect(second.mount(env.host())).rejects.toThrow('重新加载页面');
    expect(env.scripts).toHaveLength(1);
  });

  it('rejects incomplete explicit configuration instead of borrowing legacy fields', async () => {
    const env = environment();
    const { createPanguDialogueAdapter } = await import('../../src/lib/dialogue/runtime');
    const adapter = createPanguDialogueAdapter(() => ({ resourceUrl: '/sdk.js', version: '' }));
    await expect(adapter.mount(env.host())).rejects.toThrow('静态资源地址或版本号未配置');
    expect(env.append).not.toHaveBeenCalled();
  });

  it('reuses an identifiable preloaded portal SDK without appending another loader', async () => {
    const env = environment();
    env.scripts.push({ src: 'https://platform.test/sdk.js?v=1', async: true, onload: null, onerror: null, remove: vi.fn() });
    env.window.pangu = { instance: env.instance };
    const { panguDialogueAdapter: adapter } = await import('../../src/lib/dialogue/runtime');
    const stop = await adapter.mount(env.host());
    expect(env.append).not.toHaveBeenCalled(); expect(env.instance).toHaveBeenCalledTimes(1);
    stop(); expect(env.scripts[0].remove).not.toHaveBeenCalled();
  });

  it('rejects an unidentified preloaded SDK instead of loading a second version', async () => {
    const env = environment(); env.window.pangu = { instance: env.instance };
    const { panguDialogueAdapter: adapter } = await import('../../src/lib/dialogue/runtime');
    await expect(adapter.mount(env.host())).rejects.toThrow('地址或版本无法核实');
    expect(env.append).not.toHaveBeenCalled(); expect(env.instance).not.toHaveBeenCalled();
  });

  it('shares one load, confines independent instances, restores only owned container IDs', async () => {
    const env = environment();
    const { panguDialogueAdapter: adapter } = await import('../../src/lib/dialogue/runtime');
    const left = env.host('left'), right = env.host('right');
    const a = adapter.mount(left), b = adapter.mount(right);
    await tick();
    expect(env.scripts).toHaveLength(1);
    expect(env.scripts[0].src).toBe('https://platform.test/sdk.js?v=1');
    env.complete(0);
    const stopA = await a, stopB = await b;
    expect(left.id).not.toBe(right.id);
    expect(env.instance).toHaveBeenCalledTimes(2);
    const first = env.instance.mock.results[0].value;
    expect(first.renderChat).toHaveBeenCalledWith(`#${left.id}`, {
      instanceId: left.id, config: {
        mode: 'side', autoRecover: false, draggable: false, resizable: false, adsorbable: false
      }
    });
    stopA(); stopA();
    expect(first.destroy).toHaveBeenCalledTimes(1);
    expect(left.id).toBe('left');
    expect(env.instance.mock.results[1].value.destroy).not.toHaveBeenCalled();
    right.id = 'replacement'; stopB();
    expect(right.id).toBe('replacement');
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['error', 'timeout', 'missing-api', 'append-error'] as const)(
    'releases a failed resource (%s), retries only the same version', async (failure) => {
      const env = environment();
      const { panguDialogueAdapter: adapter } = await import('../../src/lib/dialogue/runtime');
      if (failure === 'append-error') env.append.mockImplementationOnce(() => { throw Error('append failed'); });
      const rejected = expect(adapter.mount(env.host())).rejects.toThrow('静态资源加载失败');
      await tick();
      const script = env.scripts[0];
      if (failure === 'error') script.onerror?.();
      if (failure === 'timeout') await vi.advanceTimersByTimeAsync(15000);
      if (failure === 'missing-api') { vi.stubGlobal('window', { ...env.window, pangu: undefined }); script.onload?.(); }
      await rejected;
      expect(script.remove).toHaveBeenCalledTimes(1);
      expect(script.onload).toBeNull(); expect(script.onerror).toBeNull();
      expect(vi.getTimerCount()).toBe(0);
      vi.stubGlobal('window', env.window);
      env.window.__METRICCANVAS_PANGU__.version = '2';
      await expect(adapter.mount(env.host())).rejects.toThrow('重新加载页面');
      expect(env.scripts).toHaveLength(1);
      env.window.__METRICCANVAS_PANGU__.version = '1';
      const retry = adapter.mount(env.host()); await tick();
      expect(env.scripts).toHaveLength(2);
      env.complete(1); (await retry)();
    }
  );

  it('does not instantiate a detached container after resource completion', async () => {
    const env = environment();
    const { panguDialogueAdapter: adapter } = await import('../../src/lib/dialogue/runtime');
    const host = env.host(); const pending = adapter.mount(host);
    await tick(); // Model navigation while the SDK loads.
    Object.defineProperty(host, 'isConnected', { value: false });
    env.complete(0); (await pending)();
    expect(env.instance).not.toHaveBeenCalled(); expect(host.id).toBe('existing');
  });

  it('releases a failed render, masks SDK errors and permits a fresh instance retry', async () => {
    const env = environment();
    const failed = { renderChat: vi.fn(() => { throw Error('runtime-private-value'); }), destroy: vi.fn(() => { throw Error('cleanup-private-value'); }) };
    env.instance.mockReturnValueOnce(failed);
    const { panguDialogueAdapter: adapter } = await import('../../src/lib/dialogue/runtime');
    const host = env.host();
    const rejected = expect(adapter.mount(host)).rejects.toThrow('盘古实例挂载失败，请核对 SDK 版本与适配配置。');
    await tick(); env.complete(0); await rejected;
    expect(failed.destroy).toHaveBeenCalledTimes(1); expect(host.id).toBe('existing');
    (await adapter.mount(host))(); expect(env.scripts).toHaveLength(1);
    expect(host.id).toBe('existing');
  });

  it('restores the container if instance creation throws', async () => {
    const env = environment(); env.instance.mockImplementation(() => { throw Error('private'); });
    const { panguDialogueAdapter: adapter } = await import('../../src/lib/dialogue/runtime');
    const host = env.host(); const rejected = expect(adapter.mount(host)).rejects.toThrow('盘古实例挂载失败');
    await tick(); env.complete(0); await rejected;
    expect(host.id).toBe('existing');
  });

  it('never retries destroy or overwrites a replacement ID when destruction fails', async () => {
    const env = environment();
    const sdk = { renderChat: vi.fn(), destroy: vi.fn(() => { throw Error('private'); }) };
    env.instance.mockReturnValue(sdk);
    const { panguDialogueAdapter: adapter } = await import('../../src/lib/dialogue/runtime');
    const host = env.host(); const pending = adapter.mount(host);
    await tick(); env.complete(0); const stop = await pending;
    expect(stop).not.toThrow();
    expect(host.id).toBe('existing'); stop(); expect(sdk.destroy).toHaveBeenCalledTimes(1);
  });

  it('loads a new deployment version in a new document with the same adapter contract', async () => {
    const env = environment();
    let adapter = (await import('../../src/lib/dialogue/runtime')).panguDialogueAdapter;
    const first = adapter.mount(env.host()); await tick(); env.complete(0); (await first)();
    env.window.__METRICCANVAS_PANGU__.version = '2';
    await expect(adapter.mount(env.host())).rejects.toThrow('重新加载页面');
    vi.resetModules(); env.window.pangu = undefined;
    adapter = (await import('../../src/lib/dialogue/runtime')).panguDialogueAdapter;
    const second = adapter.mount(env.host()); await tick();
    expect(env.scripts[1].src).toBe('https://platform.test/sdk.js?v=2');
    env.complete(1); (await second)();
  });

  it('normalizes a synchronous loader failure into a retryable rejection', async () => {
    const { createPanguResourceLoader } = await import('../../src/lib/dialogue/runtime');
    const load = vi.fn().mockImplementationOnce(() => { throw Error('offline'); }).mockResolvedValue(undefined);
    const resource = createPanguResourceLoader(load);
    await expect(resource('sdk-v1')).rejects.toThrow('offline');
    await resource('sdk-v1'); expect(load).toHaveBeenCalledTimes(2);
  });
});
