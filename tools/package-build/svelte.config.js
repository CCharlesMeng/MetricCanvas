import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// Script 中的 TypeScript 在发布前处理；Svelte 5 自身支持的模板类型语法仍由编译器读取。
export default { preprocess: vitePreprocess({ script: true }) };
