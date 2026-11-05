import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {parsePage} from '@metriccanvas/page';
import {resolvePeriodSelection,tableLeafColumns,type QueryDataSource} from '@metriccanvas/page/internal';
import {compilePresentation} from '../../../packages/engine/runtime/src/presentation';
import {composeEffectiveQuery} from '../../../packages/data-execution/src/effective-query';
import {effectiveDqeItem} from '../../../packages/data-execution/src/dqe/dqe';
import {applyComputation} from '../../../packages/data-execution/src/compute';
import type {FilterValues} from '../../../packages/data-execution/src/filter-values';

const result=parsePage(JSON.parse(readFileSync(new URL('../../../pages/temporary/business-result-config-audit-20261105/business-result-metrics-2.json',import.meta.url),'utf8')));
if(!result.ok)throw Error(JSON.stringify(result.errors));
const page=result.page;
const now=new Date('2026-11-05T04:00:00Z');
const inputs={permissions:{},values:{},permissionRevision:'synthetic-business-result',timeZone:'Asia/Shanghai',periods:{'net-discount-through':{status:'ready' as const,granularity:'date' as const,latest:'2026-11-04'}}};

function conditions(level='geo',values:string[]=[]):FilterValues {
  return new Map([
    ['mtime',{type:'timeRange',...resolvePeriodSelection({mode:'month',value:'2026-11'},now,'month')}],
    ['region',{type:'dimension',dimension:'geo-pc-code',level,values}],
    ['net-discount-site',{type:'dimension',dimension:'data-site-type',values:['海外']}],
    ['decision-closure-site',{type:'dimension',dimension:'data-site-type',values:['国内']}]
  ]);
}
it('shows global totals, a department-scoped office total, and no total for an individual office',()=>{
  const scenes=[{level:'geo',values:[],tables:2,pinned:2},{level:'region-dept',values:['R1'],tables:1,pinned:1},{level:'office',values:['O1'],tables:1,pinned:0}];
  for(const scene of scenes){
    const filters=conditions(scene.level,scene.values);
    const tables=compilePresentation(page).evaluate({filters}).sections.flatMap(section=>section.components).filter(component=>component.type==='table');
    expect(tables).toHaveLength(scene.tables);
    expect(tables.filter(table=>table.props.pinnedTop)).toHaveLength(scene.pinned);
    for(const table of tables){
      expect(tableLeafColumns(table.props.columns).find(column=>column.field==='net-discount-yoy')?.pinnedTop).toBeUndefined();
      for(const [slot,id] of Object.entries(table.data)){
        if(slot==='main')continue;
        const source=page.dataSources[id] as QueryDataSource;
        const item=effectiveDqeItem(composeEffectiveQuery({dataSource:source,filters:page.filters,now},filters,0,[],{}));
        expect(source.source.resultScope).toBe('complete');
        expect(item.output_dims).toEqual([]);
        expect(item.order).toEqual({});
        expect(item.filter).toMatchObject({time:{is_aggregate:true,start:'2026-11',end:'2026-11'}});
        const filter=item.filter as {dims:Array<{dim_name:string;dim_value_list:string[]}>};
        expect(filter.dims.filter(dim=>['region_dept_code','rep_office_code','geo_pc_code'].includes(dim.dim_name))).toEqual(scene.level==='region-dept'?[{dim_name:'region_dept_code',dim_value_list:['R1']}]:[]);
      }
    }
  }
});
it('queries three aligned raw periods with the same site and region, never backend comparison metrics',()=>{
  const expected=[['current','2026-11-01','2026-11-04'],['previous','2026-10-01','2026-10-04'],['year-ago','2025-11-01','2025-11-04']];
  for(const [suffix,start,end] of expected){
    const source=page.dataSources['net-discount-trend-'+suffix] as QueryDataSource;
    const item=effectiveDqeItem(composeEffectiveQuery({dataSource:source,filters:page.filters,displayInputs:inputs,now},conditions('region-dept',['R1']),0,[],{}));
    expect(item.filter).toMatchObject({time:{period:'day',is_aggregate:true,start,end},dims:expect.arrayContaining([{dim_name:'国内或海外',dim_value_list:['海外']},{dim_name:'region_dept_code',dim_value_list:['R1']}])});
    expect(item.output_metrics).toEqual(suffix==='current'?['净商务折扣','净商务折扣均值']:['净商务折扣']);
    expect(item.order).toEqual({});
  }
});
it('computes percentage-point differences, keeps historical organizations and preserves explicit null',()=>{
  const rows=applyComputation(page.dataSources['net-discount-trend'].compute??[],[],new Map([
    ['net-discount-trend-current',[{'rep-office':'normal','net-discount-rate':25,'net-discount-avg':20},{'rep-office':'unknown','net-discount-rate':25,'net-discount-avg':20}]],
    ['net-discount-trend-previous',[{'rep-office':'normal','net-discount-rate':22}]],
    ['net-discount-trend-year-ago',[{'rep-office':'normal','net-discount-rate':23},{'rep-office':'history-only','net-discount-rate':5},{'rep-office':'unknown','net-discount-rate':null}]]
  ]));
  expect(rows.find(row=>row['rep-office']==='normal')).toMatchObject({'net-discount-mom':3,'net-discount-yoy':2});
  expect(rows.find(row=>row['rep-office']==='history-only')).toMatchObject({'net-discount-rate':0,'net-discount-yoy':-5});
  expect(rows.find(row=>row['rep-office']==='unknown')).toMatchObject({'net-discount-yoy':null});
});
