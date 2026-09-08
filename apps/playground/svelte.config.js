import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
export default {
  preprocess: vitePreprocess(),
  kit: {
    // 静态 SPA(ADR-0002):不用 SSR,构建产物为静态站点
    adapter: adapter({ fallback: 'index.html' })
  }
};
