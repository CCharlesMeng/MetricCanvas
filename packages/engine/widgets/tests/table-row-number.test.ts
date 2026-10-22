import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { compile } from 'svelte/compiler';
import { build } from 'esbuild';
import { render } from 'svelte/server';
import type { Component } from 'svelte';

it('static export numbers the expanded row set from one regardless of the captured page', async () => {
  const entry = fileURLToPath(new URL('../src/components/table/Table.svelte', import.meta.url));
  const require = createRequire(import.meta.url);
  const bundled = await build({ entryPoints:[entry], bundle:true, write:false, platform:'node', format:'esm', conditions:['svelte'],
    external:['svelte','svelte/*'], plugins:[{name:'svelte-server', setup(plugin) {
      plugin.onLoad({filter:/\.svelte$/}, args => ({contents:compile(readFileSync(args.path,'utf8'), {generate:'server',filename:args.path}).js.code,loader:'js'}));
      // Preserve the shared context symbol across the bundled renderer and this test.
      plugin.onLoad({filter:/\/export-context\.ts$/}, () => ({contents:'export const STATIC_EXPORT_CONTEXT = Symbol.for("table-row-number-static-test");',loader:'js'}));
    }}] });
  const code = bundled.outputFiles[0]!.text.replace(/(['"])(svelte(?:\/[^'"]+)?)\1/g, (_match,_quote,specifier:string) => JSON.stringify(pathToFileURL(require.resolve(specifier)).href));
  const {default:Table} = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`) as {default:Component<any>};
  const props = {
    data:{main:{fields:{name:{type:'string',role:'dimension'}},snapshot:{status:'ready',rows:[{name:'A'},{name:'B'}]}}},
    props:{columns:[{field:'name'}],rowNumber:{},pagination:{mode:'local',pageSize:10}},
    view:{pageIndex:2,sort:[],headerFilters:{}},pagination:{pageSize:10,totalCount:25}
  };
  const interactive = render(Table,{props});
  expect(interactive.body).toMatch(/data-row-number[^>]*>21<\/td>/);
  const exported = render(Table,{props,context:new Map([[Symbol.for('table-row-number-static-test'),true]])});
  expect(exported.body).toMatch(/data-row-number[^>]*>1<\/td>/);
  expect(exported.body).toMatch(/data-row-number[^>]*>2<\/td>/);
  expect(exported.body).not.toMatch(/data-row-number[^>]*>21<\/td>/);
});
