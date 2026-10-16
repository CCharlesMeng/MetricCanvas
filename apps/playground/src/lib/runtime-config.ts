/// <reference types="vite/client" />

// 应用共用的私有配置模块；不扩展引擎发布 API。
export * from '@metriccanvas/application-runtime';

import { createInjectedDqeGateway } from '@metriccanvas/application-runtime';

/** Windows 开发入口由 Vite 显式注入 cftk，覆盖查询及维度候选值请求。 */
export function createPlaygroundDqeGateway(fetchImpl: typeof fetch = fetch) {
  return createInjectedDqeGateway((async (input, init) => {
    const cftk = import.meta.env.DEV ? import.meta.env.PLAYGROUND_CLOUDIOC_CFTK : undefined;
    if (!cftk) return fetchImpl(input, init);
    const headers = new Headers(init?.headers);
    headers.set('cftk', cftk);
    return fetchImpl(input, {...init, headers});
  }) as typeof fetch);
}
