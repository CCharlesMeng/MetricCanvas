import {expect,it} from 'vitest';
import ExcelJS from 'exceljs';
import fixture from '../../../../pages/capabilities/table/table-pinned-summary.json';
import business from '../../../../pages/temporary/business-result-pinned-diagnosis-20261102/business-result-metrics.json';
import {parsePage,versionPolicy} from '@metriccanvas/page';
import {projectTableRows,tableRowColumn,alignedCellText} from '../../widgets/src/components/table/rows';
import {hostRenderSnapshot} from '../src/widget-host-state';
import {encodeTableWorkbook} from '../src/table/export/workbook';
import {prepareTableExport} from '../src/table/export/prepare';
import {initialFilterValues} from '@metriccanvas/data-execution/runtime';
import type {RuntimeDataGateway} from '../../runtime/src';
import {tableLeafColumns,type DataSnapshot} from '@metriccanvas/page/internal';
import type {TableComponent} from '@metriccanvas/page/internal';
function document() {
  const value=JSON.parse(JSON.stringify(fixture));
  value.schemaVersion=versionPolicy.current;
  value.dataSources.extra=structuredClone(value.dataSources.summary);
  value.dataSources.extra.source.query.body.dsl_list[0].filter.dims.push({dim_name:'synthetic_slot',dim_value_list:['extra']});
  const table=value.sections[0].components[0];
  table.data.extra='extra';
  table.props.pinnedTop.additionalData=['extra'];
  table.props.columns[0].pinnedTop={text:'合计'};
  table.props.columns[3].pinnedTop.field.data='extra';
  return value;
}
function setup() {
  const parsed=parsePage(document());
  if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
  const component=parsed.page.sections[0].components[0] as TableComponent;
  const fields=parsed.page.dataSources.summary.fields;
  return {component,data:{
    main:{fields:parsed.page.dataSources.regions.fields,snapshot:{status:'ready' as const,rows:[{'region-id':'x','region-name':'区域',target:100,actual:80,rate:80}],totalCount:1}},
    china:{fields,snapshot:{status:'ready' as const,rows:[{'scope-name':'后台原标签','summary-target':1000,'summary-actual':800,'summary-rate':80}],totalCount:1}},
    extra:{fields,snapshot:{status:'ready' as const,rows:[{'scope-name':'其他查询','summary-target':2000,'summary-actual':1800,'summary-rate':90}],totalCount:1}}
  }};
}
it('composes independent scalar results and literal text without computing the returned rates',async()=>{
  const {component,data}=setup();
  const rows=projectTableRows(data,component.props);
  expect(rows).toHaveLength(2);
  const columns=tableLeafColumns(component.props.columns);
  expect(alignedCellText(tableRowColumn(columns[0],rows[0],data).field,data,rows[0])).toBe('合计');
  expect(alignedCellText(tableRowColumn(columns[3],rows[0],data).field,data,rows[0])).toBe('90.0%');
  const bytes=await encodeTableWorkbook(component,data,new AbortController().signal);
  const book=new ExcelJS.Workbook();await book.xlsx.load(bytes.buffer);
  expect(book.worksheets[0].getCell('B2').value).toBe('合计');
  expect(book.worksheets[0].getCell('E2').value).toBe(90);
  expect(book.worksheets[0].getCell('B3').value).toBe('区域');
});
it('keeps detail rendering independent and suppresses the summary while an auxiliary source is pending or invalid',()=>{
  const {component,data}=setup();
  const waiting={...data,extra:{...data.extra,sourceStatus:'loading' as const,snapshot:{status:'ready' as const,rows:[]}}};
  expect(projectTableRows(waiting,component.props)).toHaveLength(1);
  expect(projectTableRows({...data,extra:{...data.extra,sourceStatus:'error'}},component.props)).toHaveLength(1);
  expect(hostRenderSnapshot(component,new Map<string,DataSnapshot>([['main',data.main.snapshot],['extra',{status:'loading'}],['china',{status:'loading'}]]))).toMatchObject({status:'ready'});
  data.extra.snapshot.rows.push({...data.extra.snapshot.rows[0]});data.extra.snapshot.totalCount=2;
  expect(projectTableRows(data,component.props)).toHaveLength(1);
  data.extra.snapshot.rows=[];data.extra.snapshot.totalCount=0;
  expect(projectTableRows(data,component.props)).toHaveLength(2);
  data.china.snapshot.rows=[];data.china.snapshot.totalCount=0;
  expect(projectTableRows(data,component.props)).toHaveLength(1);
});
it('rejects duplicate, shared, truncated and old-version declarations',()=>{
  const old=document();old.schemaVersion='6.78';expect(parsePage(old).ok).toBe(false);
  for(const mutate of [
    (v:ReturnType<typeof document>)=>{v.sections[0].components[0].props.pinnedTop.additionalData=['china'];},
    (v:ReturnType<typeof document>)=>{v.sections[0].components[0].data.extra='regions';},
    (v:ReturnType<typeof document>)=>{v.dataSources.extra.source.query.body.dsl_list[0].order.limit=1;},
    (v:ReturnType<typeof document>)=>{v.sections[0].components[0].props.columns[0].pinnedTop={text:'合计',field:{data:'china',field:'scope-name'}};}
  ]){const value=document();mutate(value);expect(parsePage(value).ok).toBe(false);}
});
it('uses the original metric names with no grouping or frontend ratio; only office summaries bind the selected region',()=>{
  const parsed=parsePage(business);expect(parsed.ok).toBe(true);
  for(const scope of ['region-dept','rep-office'])for(const suffix of ['summary','commercial-summary','contract-summary']){
    const ds=business.dataSources[`${scope}-${suffix}` as keyof typeof business.dataSources];
    const q=ds.source.query;
    expect(q.body.dsl_list[0].output_dims).toEqual([]);
    expect(q.body.dsl_list[0].filter.time.is_aggregate).toBe(true);
    expect(Object.keys(q.filterBindings).sort()).toEqual(scope==='region-dept'?['mtime']:['mtime','region']);
    expect('compute' in ds).toBe(false);
  }
});

it('rejects complete Excel export when any additional summary is invalid',async()=>{
  const parsed=parsePage(document());if(!parsed.ok)throw Error('fixture invalid');
  const {component,data}=setup();
  const gateway:RuntimeDataGateway={async fetchData(_query,context){
    if(context?.dataSourceIds?.includes('regions'))return {rows:data.main.snapshot.rows,totalCount:1};
    if(context?.dataSourceIds?.includes('extra'))return {rows:[...data.extra.snapshot.rows,...data.extra.snapshot.rows],totalCount:2};
    return {rows:data.china.snapshot.rows,totalCount:1};
  }};
  await expect(prepareTableExport({page:parsed.page,component,gateway,queries:new Map(),controller:new AbortController(),
    state:{currentYear:2026,filters:initialFilterValues(parsed.page.filters??[]),tables:{},headerFilters:{}}})).rejects.toMatchObject({code:'EXPORT_INCOMPLETE_DATA'});
});
it('restores raw display evidence from every independent summary slot',()=>{
  const {component,data}=setup();
  const receipts={...data,extra:{...data.extra,snapshot:{...data.extra.snapshot,
    rows:[{...data.extra.snapshot.rows[0],'summary-rate':null}],
    cellFallbacks:{0:{'summary-rate':{raw:'--',reason:'TYPE_MISMATCH' as const}}}
  }}};
  const projected=projectTableRows(receipts,component.props);
  const column=tableRowColumn(tableLeafColumns(component.props.columns)[3],projected[0],receipts);
  expect(alignedCellText(column.field,receipts,projected[0])).toBe('--');
});
