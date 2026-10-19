import {readFileSync} from 'node:fs';
import {it,expect} from 'vitest';
import {parsePage} from '@metriccanvas/page';
import {compilePresentation} from '../src/presentation';
const parsed=parsePage(JSON.parse(readFileSync(new URL('../../../../pages/page-visibility-region-linkage.json',import.meta.url),'utf8')));
if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
const page=parsed.page;
it('projects the feature page without pruning the source document or collapsing an empty parent',()=>{
 const presentation=compilePresentation(page).evaluate({filters:new Map([['organization',{type:'dimension',level:'department',values:[]}]])});
 expect(presentation.sections.some(s=>s.id==='department-norms')).toBe(false);
 const retained=presentation.sections.find(s=>s.id==='retained-container');
 expect(retained?.title).toBe('保留的父容器');expect(retained?.components).toEqual([]);
 expect(page.sections.find(s=>s.id==='retained-container')?.components).toHaveLength(1);
 const tabs=presentation.sections.flatMap(s=>s.components).find(c=>c.type==='tabContainer');
 expect(tabs?.props.tabs.map(t=>t.id)).toEqual(['office']);
 const table=page.sections.flatMap(s=>s.components).find(c=>c.type==='table'&&c.id==='projected-table');
 if(!table||table.type!=='table')throw Error('missing fixture table');
 const source=page.dataSources.rows!;if(source.source.type!=='inline')throw Error('missing inline source');
 expect(presentation.rows(table,source.source.rows).map(r=>r.id)).toEqual(['a','b']);
});
it('preserves the parent even when all tab conditions deny',()=>{
 const copy=structuredClone(page);const tabs=copy.sections.flatMap(s=>s.components).find(c=>c.type==='tabContainer');
 if(!tabs||tabs.type!=='tabContainer')throw Error('missing tabs');
 tabs.props.tabs.forEach(tab=>tab.visibleWhen={permission:'no'});
 const result=compilePresentation(copy).evaluate({filters:new Map(),displaySnapshot:{permissionRevision:'a',values:{},permissions:{no:{status:'ready',value:false}}}});
 const render=result.sections.flatMap(s=>s.components).find(c=>c.type==='tabContainer');
 expect(render?.props.tabs).toEqual([]);
});

it('uses nested entry conditions for both visibility and execution',()=>{
 const result=compilePresentation(page).evaluate({filters:new Map([['mode',{type:'dimension',values:['base']} ]])});
 const entry={navigate:{href:'/page',enabledWhen:{permission:'write'}}};
 expect(result.gate(entry as import('@metriccanvas/page/internal').PolicyNode,{kind:'office'}).enabled).toBe(false);
});

it('hides a standalone button when its sole action is ineligible',()=>{
 const copy=structuredClone(page);
 const button=copy.sections.flatMap(section=>section.components).find(component=>component.type==='button');
 if(!button||button.type!=='button')throw Error('missing button');
 button.props.action.visibleWhen={permission:'missing'};
 const result=compilePresentation(copy).evaluate({filters:new Map()});
 expect(result.sections.flatMap(section=>section.components).some(component=>component.id===button.id)).toBe(false);
 expect(result.component(button.id)).toMatchObject({eligible:false,enabled:false});
});
