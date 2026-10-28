import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {svelte} from '@sveltejs/vite-plugin-svelte';
import basicSsl from '@vitejs/plugin-basic-ssl';
import {defineConfig, type Plugin} from 'vite';
import {createCloudIocDevProxy, createDqeDevProxy, readCloudIocDevConfig} from '../../tools/dev-server';

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

/** Normal Platform entry with persistent local assets; no fixture UI or alternate app root. */
function developmentServer(localPreview:boolean,cloudIoc:ReturnType<typeof readCloudIocDevConfig>){
  const proxy=createDqeDevProxy();
  if(localPreview){
    proxy['/rest/cdi/cdinl2databuilderservice/v1/user-page-metadata']={target:'http://127.0.0.1:8080',changeOrigin:true};
  }else{
    delete proxy['/rest/cdi/cdinl2databuilderservice/v1/dsl/execute'];
    proxy['/rest/cdi/cdinl2databuilderservice/']={
      ...(cloudIoc?createCloudIocDevProxy(cloudIoc):{target:'https://ioc.cloudbu.huawei.com',changeOrigin:true}),
      secure:false,
      configure(proxy){
        proxy.on('proxyReq',(proxyReq)=>{
          console.info('[platform proxy]',proxyReq.method,proxyReq.path.split('?')[0],{
            cftk:proxyReq.hasHeader('cftk'),
            cookie:proxyReq.hasHeader('cookie')
          });
        });
      }
    };
  }
  return {host:'localhost',port:localPreview?5175:5174,strictPort:true,proxy};
}

export default defineConfig((config) => {
  const {mode} = config;
  const debug = mode === 'microfrontend-debug';
  const micro = mode === 'microfrontend' || debug;
  const localPreview=config.command==='serve'&&mode==='local-preview';
  const cloudIoc=localPreview?undefined:readCloudIocDevConfig(config,appRoot,'platform');
  return {
    // Library mode intentionally leaves NODE_ENV untouched unless explicitly defined.
    define: micro ? {'process.env.NODE_ENV': JSON.stringify('production')} : {},
    plugins: [svelte(), ...(micro ? [htmlEntry()] : localPreview ? [] : [basicSsl()])],
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
    server: developmentServer(localPreview,cloudIoc)
  };
});
