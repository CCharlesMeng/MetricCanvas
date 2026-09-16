import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sveltekit } from '@sveltejs/kit/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { defineConfig } from 'vite';

const appRoot = dirname(fileURLToPath(import.meta.url));
const localHuaweiHost = 'ioc.huawei.com';

function localHuaweiTls() {
  const certificateDirectory = resolve(appRoot, '.local-tls');
  const pfx = resolve(certificateDirectory, `${localHuaweiHost}.pfx`);
  const key = resolve(certificateDirectory, `${localHuaweiHost}.key`);
  const cert = resolve(certificateDirectory, `${localHuaweiHost}.pem`);
  if (existsSync(pfx)) {
    return { pfx: readFileSync(pfx) };
  }
  if (!existsSync(key) || !existsSync(cert)) {
    throw new Error(
      '缺少本地 HTTPS 证书。请执行 create-local-huawei-tls.sh（macOS）或 create-local-huawei-tls.ps1（Windows）。'
    );
  }
  return { key: readFileSync(key), cert: readFileSync(cert) };
}

export default defineConfig(() => {
  const localHuaweiPort = Number(process.env.METRICCANVAS_LOCAL_HUAWEI_PORT ?? '443');

  return {
    plugins: [sveltekit(), basicSsl()],
    server: {
      // HTTPS 使本地环境可测试 Secure Cookie；macOS 的 `:443` 入口须以管理员权限启动。
      // 必须使用相对路径 `/aiknow/...`，由 Vite 转发后浏览器才不会发生跨域请求。
      host: localHuaweiHost,
      port: localHuaweiPort,
      strictPort: true,
      allowedHosts: [localHuaweiHost],
      proxy: {
        '/aiknow': {
          target: 'https://aiknow.huawei.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/aiknow/, '')
        }
      }
    }
  };
});
