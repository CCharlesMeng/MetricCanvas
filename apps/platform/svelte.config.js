import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({ out: 'build' }),
    // 仓库根数据资产固定别名,避免服务端代码内的多级相对路径(参照 apps/canvas 的 $pages 先例)
    alias: {
      $pages: '../../pages',
      $templates: '../../templates',
      $fixtures: '../../docs/examples'
    }
  }
};
