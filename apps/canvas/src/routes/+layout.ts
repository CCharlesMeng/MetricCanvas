import { installLocalDevRuntimeConfig } from '$lib/runtime-config';

if (import.meta.env.DEV) {
  installLocalDevRuntimeConfig();
}

export const ssr = false;
export const prerender = false;
