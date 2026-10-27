import { sortDqeRows } from './sort';
import fixture from '../fixtures/multi-query-table.json';
import type {DqeSimItemResult} from './execute';
type RecordValue=Record<string,unknown>;
const record=(v:unknown):v is RecordValue=>typeof v==='object'&&v!==null&&!Array.isArray(v);
const columns=[...Object.keys(fixture[0]),'bidding_rank'];
// Business rank belongs to the full month domain, before table filters or paging.
const rankedOffices=[...fixture].sort((a,b)=>b.bidding_amount-a.bidding_amount||a.rep_office_code.localeCompare(b.rep_office_code));
const biddingRanks=new Map(rankedOffices.map((row,index)=>[row.rep_office_code,index+1]));
const reject=():DqeSimItemResult=>({code:'DQE_SIM_UNSUPPORTED_QUERY',retDesc:'多查询表格仿真只接受声明字段、202609期间和已知编码集合',data:[],total_count:0,dqe:{columns:[],orders:[],limit:-1,offset:-1,sql:null}});
/** Sim interprets ordinary DQE only; it has no pagedJoin orchestration. */
export function executeMultiQueryTable(item:unknown):DqeSimItemResult|undefined {
 if(!record(item)||!Array.isArray(item.output_dims)||!item.output_dims.includes('rep_office_code'))return;
 const dims=item.output_dims,metrics=item.output_metrics;
 const same=(value:unknown,expected:string[])=>Array.isArray(value)&&JSON.stringify(value)===JSON.stringify(expected);
 const domain=same(dims,['rep_office_code','rep_office_name','region_dept_name'])&&same(metrics,[]);
 const meeting=same(dims,['rep_office_code','rep_office_name'])&&same(metrics,['analysis_meeting_rate']);
 const rankedBidding=same(dims,['rep_office_code'])&&same(metrics,['bidding_amount','bidding_rank']);
 const measure=same(dims,['rep_office_code'])&&Array.isArray(metrics)&&metrics.length===1&&['bidding_amount','support_rate','current_month_new_signed_amount','project_initiation_rate'].includes(String(metrics[0]));
 if(!domain&&!meeting&&!measure&&!rankedBidding)return;
 if(!dims.every(v=>['rep_office_code','rep_office_name','region_dept_name'].includes(v))||!Array.isArray(metrics)||!metrics.every(v=>columns.includes(v))||!record(item.filter)||!record(item.filter.time)||String(item.filter.time.start).replaceAll('-','')!=='202609'||String(item.filter.time.end).replaceAll('-','')!=='202609'||!Array.isArray(item.filter.dims)||!Array.isArray(item.filter.metrics)||!record(item.order))return reject();
 let rows:RecordValue[]=fixture.map(row=>({...row,bidding_rank:biddingRanks.get(row.rep_office_code)!}));
 for(const f of item.filter.dims){
  if(!record(f)||f.dim_name!=='rep_office_code'||!Array.isArray(f.dim_value_list)||!f.dim_value_list.length||!f.dim_value_list.every(v=>fixture.some(row=>row.rep_office_code===v)))return reject();
  rows=rows.filter(row=>(f.dim_value_list as unknown[]).includes(row.rep_office_code));
 }
 for(const f of item.filter.metrics){
  if(!record(f)||!metrics.includes(f.metric_name)||!['>=','<='].includes(String(f.operator))||!Array.isArray(f.metric_value_list)||f.metric_value_list.length!==1||typeof f.metric_value_list[0]!=='number')return reject();
  rows=rows.filter(row=>typeof row[String(f.metric_name)]==='number'&&(f.operator==='>='?Number(row[String(f.metric_name)])>=Number((f.metric_value_list as number[])[0]):Number(row[String(f.metric_name)])<=Number((f.metric_value_list as number[])[0])));
 }
 const order=item.order;
 const sorted = sortDqeRows(rows, order, [...dims, ...metrics]);
 if (!sorted) return reject();
 rows = sorted;
 const total=rows.length,offset=order.offset??0,limit=order.limit;
 if(!Number.isSafeInteger(offset)||Number(offset)<0||(limit!==undefined&&(!Number.isSafeInteger(limit)||Number(limit)<1)))return reject();
 if(limit!==undefined)rows=rows.slice(Number(offset),Number(offset)+Number(limit));
 return {code:'SUCCESS',data:rows.map(row=>Object.fromEntries([...dims,...metrics].map(v=>[v,row[v]]))),total_count:total,dqe:{columns:[...dims.map(id=>({id,caption:id,data_type:'STRING' as const,type:'dimension' as const})),...metrics.map(id=>({id,caption:id,data_type:'NUMBER' as const,type:'metric' as const}))],orders:[],limit:limit===undefined?-1:Number(limit),offset:limit===undefined?-1:Number(offset),sql:null}};
}
