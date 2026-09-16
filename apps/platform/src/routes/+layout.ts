import { installLocalDevRuntimeConfig, installRuntimeConfig, readRuntimeConfig } from '$lib/runtime-config';
import { installPanguDevConfig } from '$lib/dialogue/dev-inject';

// 仅本地浏览器入口安装开发配置；生产由集成门户注入。
if (import.meta.env.DEV) {
  installLocalDevRuntimeConfig();
  // 本地联调 gray 页面资产：走 vite proxy 同源相对路径，浏览器无跨域、自动携带 .huawei.com cookie。
  const current = readRuntimeConfig();
  if (current) {
    installRuntimeConfig({
      ...current,
      pageMetadataBaseUrl: 'https://gray.cloudioc.huawei.com/rest/cdi/cdinl2databuilderservice/v1'
    });
  }
  // DEV 下注入盘古 loader 资源与 IOC 用户，使 PanguDialogue 能挂载真实 SDK。
  installPanguDevConfig();
}

export const ssr = false;
export const prerender = false;