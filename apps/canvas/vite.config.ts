import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [sveltekit()],
  resolve: {
    alias: {
      // 页面规格资产目录固定别名,避免源码内的多级相对路径
      $specs: fileURLToPath(new URL('../../specs', import.meta.url))
    }
  },
  server: {
    // 页面规格与 workspace 包在仓库根,允许 dev server 越出应用目录读取
    fs: { allow: ['../..'] }
  }
});
