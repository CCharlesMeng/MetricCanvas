import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

// 仅供浏览器回归使用，不定义 #100 的发布产物。
export default defineConfig({ plugins: [svelte()] });
