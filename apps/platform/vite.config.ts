import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {svelte} from '@sveltejs/vite-plugin-svelte';
import basicSsl from '@vitejs/plugin-basic-ssl';
import {defineConfig, type Plugin} from 'vite';

const appRoot = dirname(fileURLToPath(import.meta.url));
function htmlEntry(): Plugin {
  return {
    name: 'platform-html-entry',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'index.html',
        source: '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><link rel="stylesheet" href="./assets/platform.css"></head><body><div data-metriccanvas-root style="height:100%"></div><script src="./assets/platform.umd.js"></script></body></html>'
      });
    }
  };
}

export default defineConfig(({mode}) => {
  const micro = mode === 'microfrontend';
  return {
    // Library mode intentionally leaves NODE_ENV untouched unless explicitly defined.
    define: micro ? {'process.env.NODE_ENV': JSON.stringify('production')} : {},
    plugins: [svelte(), ...(micro ? [htmlEntry()] : [basicSsl()])],
    resolve: {alias: {
      $lib: resolve(appRoot, 'src/lib'),
      $pages: resolve(appRoot, '../../pages'),
      $fixtures: resolve(appRoot, '../../docs/examples')
    }},
    base: micro ? './' : process.env.METRICCANVAS_BASE_PATH || '/',
    build: micro ? {
      outDir: 'dist/microfrontend',
      target: 'es2022',
      lib: {
        entry: 'src/microfrontend/entry.ts', name: 'MetricCanvasPlatform', formats: ['umd'],
        fileName: () => 'assets/platform.umd.js', cssFileName: 'assets/platform'
      }
    } : {outDir: 'build', target: 'es2022'},
    server: {
      host: 'ioc.huawei.com',
      port: Number(process.env.METRICCANVAS_LOCAL_HUAWEI_PORT ?? '443'),
      strictPort: true,
      allowedHosts: ['ioc.huawei.com'],
      proxy: {'/aiknow': {
        target: 'https://aiknow.huawei.com', changeOrigin: true,
        rewrite: path => path.replace(/^\/aiknow/, '')
      }}
    }
  };
});
