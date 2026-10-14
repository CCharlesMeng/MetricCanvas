import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {svelte} from '@sveltejs/vite-plugin-svelte';
import basicSsl from '@vitejs/plugin-basic-ssl';
import {defineConfig, type Plugin} from 'vite';
import {createDqeDevProxy} from '../../tools/dev-server';

const appRoot = dirname(fileURLToPath(import.meta.url));
const localDomain = 'local.cloudbu.huawei.com';
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
  const debug = mode === 'microfrontend-debug';
  const micro = mode === 'microfrontend' || debug;
  const windows = process.platform === 'win32';
  const proxy = createDqeDevProxy();
  delete proxy['/rest/cdi/cdinl2databuilderservice/v1/dsl/execute'];
  proxy['/rest/cdi/cdinl2databuilderservice/'] = {
    target: 'https://ioc.cloudbu.huawei.com', changeOrigin: true
  };
  return {
    // Library mode intentionally leaves NODE_ENV untouched unless explicitly defined.
    define: micro ? {'process.env.NODE_ENV': JSON.stringify('production')} : {},
    plugins: [svelte(), ...(micro ? [htmlEntry()] : [basicSsl(windows ? {domains: [localDomain]} : undefined)])],
    resolve: {alias: {
      $lib: resolve(appRoot, 'src/lib'),
      $pages: resolve(appRoot, '../../pages'),
      $fixtures: resolve(appRoot, '../../docs/examples')
    }},
    base: micro ? './' : process.env.METRICCANVAS_BASE_PATH || '/',
    build: micro ? {
      outDir: debug ? 'dist/microfrontend-debug' : 'dist/microfrontend',
      target: 'es2022',
      // Debug changes readability only; Vite/Svelte still compile production code.
      ...(debug ? {minify: false, cssMinify: false, sourcemap: true} : {}),
      lib: {
        entry: 'src/microfrontend/entry.ts', name: 'MetricCanvasPlatform', formats: ['umd'],
        fileName: () => 'assets/platform.umd.js', cssFileName: 'assets/platform'
      }
    } : {outDir: 'build', target: 'es2022'},
    server: {
      host: windows ? localDomain : '127.0.0.1', port: windows ? 443 : 5174, strictPort: true,
      proxy
    }
  };
});
