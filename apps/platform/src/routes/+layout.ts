import { installLocalDevRuntimeConfig } from '$lib/runtime-config';

// 仅本地浏览器入口安装开发配置；生产由集成门户注入。
if (import.meta.env.DEV) {
  installLocalDevRuntimeConfig({
    pageMetadataBaseUrl: import.meta.env.VITE_LOCAL_PAGE_METADATA_BASE_URL,
    cftk: import.meta.env.VITE_LOCAL_CFTK,
    authToken: import.meta.env.VITE_LOCAL_AUTH_TOKEN,
    operatorId: import.meta.env.VITE_LOCAL_OPERATOR_ID,
    workspaceId: import.meta.env.VITE_LOCAL_WORKSPACE_ID,
    dqeEndpoint: import.meta.env.VITE_LOCAL_DQE_ENDPOINT
  });
}

export const ssr = false;
export const prerender = false;
