import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  define: {
    'process.env.NODE_ENV': JSON.stringify('production')
  },
  plugins: [
    svelte({
      // 组件样式随 JS 注入其挂载根；嵌入模式的根是 ShadowRoot。
      emitCss: false
    })
  ],
  build: {
    target: 'es2020',
    outDir: 'dist',
    emptyOutDir: true,
    minify: true,
    cssCodeSplit: false,
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      name: 'MetricCanvas',
      formats: ['es', 'iife'],
      fileName(format) {
        return format === 'es'
          ? 'metriccanvas-runtime.es.js'
          : 'metriccanvas-runtime.global.js';
      }
    },
    rollupOptions: {
      output: {
        // 地图 JSON 与动态模块一并进入单文件产物。
        codeSplitting: false
      }
    }
  }
});
