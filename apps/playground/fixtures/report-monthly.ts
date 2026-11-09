import type {RuntimeDataGateway} from '@metriccanvas/engine';
import type {EffectiveQuery,Row} from '@metriccanvas/page/internal';

const regions = [
  {region:'华东',revenue:384,target:400,orders:1380,margin:24},
  {region:'华南',revenue:312,target:320,orders:1170,margin:22},
  {region:'华北',revenue:278,target:290,orders:1010,margin:21},
  {region:'西部',revenue:212,target:230,orders:820,margin:20}
];
const round = (value:number) => Math.round(value*10)/10;

function monthOffset(month:string,offset:number):string {
  const date=new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth()+offset);
  return date.toISOString().slice(0,7);
}

function regionRows(month:string) {
  const offset=(Number(month.slice(0,4))-2026)*12+Number(month.slice(5,7))-10;
  return regions.map(row=>{
    const revenue=round(row.revenue*(1+offset*.035));
    const target=round(row.target*(1+offset*.02));
    const margin=round(row.margin+offset*.16);
    return {region:row.region,revenue,target,orders:Math.round(row.orders*(1+offset*.025)),profit:round(revenue*margin/100),margin,achievement:round(revenue/target*100)};
  });
}

type RegionRow=ReturnType<typeof regionRows>[number];
function total(rows:RegionRow[],field:'revenue'|'orders'|'profit'|'target'):number {
  return round(rows.reduce((sum,row)=>sum+row[field],0));
}

function summaryRow(month:string):Row {
  const rows=regionRows(month),previous=regionRows(monthOffset(month,-1));
  const revenue=total(rows,'revenue'),orders=total(rows,'orders');
  const margin=round(total(rows,'profit')/revenue*100),achievement=round(revenue/total(rows,'target')*100);
  return {revenue,orders,profit:total(rows,'profit'),target:total(rows,'target'),margin,achievement,
    revenueChange:round((revenue/total(previous,'revenue')-1)*100),
    ordersChange:round((orders/total(previous,'orders')-1)*100),
    marginChange:round(margin-total(previous,'profit')/total(previous,'revenue')*100),
    achievementChange:round(achievement-total(previous,'revenue')/total(previous,'target')*100)};
}

function selectedMonth(query:EffectiveQuery):string {
  const time=query.filterValues.find(value=>value.target==='time');
  if(time?.target!=='time')throw new Error('合成月报需要已应用的报告月份');
  return time.value.to.slice(0,7);
}

/** Deterministic synthetic monthly observations; never a production query adapter. */
export function createMonthlyReportPreview():RuntimeDataGateway {
  return {async fetchData(query,context,signal){
    signal?.throwIfAborted();
    const month=selectedMonth(query),id=context?.dataSourceIds?.[0];
    let rows:Row[];
    if(id==='report-summary')rows=[summaryRow(month)];
    else if(id==='report-trend')rows=Array.from({length:6},(_,index)=>{
      const period=monthOffset(month,index-5);
      return {month:period,...summaryRow(period)};
    });
    else if(id==='report-regions')rows=regionRows(month);
    else throw new Error('未声明的合成月报数据源');
    return {rows,totalCount:rows.length};
  }};
}
