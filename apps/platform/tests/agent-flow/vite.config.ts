import {defineConfig} from 'vite';
import {svelte} from '@sveltejs/vite-plugin-svelte';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));
export default defineConfig({root,plugins:[svelte({configFile:resolve(root,'../../svelte.config.js')})],server:{host:'127.0.0.1',port:5178,strictPort:true}});
