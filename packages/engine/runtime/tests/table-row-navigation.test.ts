import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {parsePage} from '@metriccanvas/page';
import {resolveNavigationTarget} from '../src/navigate';
import {compilePresentation,resolvePresentationRow} from '../src/presentation';
import {alignTableRows} from '../../widgets/src/components/table/rows';
import type {NamedDataSlots} from '../../widgets/src/shared/component-data';

const parsed=parsePage(JSON.parse(readFileSync(new URL('../../../../pages/capabilities/navigation/table-multi-source-navigation.json',import.meta.url),'utf8')));
if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
const page=parsed.page;
const table=page.sections[0]!.components.find(component=>component.type==='table');
if(!table||table.type!=='table')throw Error('missing table');
const slots:NamedDataSlots={};
for(const [slot,id] of Object.entries(table.data)){
 const source=page.dataSources[id]!;
 if(source.source.type!=='inline')throw Error('expected inline scenario');
 slots[slot]={fields:source.fields,snapshot:{status:'ready',rows:source.source.rows}};
}
const rows=slots.main!.snapshot.rows;
const column=table.props.columns.find(column=>'navigate' in column&&column.navigate);
if(!column||!('navigate' in column)||!column.navigate)throw Error('missing navigation');
const target=column.navigate;

it.each(rows.map(row=>({label:`${row['biz-code']} / ${row['stage-name']}`,row})))('navigates the current $label despite a shared join key',({row})=>{
 const current=resolvePresentationRow(table,rows,row);
 expect(current).toBe(row);
 const result=resolveNavigationTarget(target,new Map(),new Map(),current);
 expect(result.ok).toBe(true);
 if(!result.ok)throw Error(result.message);
 const url=new URL(result.href,'https://example.invalid');
 expect(url.searchParams.get('project-name')).toBe(row['project-name']);
 expect(url.searchParams.get('rep-office-name')).toBe(row['rep-office-name']);
 expect(url.searchParams.get('stage-name')).toBe(row['stage-name']);
});

it('continues rejecting stale ambiguous callbacks, removed rows and missing keys',()=>{
 expect(resolvePresentationRow(table,rows,{...rows[1]})).toBeUndefined();
 expect(resolvePresentationRow(table,[],rows[1]!)).toBeUndefined();
 const missing={};
 expect(resolvePresentationRow(table,[missing],missing)).toBeUndefined();
 const refreshed={...rows[0],label:'latest'};
 expect(resolvePresentationRow(table,[refreshed],rows[0]!)).toBe(refreshed);
});

it('keeps supplemental values joined by business code rather than visible row position',()=>{
 const aligned=alignTableRows(slots,table.props.rowKey);
 expect(aligned.map(row=>row.bySlot.headcount?.['approval-headcount'])).toEqual([1,12,12,12]);
 expect(aligned.map(row=>row.bySlot.basic?.['customer-name'])).toEqual(['合成客户甲','合成客户乙','合成客户乙','合成客户乙']);
});

it('still evaluates action eligibility against the exact clicked stage',()=>{
 const presentation=compilePresentation(page).evaluate({filters:new Map()});
 const guarded={...target,enabledWhen:{row:'stage-name',op:'ne' as const,value:'地区部SDT'}};
 const allowed=resolvePresentationRow(table,rows,rows[1]!);
 const disabled=resolvePresentationRow(table,rows,rows[2]!);
 expect(presentation.gate(guarded,allowed,presentation.component(table.id)).enabled).toBe(true);
 expect(presentation.gate(guarded,disabled,presentation.component(table.id)).enabled).toBe(false);
});
