import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig, version as viteVersion } from 'vite';
import { fileURLToPath } from 'node:url';

// #115：最低 Svelte 版本使用兼容的 Vite 6 工具链；两种构建器均保持单文件。
const singleFileOutput = Number(viteVersion.split('.')[0]) >= 8
  ? { codeSplitting: false as const }
  : { inlineDynamicImports: true };

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
      output: singleFileOutput
    }
  }
});
