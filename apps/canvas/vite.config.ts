import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    // 页面规格与 workspace 包在仓库根,允许 dev server 越出应用目录读取
    fs: { allow: ['../..'] }
  }
});
