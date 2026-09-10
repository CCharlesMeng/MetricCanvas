import { installLocalDevRuntimeConfig } from '$lib/runtime-config';

// 仅本地浏览器入口安装开发配置；生产由集成门户注入。
if (import.meta.env.DEV) {
  installLocalDevRuntimeConfig();
}

export const ssr = false;
export const prerender = false;
