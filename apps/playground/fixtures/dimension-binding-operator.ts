import type {RuntimeDataGateway} from '@metriccanvas/engine';
import {effectiveDqeItem} from '@metriccanvas/engine/dqe';
import type {JsonObject} from '@metriccanvas/page/internal';

const rows=[
  {区域:'北区',代表处:'北京',金额:10},
  {区域:'北区',代表处:'天津',金额:20},
  {区域:'南区',代表处:'广州',金额:30}
];
/** Evaluate actual encoded predicates over synthetic records; no production capability claim. */
export function createDimensionOperatorPreview(state='ready') {
  const dataGateway:RuntimeDataGateway={
    async fetchFilterCandidates(){return {kind:'values',candidates:[
      {level:'area',value:'北区',label:'北区'}, {level:'area',value:'南区',label:'南区'},
      {level:'office',value:'北京',label:'北京',parent:{level:'area',value:'北区'}},
      {level:'office',value:'天津',label:'天津',parent:{level:'area',value:'北区'}},
      {level:'office',value:'广州',label:'广州',parent:{level:'area',value:'南区'}}
    ]};},
    async fetchData(query){
      const item=effectiveDqeItem(query);
      if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('metriccanvas:dimension-operator',{detail:item}));
      if(state==='error')throw new Error('合成维度排除查询失败');
      if(state==='empty')return {rows:[],totalCount:0};
      const filter=item.filter as JsonObject;
      const predicates=(filter.fields??filter.dims) as JsonObject[];
      const selected=rows.filter(row=>predicates.every(predicate=>matches(row,predicate)));
      return {rows:selected.map(row=>({area:row.区域,office:row.代表处,amount:row.金额})),totalCount:selected.length};
    }
  };
  return {dataGateway};
}
function matches(row:typeof rows[number],predicate:JsonObject):boolean {
  const field=String(predicate.field_name??predicate.dim_name) as keyof typeof row;
  const values=(predicate.value_list??predicate.dim_value_list) as unknown[];
  const includes=values.includes(row[field]);
  return predicate.operator==='!='||predicate.is_exclude===true?!includes:includes;
}
