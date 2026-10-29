import type { DimensionValueCandidate, RuntimeDataGateway } from '@metriccanvas/engine';
import type { Row } from '@metriccanvas/page/internal';

// Local synthetic facts, deliberately unrelated to production IOC business codes.
const offices = [
  {department:'CN',departmentName:'中国地区部',code:'CN-BJ',name:'北京代表处',key:'1'},
  {department:'CN',departmentName:'中国地区部',code:'CN-SH',name:'上海代表处',key:'0'},
  {department:'APAC',departmentName:'亚太地区部',code:'APAC-SG',name:'新加坡代表处',key:'1'},
  {department:'APAC',departmentName:'亚太地区部',code:'APAC-TH',name:'泰国代表处',key:'0'},
  {department:'EU',departmentName:'欧洲地区部',code:'EU-DE',name:'德国代表处',key:'1'},
  {department:'EU',departmentName:'欧洲地区部',code:'EU-FR',name:'法国代表处',key:'0'}
];
const customerTypes = ['EXCELLENT','STRATEGIC','CORE','SMB'];
const candidates:DimensionValueCandidate[] = [
  {value:'GLOBAL',label:'全球'},
  ...offices.filter((_,index)=>index%2===0).map(office=>({value:office.department,label:office.departmentName,parentValue:'GLOBAL'})),
  ...offices.map(office=>({value:office.code,label:office.name,parentValue:office.department}))
];
const facts:Row[]=[];
for(let year=2024;year<=2026;year++)for(let month=1;month<=12;month++) {
  offices.forEach((office,index)=>customerTypes.forEach((customer,typeIndex)=>{
    const opportunities=12+index*3+typeIndex*2+month;
    const signings=(index+2)*(typeIndex+1)*80+month*35+(year-2024)*120;
    facts.push({demo_global:'GLOBAL',demo_department:office.department,demo_department_name:office.departmentName,
      demo_office:office.code,demo_office_name:office.name,demo_key:office.key,demo_customer:customer,
      demo_month:`${year}-${String(month).padStart(2,'0')}`,signings,revenue:Math.round(signings*.76),opportunities,won:Math.floor(opportunities*(.25+typeIndex*.1))});
  }));
}
function aggregate(rows:Row[]) {
  const sum=(field:string)=>rows.reduce((total,row)=>total+Number(row[field]),0);
  const opportunities=sum('opportunities');
  return {signings:sum('signings'),revenue:sum('revenue'),opportunities,win_rate:opportunities?sum('won')/opportunities*100:0};
}
/** Uses the normal effective query and candidate ports; never contacts a service. */
export function createIocHeaderDemoGateway():RuntimeDataGateway {
  return {
    async fetchFilterCandidates(){return {kind:'values',candidates:[
      {value:'GLOBAL',label:'全球',level:'global'},
      ...offices.filter((_,index)=>index%2===0).map(office=>({value:office.department,label:office.departmentName,level:'department',parent:{level:'global',value:'GLOBAL'}})),
      ...offices.map(office=>({value:office.code,label:office.name,level:'office',parent:{level:'department',value:office.department}}))
    ]};},
    async fetchDimensionValues(dimension,options) {
      options?.signal?.throwIfAborted();
      return dimension==='demo_region'?{kind:'values',candidates:structuredClone(candidates)}:{kind:'unavailable'};
    },
    async fetchData(query) {
      const dims=query.body.dsl_list?.[0]?.output_dims;
      if(!Array.isArray(dims))throw new Error('Unknown synthetic showcase query');
      let filtered=facts;
      let metric='signings';
      for(const filter of query.filterValues) {
        if(filter.target==='time')filtered=filtered.filter(row=>String(row.demo_month)>=filter.value.from.slice(0,7)&&String(row.demo_month)<=filter.value.to.slice(0,7));
        else if(filter.target==='dimension'&&filter.queryField==='demo_metric')metric=filter.values[0]==='REVENUE'?'revenue':'signings';
        else if(filter.target==='dimension'&&filter.queryField==='demo_region')filtered=filtered.filter(row=>filter.values.some(value=>[row.demo_global,row.demo_department,row.demo_office].includes(value)));
        else if(filter.target==='dimension')filtered=filtered.filter(row=>filter.values.includes(String(row[filter.queryField])));
        else throw new Error('Unsupported synthetic showcase predicate');
      }
      const signature=dims.join('|');
      let rows:Row[];
      if(signature==='demo_summary')rows=filtered.length?[{demo_summary:'合计',...aggregate(filtered)}]:[];
      else if(['demo_department_name','demo_department_name|demo_office_name','demo_month'].includes(signature)) {
        const groups=new Map<string,Row[]>();
        for(const row of filtered){const key=dims.map(dim=>String(row[String(dim)])).join('|');const group=groups.get(key)??[];group.push(row);groups.set(key,group);}
        rows=[...groups.values()].map((group):Row=>signature==='demo_month'
          ?{demo_month:group[0]!.demo_month,demo_value:aggregate(group)[metric==='revenue'?'revenue':'signings']}
          :{...Object.fromEntries(dims.map(dim=>[String(dim),group[0]![String(dim)]])),...aggregate(group)});
      }else throw new Error('Unknown synthetic showcase query');
      return {rows,totalCount:rows.length};
    }
  };
}
