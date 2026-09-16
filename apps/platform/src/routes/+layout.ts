import { installLocalDevRuntimeConfig } from '$lib/runtime-config';
import { installPanguDevConfig } from '$lib/dialogue/dev-inject';

// 仅本地浏览器入口安装开发配置；生产由集成门户注入。
if (import.meta.env.DEV) {
  installLocalDevRuntimeConfig();
  // DEV 下注入盘古 loader 资源与 IOC 用户，使 PanguDialogue 能挂载真实 SDK。
  installPanguDevConfig();
}

export const ssr = false;
export const prerender = false;