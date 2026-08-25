import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin } from 'vite';
import { fileURLToPath } from 'node:url';

const seedDirs = ['../../pages', '../../templates'].map((path) =>
  fileURLToPath(new URL(path, import.meta.url))
);

/**
 * 页面与模板种子目录在 Vite root 之外:watcher 只会盯住已经加载过的单个
 * JSON,目录本身不在监听范围,新增或删除种子不会让 import.meta.glob 重新
 * 求值。显式把目录加进 watcher,种子增删改都能在 dev 下即时反映。
 */
function watchSeedAssets(directories: string[]): Plugin {
  return {
    name: 'metriccanvas:watch-seed-assets',
    apply: 'serve',
    configureServer(server) {
      for (const directory of directories) server.watcher.add(directory);
    }
  };
}

export default defineConfig({
  plugins: [sveltekit(), watchSeedAssets(seedDirs)],
  server: {
    port: 5174,
    strictPort: true
  },
  ssr: {
    // Workspace packages expose TypeScript source. Keep them in Vite's SSR
    // transform pipeline instead of handing extensionless imports to Node ESM.
    noExternal: [/^@metriccanvas\//]
  }
});
