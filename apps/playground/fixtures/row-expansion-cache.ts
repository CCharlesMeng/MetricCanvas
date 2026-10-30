import type {DataGateway} from '@metriccanvas/engine';
/** Synthetic normalized rows; the event allows browser assertions on query counts. */
export function createRowCachePreview():{dataGateway:DataGateway}{
  return {dataGateway:{async fetchData(query,_context,signal){
    signal?.throwIfAborted();
    const input=query.filterValues.find(value=>value.target==='dimension'&&value.queryField==='row_customer');
    const parent=input?.target==='dimension'?String(input.values[0]):'';
    if(!parent)throw Error('示例子查询缺少父行条件');
    const offset=query.pagination?.offset??0,limit=query.pagination?.limit??10;
    if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('metriccanvas:row-cache-query',{detail:{parent,offset,limit}}));
    const rows=Array.from({length:25},(_,index)=>({'customer-id':parent,'order-id':`${parent}-${String(index+1).padStart(3,'0')}`,product:`示例产品${index+1}`,amount:index+1}));
    return {rows:rows.slice(offset,offset+limit),totalCount:rows.length};
  }}};
}
