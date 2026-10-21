import { validateHeaderValue } from 'node:http';
import { loadEnv, type ConfigEnv, type ProxyOptions } from 'vite';

export const CLOUDIOC_DEV_DOMAIN = 'local.cloudioc.huawei.com';

interface CloudIocDevConfig {
  cftk: string;
  cookie?: string;
}

/** 本地凭据只供 Windows vite dev 使用；构建与 preview 不读取。 */
export function readCloudIocDevConfig(
  config: ConfigEnv, appRoot: string, app: 'playground' | 'platform'
): CloudIocDevConfig | undefined {
  if (config.command !== 'serve' || config.isPreview || process.platform !== 'win32') return;
  const prefix = `${app.toUpperCase()}_CLOUDIOC`;
  const env = loadEnv(config.mode, appRoot, `${app.toUpperCase()}_`);
  if (env[prefix] !== 'true') return;
  const readHeader = (suffix: string, required: boolean) => {
    const key = `${prefix}_${suffix}`;
    const raw = env[key] ?? '';
    const value = raw.trim();
    try {
      validateHeaderValue(suffix, raw);
      if (required && !value) throw new Error('required');
    } catch {
      throw new Error(`请在 apps/${app}/.env.local 中填写有效的 ${key}，再启动开发服务器`);
    }
    return value;
  };
  const cftk = readHeader('CFTK', true);
  const cookie = readHeader('COOKIE', false);
  return { cftk, ...(cookie ? { cookie } : {}) };
}

/** Cookie 属于代理到上游的请求头，不得通过 define 或 VITE_* 暴露。 */
export function createCloudIocDevProxy(config: CloudIocDevConfig): ProxyOptions {
  return {
    target: 'https://gray.cloudioc.huawei.com',
    changeOrigin: true,
    secure: false,
    headers: { cftk: config.cftk, ...(config.cookie ? { cookie: config.cookie } : {}) }
  };
}

/** 浏览器只使用同源路径；回环地址仅由开发服务器访问。 */
export function createDqeDevProxy(): Record<string, ProxyOptions> {
  const target = `http://127.0.0.1:${process.env.DQE_SIM_PORT ?? '18228'}`;
  return {
    '/rest/cdi/cdinl2databuilderservice/v1/dsl/execute': { target, changeOrigin: true },
    '/api/ai/conversations/': { target, changeOrigin: true }
  };
}
