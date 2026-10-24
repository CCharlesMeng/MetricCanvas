// Compile existing UI/runtime components into one shareable, offline HTML file.
import {build} from 'vite';
import {svelte} from '@sveltejs/vite-plugin-svelte';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {writeFile} from 'node:fs/promises';
const root=dirname(fileURLToPath(import.meta.url));
const result=await build({
  configFile:false,root,plugins:[svelte({configFile:resolve(root,'../../svelte.config.js'),emitCss:false})],
  define:{'process.env.NODE_ENV':JSON.stringify('production')},
  build:{write:false,target:'es2022',minify:true,reportCompressedSize:false,
    lib:{entry:resolve(root,'main.ts'),name:'AuthoringFlowPrototype',formats:['iife']}}
});
const outputs=Array.isArray(result)?result:[result];
const bundle=outputs.flatMap(item=>item.output);
const scripts=bundle.filter(item=>item.type==='chunk').map(item=>item.code).join('\n').replace(/<\/script/gi,'<\\/script');
const css=bundle.filter(item=>item.type==='asset'&&item.fileName.endsWith('.css')).map(item=>String(item.source)).join('\n');
const html='<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>页面创作流程 · 交互原型</title><style>'+css+'</style></head><body><div id="app"></div><script>'+scripts+'</script></body></html>';
await writeFile(resolve(root,'prototype.html'),html);
console.log('Standalone prototype: '+resolve(root,'prototype.html')+' ('+Math.round(Buffer.byteLength(html)/1024)+' KiB)');
