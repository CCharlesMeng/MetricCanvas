import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPlatformServices } from '../../src/lib/integration/services';
import { createPlatformSession } from '../../src/lib/integration/session';
import type { PlatformNavigation } from '../../src/lib/integration/navigation';
import type { DialogueAdapter } from '../../src/lib/dialogue/port';

// The service factory only reads base; navigation itself is outside this SDK boundary.
function navigation(): PlatformNavigation {
  return {
    base: '/metrics', replaceSearch:()=>{}, resolve: path => `/metrics${path}`,
    navigate: async () => false, canLeave: () => true,
    current: () => new URL('https://platform.test/metrics'),
    checkpoint: () => ({ href: 'https://platform.test/metrics', revision: 0 }),
    subscribe: () => () => {}, registerGuard: () => () => {}, destroy() {}
  };
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('platform dialogue assembly', () => {
  function services(dialogueAdapter?: DialogueAdapter) {
    vi.stubGlobal('location', { origin: 'https://platform.test' });
    const session = createPlatformSession({ readConfig: () => null });
    return createPlatformServices(session, navigation(), { embedded: true, dialogueAdapter });
  }

  it('mounts the configured SDK when the portal omits an adapter, and releases only its instance', async () => {
    const destroy = vi.fn(), renderChat = vi.fn();
    const instance = vi.fn(() => ({ renderChat, destroy }));
    vi.stubGlobal('window', {
      __METRICCANVAS_PANGU__: { resourceUrl: '/sdk.js', version: '1' },
      location: { href: 'https://platform.test/metrics' }, pangu: { instance }
    });
    const script = { src: 'https://platform.test/sdk.js?v=1' };
    vi.stubGlobal('document', { scripts: [script] });
    const host = { id: 'portal-container', isConnected: true } as HTMLElement;
    const platform = services();
    const stop = await platform.dialogueAdapter.mount(host);
    expect(instance).toHaveBeenCalledExactlyOnceWith(host.id);
    expect(renderChat).toHaveBeenCalledWith(`#${host.id}`, expect.objectContaining({ instanceId: host.id }));
    stop(); stop();
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(host.id).toBe('portal-container');
    expect(document.scripts[0]).toBe(script);
    platform.session.destroy();
  });

  it('uses an injected adapter without requiring platform SDK configuration', async () => {
    vi.stubGlobal('window', {});
    const stop = vi.fn();
    const adapter = { mount: vi.fn(async () => stop) };
    const platform = services(adapter);
    const host = {} as HTMLElement;
    const cleanup = await platform.dialogueAdapter.mount(host);
    expect(adapter.mount).toHaveBeenCalledExactlyOnceWith(host);
    cleanup(); expect(stop).toHaveBeenCalledTimes(1);
    platform.session.destroy();
  });

  it('starts without SDK configuration and reports the missing deployment only when dialogue mounts', async () => {
    vi.stubGlobal('window', {});
    const platform = services();
    await expect(platform.dialogueAdapter.mount({} as HTMLElement)).rejects.toThrow('未配置盘古静态资源地址和版本号');
    platform.session.destroy();
  });
});


it('shares the trusted candidate port with reading and workbench preview gateways',async()=>{
  vi.stubGlobal('location',{origin:'https://platform.test'});
  const session=createPlatformSession({readConfig:()=>({operatorId:'actor',workspaceId:'workspace',dqeEndpoint:'https://platform.test/dqe',pageMetadataBaseUrl:'https://platform.test/pages',authToken:'token'})});
  const fetchFilterCandidates=vi.fn(async()=>({kind:'unconfigured' as const}));
  const services=createPlatformServices(session,navigation(),{embedded:true,filterCandidates:{fetchFilterCandidates}});
  const request={filterId:'model',dimension:'model',constraints:{dimensions:{},times:{}}},signal=new AbortController().signal;
  await services.dataGateway.fetchFilterCandidates!(request,{signal});
  await services.workbenchGateway.fetchFilterCandidates!(request,{signal});
  expect(fetchFilterCandidates).toHaveBeenCalledTimes(2);session.destroy();
});
