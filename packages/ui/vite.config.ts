import {defineConfig} from 'vite';import {svelte} from '@sveltejs/vite-plugin-svelte';
export default defineConfig({plugins:[svelte({emitCss:false})],server:{port:4182,host:'127.0.0.1'}});
