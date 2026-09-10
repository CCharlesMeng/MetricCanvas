import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
export default {
  preprocess: vitePreprocess(),
  kit: {
    // 纯前端 SPA：动态路由集成门户/静态服务回退到 index.html。
    adapter: adapter({ fallback: 'index.html' }),
    // 构建期应用前缀；不代表 qiankun 运行时分配的 activeRule。
    paths: { base: process.env.METRICCANVAS_BASE_PATH ?? '' },
    // 仓库根数据资产固定别名,避免服务端代码内的多级相对路径(参照 apps/playground 的 $pages 先例)
    alias: {
      $pages: '../../pages',
      $fixtures: '../../docs/examples'
    }
  }
};
