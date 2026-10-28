import fixture from '../fixtures/table-hierarchy-selection.json';
import {sortDqeRows} from './sort';
import type {DqeSimItemResult} from './execute';
type RecordValue=Record<string,unknown>;
const record=(v:unknown):v is RecordValue=>!!v&&typeof v==='object'&&!Array.isArray(v);
function value(item:RecordValue,field:string):string|undefined{
  if(!record(item.filter)||!Array.isArray(item.filter.dims))return;
  const predicate=item.filter.dims.find(p=>record(p)&&p.dim_name===field);
  return record(predicate)&&Array.isArray(predicate.dim_value_list)?String(predicate.dim_value_list[0]):undefined;
}
function matching(rows:RecordValue[],item:RecordValue):RecordValue[]{
  if(!record(item.filter)||!Array.isArray(item.filter.dims))throw Error('filter');
  for(const p of item.filter.dims){
    if(!record(p)||typeof p.dim_name!=='string'||!Array.isArray(p.dim_value_list))throw Error('predicate');
    const field=p.dim_name,values=p.dim_value_list;
    if(['h_year','h_product'].includes(field))continue;
    if(p.operator==='contains'){rows=rows.filter(r=>String(r[field]).includes(String(values[0])));continue;}
    if(p.operator!==undefined)throw Error('operator');
    rows=rows.filter(r=>values.includes(r[field]));
  }
  return rows;
}
function scenarioRows(item:RecordValue,kind:string):RecordValue[]{
  if(kind==='h_parent'){
    const office=value(item,'h_office');
    if(!office)throw Error('lookup input');
    if(office==='O-error')throw Error('lookup failure');
    if(office==='O-multi')return [{h_office:office,h_parent:'R01'},{h_office:office,h_parent:'R02'}];
    return fixture.lookup.filter(r=>r.h_office===office);
  }
  const factor=(value(item,'h_year')==='2025'?.8:1)*(value(item,'h_product')==='cloud'?.5:1);
  if(kind==='h_row_id')return fixture.parents.map(r=>({...r,h_parent_amount:r.h_parent_amount*factor}));
  if(!value(item,'h_region'))throw Error('child parent input');
  return fixture.children.map(r=>({...r,h_region:fixture.lookup.find(l=>l.h_office===r.h_office)!.h_parent,h_child_amount:r.h_child_amount*factor}));
}
/** Synthetic signatures only; child responses deliberately omit the parent field. */
export function executeHierarchySelection(input:unknown):DqeSimItemResult|undefined{
  if(!record(input)||!Array.isArray(input.output_dims)||!['h_parent','h_row_id','h_office'].includes(String(input.output_dims[0])))return;
  // A one-field office query belongs to the candidate surface, not the detail query.
  if(input.output_dims.length===1&&input.output_dims[0]==='h_office')return;
  try{
    if(!Array.isArray(input.output_metrics)||!record(input.order))throw Error('shape');
    const fields=[...input.output_dims,...input.output_metrics].map(String);
    const rows=matching(scenarioRows(input,String(input.output_dims[0])),input);
    const sorted=sortDqeRows(rows,input.order,fields);
    if(!sorted)throw Error('sort');
    const offset=Number(input.order.offset??0),limit=Number(input.order.limit??rows.length);
    const data=sorted.slice(offset,offset+limit).map(row=>Object.fromEntries(fields.map(f=>[f,row[f]])));
    return {code:'SUCCESS',data,total_count:rows.length,dqe:{columns:[],orders:[],limit,offset,sql:null}};
  }catch{return {code:'DQE_SIM_UNSUPPORTED_QUERY',retDesc:'层级表格合成查询不受支持或模拟定位失败',data:[],total_count:0,dqe:{columns:[],orders:[],limit:-1,offset:-1,sql:null}};}
}
