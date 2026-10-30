import type {RuntimeDataGateway, DisplayInputs, DisplaySnapshot} from '@metriccanvas/engine';
import type {EffectiveQuery, Row} from '@metriccanvas/page/internal';

// Synthetic daily aggregates. Rates aggregate numerator/denominator, never monthly percentages.
const periods = {
  '2026-10-28': [['甲',120,50],['乙',0,0],['丙',80,null],['戊',100,50],['新增',30,25],['末行',400,80]],
  '2026-09-28': [['甲',100,40],['乙',0,0],['丙',40,25],['丁',60,60],['戊',0,0],['末行',100,20]],
  '2025-10-28': [['甲',80,30],['乙',0,0],['丙',20,10],['丁',40,40],['戊',0,0],['仅去年',10,20],['末行',100,20]]
} satisfies Record<string, Array<[string,number,number|null]>>;
export const comparisonInputs: DisplaySnapshot = {permissions:{},values:{},permissionRevision:'synthetic-comparison-1',timeZone:'Asia/Shanghai',periods:{'sales-through':{status:'ready',granularity:'date',latest:'2026-10-28'}}};
export function comparisonRows(query: EffectiveQuery): Row[] {
  const time=query.filterValues.find(value=>value.target==='time');
  if(time?.target!=='time')throw new Error('合成查询缺少时间边界');
  const groups=new Map<string,{sales:number; numerator:number; denominator:number}>();
  for(const [date,rows] of Object.entries(periods)) {
    if(date<time.value.from||date>time.value.to)continue;
    for(const [customer,sales,rate] of rows) {
      const group=groups.get(customer)??{sales:0,numerator:0,denominator:0};
      group.sales+=sales;
      if(rate!==null){group.numerator+=rate;group.denominator+=100;}
      groups.set(customer,group);
    }
  }
  return [...groups].map(([customer,g])=>({customer,sales:g.sales,rate:g.denominator?g.numerator/g.denominator*100:null}));
}
export function createPeriodComparisonPreview(state='ready') {
  const requests:EffectiveQuery[]=[];
  let failed=false;
  const displayInputs:DisplayInputs={getSnapshot:()=>comparisonInputs,subscribe(run){run(comparisonInputs);return ()=>{};}};
  const dataGateway:RuntimeDataGateway={async fetchData(query,context,signal){
    signal?.throwIfAborted();requests.push(structuredClone(query));
    if((state==='error'||state==='retry'&&!failed)&&context?.dataSourceIds?.includes('year-ago')) {failed=true;throw new Error('合成比较期查询失败');}
    const rows=comparisonRows(query);
    if(state==='duplicate'&&rows.length)rows.push(rows[0]);
    return {rows,totalCount:rows.length};
  }};
  return {dataGateway,displayInputs,requests};
}
