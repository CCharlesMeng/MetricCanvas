import { readFileSync } from 'node:fs';
import { it, expect } from 'vitest';
import { parsePage } from '../src/validate';
const input=()=>JSON.parse(readFileSync(new URL('../../../pages/page-visibility-region-linkage.json',import.meta.url),'utf8'));
it('accepts the actual feature page and preserves conditional text parts',()=>{
 const parsed=parsePage(input());expect(parsed.ok,JSON.stringify(parsed.errors)).toBe(true);
 if(parsed.ok)expect(parsed.page.sections[3]?.components.find(c=>c.type==='text')?.props).toHaveProperty('parts');
});
it.each(['5.4','6.33'])('rejects new conditional capability under %s',(version)=>{
 const page=input();page.schemaVersion=version;
 const result=parsePage(page);expect(result.ok).toBe(false);expect(result.errors.some(e=>e.path.endsWith('visibleWhen'))).toBe(true);
});
it('rejects row context outside a row and rejects incorrect level names',()=>{
 const page=input();page.sections[1].visibleWhen={row:'kind',op:'eq',value:'department'};
 expect(parsePage(page).errors.some(e=>e.path.endsWith('visibleWhen'))).toBe(true);
 page.sections[1].visibleWhen={filter:'organization',part:'level',op:'eq',value:'unknown'};
 expect(parsePage(page).errors.some(e=>e.message.includes('层级'))).toBe(true);
});
it('rejects inline constant filter actions without any consumer',()=>{
 const page=input();page.sections[0].components[0].props.action.writeFilter='missing';
 expect(parsePage(page).errors.some(e=>e.path.endsWith('writeFilter'))).toBe(true);
});

it('returns diagnostics for dangling data sources rather than throwing during policy traversal',()=>{
 const page=input();page.sections[1].components[0].data.main='missing';
 expect(()=>parsePage(page)).not.toThrow();expect(parsePage(page).ok).toBe(false);
});

it('requires a stable key for row-dependent entries even without a row projection',()=>{
 const page=input();const table=page.sections.flatMap((section:any)=>section.components).find((component:any)=>component.id==='projected-table');
 delete table.props.rowVisibleWhen;delete table.props.rowKey;
 expect(parsePage(page).errors.some(error=>error.path.endsWith('rowKey'))).toBe(true);
});
