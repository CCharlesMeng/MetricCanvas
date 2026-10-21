import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {compile} from 'svelte/compiler';
import {render} from 'svelte/server';
import type {Component} from 'svelte';

it('static export renders the captured option label without interactive buttons',async()=>{
 const source=readFileSync(new URL('../../runtime-ui/src/dashboard/FilterGroup.svelte',import.meta.url),'utf8');
 const require=createRequire(import.meta.url);
 const compiled=compile(source,{generate:'server',filename:'FilterGroup.svelte'}).js.code;
 const code=compiled.replace(/(['"])(svelte\/[^'"]+)\1/g,(_match,_quote,specifier:string)=>JSON.stringify(pathToFileURL(require.resolve(specifier)).href));
 const {default:FilterGroup}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`) as {default:Component<any>};
 const control={filterId:'region',options:[{label:'中国区',value:'CN'},{label:'海外',value:'OVERSEAS'}]};
 const exported=render(FilterGroup,{props:{control,value:'OVERSEAS',label:'区域',exportMode:true,onchange:()=>{throw Error('static export must not write state');}}});
 expect(exported.body).toContain('海外');expect(exported.body).not.toContain('中国区');
 expect(exported.body).toContain('data-filter-group-selection');expect(exported.body).not.toContain('<button');
});
