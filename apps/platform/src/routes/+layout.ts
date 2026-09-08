import { browser } from '$app/environment';
import { installLocalDevRuntimeConfig } from '$lib/runtime-config';

// 仅本地浏览器入口安装开发配置，服务端不持有用户态注入值。
if (browser && import.meta.env.DEV) {
  installLocalDevRuntimeConfig();
}
