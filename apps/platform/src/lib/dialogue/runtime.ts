import type { DialogueAdapter } from './port';

export interface PanguDeployment { resourceUrl: string; version: string }
interface PanguApi {
  instance(id: string): {
    renderChat(selector: string, options: { instanceId: string; config: { mode: 'side'; autoRecover: false } }): void;
    destroy(): void;
  };
}
declare global {
  interface Window {
    __METRICCANVAS_PANGU__?: PanguDeployment;
    pangu?: PanguApi;
  }
}
const loads = new Map<string, Promise<void>>();

/** Deployment-owned URL and version only. No credentials or dialogue history are persisted. */
export function panguResourceUrl(config: PanguDeployment, base: string): string {
  if (!config.resourceUrl?.trim() || !config.version?.trim()) throw new Error('盘古静态资源地址或版本号未配置。');
  const url = new URL(config.resourceUrl, base);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('盘古资源必须使用 HTTP(S) 地址。');
  url.searchParams.set('v', config.version);
  return url.href;
}

function loadResource(url: string): Promise<void> {
  const existing = loads.get(url);
  if (existing) return existing;
  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    const timer = window.setTimeout(() => fail(), 15000);
    function fail() {
      clearTimeout(timer);
      script.remove();
      reject(new Error('盘古静态资源加载失败，当前页面仍保留。'));
    }
    script.onerror = fail;
    script.onload = () => { clearTimeout(timer); resolve(); };
    document.head.append(script);
  }).catch((error: unknown) => { loads.delete(url); throw error; });
  loads.set(url, promise);
  return promise;
}

export const panguDialogueAdapter: DialogueAdapter = {
  async mount(element) {
    const config = window.__METRICCANVAS_PANGU__;
    if (!config) throw new Error('对话服务尚未接通：未配置盘古静态资源地址和版本号。');
    await loadResource(panguResourceUrl(config, window.location.href));
    if (!element.isConnected) return () => {};
    const api = window.pangu;
    if (!api?.instance) throw new Error('盘古资源未提供 instance 接口。');
    const id = `metriccanvas-${crypto.randomUUID()}`;
    element.id = id;
    const instance = api.instance(id);
    try {
      instance.renderChat(`#${id}`, { instanceId: id, config: { mode: 'side', autoRecover: false } });
    } catch (error) {
      instance.destroy();
      throw error;
    }
    let destroyed = false;
    return () => { if (!destroyed) { destroyed = true; instance.destroy(); } };
  }
};
