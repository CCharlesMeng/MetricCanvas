import tables from '../fixtures/query-modes.json';
import type {DqeSimItemResult} from './execute';

type RecordValue=Record<string,unknown>;
type DemoTable=(typeof tables)[keyof typeof tables];
function record(value:unknown):value is RecordValue {return !!value&&typeof value==='object'&&!Array.isArray(value);}
function result(valid:boolean,rows:RecordValue[]):DqeSimItemResult {
  return {code:valid?'SUCCESS':'DQE_SIM_UNSUPPORTED_QUERY',data:rows,total_count:rows.length,dqe:{columns:[],orders:[],limit:-1,offset:-1,sql:null}};
}
function tableFor(item:RecordValue):DemoTable|undefined {
  return Object.values(tables).find(table=>JSON.stringify(item.output_metrics)===JSON.stringify([{name:table.metric,alias:'金额'}]));
}
function narrowedRows(table:DemoTable,dims:unknown):RecordValue[]|undefined {
  if(!Array.isArray(dims))return;
  let rows:RecordValue[]=table.rows;
  for(const dim of dims){
    if(!record(dim)||dim.dim_name!==table.regionField||dim.operator!==undefined)return;
    const values=dim.dim_value_list;
    if(!Array.isArray(values)||!values.length||values.some(value=>!['east','south'].includes(value)))return;
    rows=rows.filter(row=>values.includes(row[table.regionField]));
  }
  return rows;
}
/** Two separate synthetic tables; the requested business metric resolves its table. */
export function executeQueryModes(value:unknown):DqeSimItemResult|undefined {
  if(!record(value))return;
  const table=tableFor(value);
  if(!table)return;
  const summary=JSON.stringify(value.output_dims)==='[]';
  if(!summary&&JSON.stringify(value.output_dims)!=='["月份"]')return result(false,[]);
  if(!record(value.filter)||JSON.stringify(value.filter.metrics)!=='[]'||value.filter.time!==undefined||JSON.stringify(value.order)!=='{}')return result(false,[]);
  const rows=narrowedRows(table,value.filter.dims);
  if(!rows)return result(false,[]);
  if(!rows.length)return result(true,[]);
  if(summary)return result(true,[{'金额':rows.reduce((total,row)=>total+Number(row[table.metric]),0)}]);
  return result(true,rows.map(row=>({'月份':row['月份'],'金额':row[table.metric]})));
}
