import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    // `local.huawei.com` 在开发机 hosts 中解析至 127.0.0.1。
    // 浏览器一律请求相对路径 `/aiknow/...`；Vite 再将它转发到内网服务，
    // 从而不触发浏览器的跨域检查。
    host: '127.0.0.1',
    port: 5174,
    strictPort: true,
    allowedHosts: ['local.huawei.com'],
    proxy: {
      '/aiknow': {
        target: 'https://aiknow.huawei.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/aiknow/, '')
      }
    }
  }
});
