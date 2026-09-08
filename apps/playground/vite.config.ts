import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin } from 'vite';
import { fileURLToPath } from 'node:url';

const pagesDir = fileURLToPath(new URL('../../pages', import.meta.url));

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

export default defineConfig({
  plugins: [sveltekit(), watchPageAssets(pagesDir)],
  resolve: {
    alias: {
      // 页面资产目录固定别名,避免源码内的多级相对路径
      $pages: pagesDir
    }
  },
  server: {
    port: 5173,
    strictPort: true,
    // 页面文档与 workspace 包在仓库根,允许 dev server 越出应用目录读取
    fs: { allow: ['../..'] }
  }
});
