/** Local synthetic acceptance only: echo the effective predicates, never business data. */
export function iocHeaderFixture(item) {
  if(!item || typeof item!=='object')return;
  if(JSON.stringify(item.output_dims)===JSON.stringify(['ioc-header-legacy-path']))return result(item,[{'ioc-header-legacy-path':'North/One'},{'ioc-header-legacy-path':'North/Two'}],['ioc-header-legacy-path'],[]);
  if(JSON.stringify(item.output_dims)===JSON.stringify(['ioc-header-month']) && Array.isArray(item.output_metrics) && !item.output_metrics.length) {
    const values=Array.from({length:12},(_,index)=>`2026-${String(index+1).padStart(2,'0')}`);
    return result(item,values.map(value=>({'ioc-header-month':value})),['ioc-header-month'],[]);
  }
  if(!item.output_dims?.includes('ioc_header_scope') || JSON.stringify(item.output_metrics)!==JSON.stringify(['ioc_header_count']))return;
  const time=item.filter?.time;
  const dims=item.filter?.dims??[];
  const scope=[time?`${time.start??''} 至 ${time.end??''}`:'',...dims.map(d=>`${d.dim_name}=${(d.dim_value_list??[]).join(',')}`)].filter(Boolean).join('；') || '无绑定条件';
  return result(item,[{...Object.fromEntries(item.output_dims.map(field=>[field,dims.find(dim=>dim.dim_name===field)?.dim_value_list?.[0]??null])),ioc_header_scope:`合成 · ${scope}`,ioc_header_count:1}],item.output_dims,['ioc_header_count']);
}
function result(item,rows,dimensions,metrics) {
  const offset=item.order?.offset??0,limit=item.order?.limit??rows.length;
  return {code:'SUCCESS',data:rows.slice(offset,offset+limit),total_count:rows.length,dqe:{columns:[
    ...dimensions.map(caption=>({id:`demo.${caption}`,caption,data_type:'STRING',type:'dimension'})),
    ...metrics.map(caption=>({id:`demo.${caption}`,caption,data_type:'NUMBER',type:'metric'}))],orders:[],limit,offset,sql:null}};
}
