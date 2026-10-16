import { sveltekit } from '@sveltejs/kit/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { fileURLToPath } from 'node:url';
import { createDqeDevProxy } from '../../tools/dev-server';

const pagesDir = fileURLToPath(new URL('../../pages', import.meta.url));
const appRoot = fileURLToPath(new URL('.', import.meta.url));
const cloudIocDomain = 'local.cloudioc.huawei.com';
const dqePath = '/rest/cdi/cdinl2databuilderservice/v1/dsl/execute';

/**
 * 页面资产目录在 Vite root 之外，watcher 默认只盯已加载过的 JSON。
 * 显式监听目录并整页刷新，使页面增删和内容修改都能立即反映。
 */
function watchPageAssets(directory: string): Plugin {
  return {
    name: 'metriccanvas:watch-page-assets',
    apply: 'serve',
    configureServer(server) {
      server.watcher.add(directory);
      const reloadOnPageChange = (file: string) => {
        if (!file.startsWith(directory) || !file.endsWith('.json')) return;
        server.hot.send({ type: 'full-reload' });
      };
      server.watcher.on('add', reloadOnPageChange);
      server.watcher.on('change', reloadOnPageChange);
      server.watcher.on('unlink', reloadOnPageChange);
    }
  };
}

export default defineConfig(({ command, mode, isPreview }) => {
  // 凭据仅由 Windows 开发代理读取，不注入浏览器或静态构建。
  const env = command === 'serve' && !isPreview && process.platform === 'win32'
    ? loadEnv(mode, appRoot, 'PLAYGROUND_')
    : {};
  const cloudIoc = env.PLAYGROUND_CLOUDIOC === 'true';
  const proxy = createDqeDevProxy();
  if (cloudIoc) {
    const cftk = env.PLAYGROUND_CLOUDIOC_CFTK?.trim();
    if (!cftk || /[\r\n]/.test(cftk)) {
      throw new Error('请在 apps/playground/.env.local 中填写有效的 PLAYGROUND_CLOUDIOC_CFTK，再启动页面试验场');
    }
    proxy[dqePath] = {
      target: 'https://gray.cloudioc.huawei.com',
      changeOrigin: true,
      headers: { cftk }
    };
  }
  return {
    plugins: [sveltekit(), watchPageAssets(pagesDir), ...(cloudIoc ? [basicSsl({ domains: [cloudIocDomain] })] : [])],
    resolve: {
      alias: {
        // 页面资产目录固定别名,避免源码内的多级相对路径
        $pages: pagesDir
      }
    },
    server: {
      host: cloudIoc ? cloudIocDomain : '0.0.0.0',
      port: cloudIoc ? 443 : 5173,
      strictPort: true,
      proxy,
      // 页面文档与 workspace 包在仓库根,允许 dev server 越出应用目录读取
      fs: { allow: ['../..'] }
    }
  };
});
