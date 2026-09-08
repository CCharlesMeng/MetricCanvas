import { svelte } from '@sveltejs/vite-plugin-svelte';

// 普通集成应用配置：无源码 alias、无 MetricCanvas 专用 preprocess。
export default {
  root: 'packages/metric-canvas',
  plugins: [svelte()],
  build: {
    outDir: '../../dist/canvas',
    emptyOutDir: true,
    rollupOptions: { input: 'packages/metric-canvas/tests/browser/harness/index.html' }
  }
};
