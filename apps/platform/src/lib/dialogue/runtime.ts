import type { DialogueAdapter } from './port';

export interface PanguDeployment { resourceUrl: string; version: string }
interface PanguApi {
  instance(id: string): {
    renderChat(selector: string, options: { instanceId: string; config: {
      mode: 'side'; autoRecover: false; draggable: false; resizable: false; adsorbable: false;
    } }): void;
    destroy(): void;
  };
}
declare global {
  interface Window {
    __METRICCANVAS_PANGU__?: PanguDeployment;
    pangu?: PanguApi;
  }
}
/** One SDK version per document. A version change requires a full page reload. */
export function createPanguResourceLoader(load: (url: string) => Promise<void>) {
  let selected: string | undefined;
  let pending: Promise<void> | undefined;
  return (url: string): Promise<void> => {
    if (selected && selected !== url) return Promise.reject(new Error('盘古资源版本已固定，请重新加载页面后切换版本。'));
    selected = url;
    pending ??= Promise.resolve().then(() => load(url)).catch((error: unknown) => { pending = undefined; throw error; });
    return pending;
  };
}

/** Deployment-owned URL and version only. No credentials or dialogue history are persisted. */
export function panguResourceUrl(config: PanguDeployment, base: string): string {
  if (typeof config.resourceUrl !== 'string' || !config.resourceUrl.trim() ||
      typeof config.version !== 'string' || !config.version.trim()) throw new Error('盘古静态资源地址或版本号未配置。');
  const url = new URL(config.resourceUrl, base);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('盘古资源必须使用 HTTP(S) 地址。');
  url.searchParams.set('v', config.version);
  return url.href;
}

const loadResource = createPanguResourceLoader((url: string): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    // Reuse a portal loader only when its exact deployment URL is visible in this document.
    // A global API alone cannot establish which version the portal loaded.
    if (window.pangu) {
      if (typeof window.pangu.instance === 'function' &&
          Array.from(document.scripts).some((script) => script.src === url)) {
        resolve();
      } else {
        reject(new Error('已有盘古资源的地址或版本无法核实，请重新加载页面并统一部署配置。'));
      }
      return;
    }
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    let settled = false;
    const timer = window.setTimeout(() => fail(), 15000);
    function settle() {
      settled = true;
      clearTimeout(timer);
      script.onerror = null;
      script.onload = null;
    }
    function fail() {
      if (settled) return;
      settle();
      script.remove();
      reject(new Error('盘古静态资源加载失败，当前页面仍保留。'));
    }
    script.onerror = fail;
    script.onload = () => {
      if (settled) return;
      if (typeof window.pangu?.instance !== 'function') { fail(); return; }
      settle();
      resolve();
    };
    try { document.head.append(script); } catch { fail(); }
  });
});

export const panguDialogueAdapter: DialogueAdapter = {
  async mount(element) {
    const config = window.__METRICCANVAS_PANGU__;
    if (!config) throw new Error('对话服务尚未接通：未配置盘古静态资源地址和版本号。');
    await loadResource(panguResourceUrl(config, window.location.href));
    if (!element.isConnected) return () => {};
    const api = window.pangu;
    if (typeof api?.instance !== 'function') throw new Error('盘古资源未提供 instance 接口。');
    const id = `metriccanvas-${crypto.randomUUID()}`;
    const previousId = element.id;
    element.id = id;
    let instance: ReturnType<PanguApi['instance']> | undefined;
    let destroyed = false;
    const destroy = () => {
      if (destroyed) return;
      destroyed = true;
      try {
        if (typeof instance?.destroy === 'function') instance.destroy();
      } finally {
        // A replacement adapter may already own this container.
        if (element.id === id) element.id = previousId;
      }
    };
    try {
      instance = api.instance(id);
      if (typeof instance?.renderChat !== 'function' || typeof instance.destroy !== 'function') {
        throw new Error('Invalid SDK instance');
      }
      instance.renderChat(`#${id}`, { instanceId: id, config: {
        mode: 'side', autoRecover: false, draggable: false, resizable: false, adsorbable: false
      } });
    } catch {
      try { destroy(); } catch { /* Do not expose SDK errors that may contain runtime credentials. */ }
      throw new Error('盘古实例挂载失败，请核对 SDK 版本与适配配置。');
    }
    return () => {
      // Teardown must not interrupt a replacement adapter or expose SDK diagnostics.
      try { destroy(); } catch { /* SDK cleanup cannot be guaranteed after its own failure. */ }
    };
  }
};
