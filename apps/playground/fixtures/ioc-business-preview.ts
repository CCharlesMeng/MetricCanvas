import type { FilterCandidate, FilterCandidatesResult, RuntimeDataGateway } from '@metriccanvas/engine';
import { createIocHeaderPreview } from '../src/lib/ioc-header-preview-inputs';

export const businessReviewPages = [
  {value:'ioc-header-business',label:'业务筛选'}, {value:'ioc-header-models',label:'模型联动'},
  {value:'ioc-header-groups',label:'协同小组'}, {value:'ioc-header-incentives',label:'激励策略'},
  {value:'ioc-header-currency',label:'币种金额'}, {value:'ioc-header-months',label:'最近月份'},
  {value:'ioc-header-unconfigured',label:'缺配置边界'}
];
export const businessScenarios = ['ready','slow','error','empty','forbidden','unconfigured','partial','read-only'];
const values=(candidates:FilterCandidate[]):FilterCandidatesResult=>({kind:'values',candidates});
const choices=(labels:string[],prefix:string):FilterCandidate[]=>labels.map((label,index)=>({label,value:`demo-${prefix}-${index+1}`}));
const dictionaries:Record<string,FilterCandidate[]>={
  industry:[{value:'demo-industry',label:'示例行业'},{value:'demo-industry/demo-industry-1',label:'示例行业/示例子行业甲'},{value:'demo-industry/demo-industry-2',label:'示例行业/示例子行业乙'}],
  sector:choices(['示例产业甲','示例产业乙'],'sector'),
  'business-type':[{value:'demo-business',label:'示例业务类型'},{value:'demo-business/demo-business-1',label:'示例业务类型/示例类型甲'},{value:'demo-business/demo-business-2',label:'示例业务类型/示例类型乙'}],
  'customer-type':choices(['卓越NA','战略NA','核心NA','商业客户（SMB）'],'customer'),
  'customer-sort':choices(['外部','内部'],'sort'),
  'project-level':choices(['公司级','地区部级','代表处级','未立项'],'project'),
  'contact-days':choices(['30天','60天','90天'],'contact'),
  'execution-band':choices(['示例执行率档位甲','示例执行率档位乙'],'execution'),
  'margin-band':choices(['示例销毛率偏差甲','示例销毛率偏差乙'],'margin')
};
/** Normalize only a complete permission payload. Never invent an all-groups fallback. */
export function collaborationCandidates(payload:unknown,complete:boolean):FilterCandidatesResult {
  if(!complete||!payload||typeof payload!=='object')return {kind:'unconfigured'};
  const authority=(payload as {orgAuthority?:{orgUnitList?:unknown}}).orgAuthority;
  if(!Array.isArray(authority?.orgUnitList))return {kind:'unconfigured'};
  const units=authority.orgUnitList.filter(unit=>unit?.orgUnitName==='协同小组');
  if(units.length!==1||!Array.isArray(units[0].dataPermissionList))return {kind:'unconfigured'};
  const candidates:FilterCandidate[]=[],codes=new Set<string>();
  for(const item of units[0].dataPermissionList){
    if(!item||typeof item.permissionName!=='string'||!item.permissionName.trim()||typeof item.permissionValue!=='string'||!item.permissionValue.trim()||codes.has(item.permissionValue))return {kind:'unconfigured'};
    codes.add(item.permissionValue);candidates.push({label:item.permissionName,value:item.permissionValue});
  }
  return values(candidates);
}
/** Development-only isolated gateway; it cannot fall back to a production service. */
export function createIocBusinessPreview(pageId:string,scenario='ready',context='synthetic-business') {
  const base=createIocHeaderPreview(),attempts=new Map<string,number>();
  let modelCalls=0;
  const dataGateway:RuntimeDataGateway={
    async fetchFilterCandidates(request){
      const id=request.filterId,attempt=(attempts.get(id)??0)+1;attempts.set(id,attempt);
      if(id==='region')return values([
        {level:'department',value:'R',label:'示例地区部'},
        {level:'office',value:'R01',label:'示例代表处一',parent:{level:'department',value:'R'}},
        {level:'office',value:'R02',label:'示例代表处二',parent:{level:'department',value:'R'}}
      ]);
      if(id==='model')modelCalls++;
      // Intentionally finish after cancellation to exercise canonical coordinator isolation.
      await new Promise(resolve=>setTimeout(resolve,scenario==='slow'?700:30));
      if(scenario==='error'&&attempt===1)throw new Error('synthetic candidate failure');
      if(scenario==='empty')return values([]);
      if(scenario==='forbidden')return {kind:'denied'};
      if(scenario==='unconfigured'||scenario==='partial'||pageId==='ioc-header-unconfigured')return {kind:'unconfigured'};
      if(id==='model'){
        const range=request.constraints.times.range??request.constraints.times.month;
        if(!range)return {kind:'unconfigured'};
        const prefix=pageId==='ioc-header-inputs'?'M':'MODEL';
        return values([{value:`${prefix}-${range.to}`,label:`模型 ${range.to}`},{value:`ALT-${range.to}`,label:`备选 ${range.to}`}]);
      }
      if(id==='group')return collaborationCandidates({orgAuthority:{orgUnitList:[{orgUnitName:'协同小组',dataPermissionList:[{permissionName:'示例协同小组甲',permissionValue:'GROUP-A'},{permissionName:'示例协同小组乙',permissionValue:'GROUP-B'}]}]}},true);
      if(id==='strategy')return values([{value:'DEMO-202610-A',label:'2026年10月示例策略甲'},{value:'DEMO-202610-B',label:'2026年10月示例策略乙'}]);
      return dictionaries[id]?values(dictionaries[id]!):{kind:'unconfigured'};
    },
    async fetchData(query){
      if(pageId==='ioc-header-months'){
        const selection=query.filterValues.find(value=>value.target==='dimension'&&value.queryField==='synthetic_month_code');
        if(selection?.target!=='dimension'||!selection.values.length||selection.values.some(value=>typeof value!=='string'||!/^\d{4}(0[1-9]|1[0-2])$/.test(value)))throw new Error('合成月份查询需要明确的离散集合');
        return {rows:[{selected_months:selection.values.join(' | '),selected_count:selection.values.length}],totalCount:1};
      }
      const item=query.body.dsl_list?.[0];
      if(!item)throw new Error('unknown synthetic business query');
      if(pageId==='ioc-header-inputs'&&JSON.stringify(item.output_dims)===JSON.stringify(['model']))return {rows:[{model:'合成模型结果',amount:120}],totalCount:1};
      if(JSON.stringify(item.output_dims)!==JSON.stringify(['item','state']))throw new Error('unknown synthetic business query');
      const rows=query.filterValues.map(value=>({
        item:value.target==='dimension'?value.queryField:value.target==='metricRange'?value.metric:value.target==='dimensionRange'?value.queryField:'时间范围',
        state:value.target==='dimension'?value.values.join(' | '):value.target==='time'?`${value.value.from} ~ ${value.value.to}`:`${value.from??'不限'} ~ ${value.to??'不限'}`,
        selection_count:value.target==='dimension'?value.values.length:1
      }));
      if(pageId==='ioc-header-models')rows.push({item:'模型候选请求次数',state:String(modelCalls),selection_count:modelCalls});
      if(pageId==='ioc-header-incentives')rows.push({item:'候选预拉日历月',state:'2026-10',selection_count:attempts.get('strategy')??0});
      const result=rows.length?rows:[{item:'合成请求',state:'无附加条件',selection_count:0}];
      return {rows:pageId==='ioc-header-currency'?result.map(row=>({...row,amount_rmb:0,amount_usd:0})):result,totalCount:result.length};
    }
  };
  const snapshot=base.displayInputs.getSnapshot();
  snapshot.permissionRevision=context;
  return {dataGateway,displayInputs:{getSnapshot:()=>structuredClone(snapshot),subscribe:()=>()=>{}}};
}
