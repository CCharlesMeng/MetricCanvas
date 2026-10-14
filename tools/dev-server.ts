import type { ProxyOptions } from 'vite';

/** 浏览器只使用同源路径；回环地址仅由开发服务器访问。 */
export function createDqeDevProxy(): Record<string, ProxyOptions> {
  const target = `http://127.0.0.1:${process.env.DQE_SIM_PORT ?? '18228'}`;
  return {
    '/rest/cdi/cdinl2databuilderservice/v1/dsl/execute': { target, changeOrigin: true },
    '/api/ai/conversations/': { target, changeOrigin: true }
  };
}
