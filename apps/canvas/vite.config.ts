import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin } from 'vite';
import { fileURLToPath } from 'node:url';

const pagesDir = fileURLToPath(new URL('../../pages', import.meta.url));

/**
 * 页面资产目录在 Vite root 之外,dev 下有两处监听缺口:
 * 一是 watcher 只盯已加载过的单个 JSON,目录本身不在监听范围,新增或删除
 * 页面不会让 import.meta.glob 重新求值;
 * 二是配了 VITE_PLATFORM_URL 时页面文档由平台接口供给,根本不在 canvas 的
 * 模块图里,内容变更没有 HMR 载体可以传播。
 * 因此显式监听目录,并把页面文档的任何变更统一落成整页刷新。
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
