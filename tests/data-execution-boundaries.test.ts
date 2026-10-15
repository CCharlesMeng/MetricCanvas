import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {expect,it} from 'vitest';
it('shared execution owns pure policies and imports no presentation or encoding modules',()=>{
 const files:string[]=[];function walk(dir:string){for(const entry of readdirSync(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())walk(path);else if(path.endsWith('.ts'))files.push(path);}}walk('packages/data-execution/src');
 for(const file of files){const text=readFileSync(file,'utf8');expect(text,file).not.toMatch(/(?:from|import\s*\()\s*['"][^'"]*(?:runtime-ui|widgets|@metriccanvas\/engine|svelte|exceljs|echarts)/);}
 const entry=readFileSync('packages/data-execution/src/runtime.ts','utf8');expect(entry).not.toMatch(/query-runner|paged-join\/(?:execute|plan|member-query|rows|export)/);
});
