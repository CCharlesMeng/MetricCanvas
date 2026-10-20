/** Synthetic dual-currency values are independent fixture facts, never converted by the frontend. */
export function iocCurrencyFixture(item){
 if(!item?.output_dims?.includes('ioc_amount_project'))return;
 let rows=[{ioc_amount_project:'甲项目',ioc_amount_base_cny:2000000,ioc_amount_fee_cny:200000,ioc_amount_base_usd:300000,ioc_amount_fee_usd:10000},{ioc_amount_project:'乙项目',ioc_amount_base_cny:5000000,ioc_amount_fee_cny:500000,ioc_amount_base_usd:700000,ioc_amount_fee_usd:20000}];
 const metrics=item.filter?.metrics??[];
 for(const predicate of metrics){const name=predicate.metric_name??predicate.metric;const operator=predicate.operator??predicate.op;const value=Number(predicate.metric_value_list?.[0]??predicate.metric_value??predicate.value);if(name&&Number.isFinite(value))rows=rows.filter(row=>operator==='>='?row[name]>=value:operator==='<='?row[name]<=value:true);}
 const scope=`合成 · ${JSON.stringify(metrics)}`;rows=rows.map(row=>({...row,ioc_amount_scope:scope}));
 const offset=item.order?.offset??0,limit=item.order?.limit??rows.length;
 return {code:'SUCCESS',data:rows.slice(offset,offset+limit),total_count:rows.length,dqe:{columns:[...item.output_dims.map(caption=>({id:`demo.${caption}`,caption,data_type:'STRING',type:'dimension'})),...item.output_metrics.map(caption=>({id:`demo.${caption}`,caption,data_type:'NUMBER',type:'metric'}))],orders:[],limit,offset,sql:null}};
}
