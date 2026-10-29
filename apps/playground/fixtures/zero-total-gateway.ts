import {createDqeGateway} from '@metriccanvas/engine/dqe';
import type {DataGateway} from '@metriccanvas/engine';

/** Synthetic HTTP receipts for the count-mismatch scenario; business gateways are untouched. */
export function createZeroTotalPreview() {
  return {dataGateway:createDqeGateway({fetchImpl:async (_url, init)=>{
    init?.signal?.throwIfAborted();
    const request=JSON.parse(String(init?.body)) as {dsl_list:{object_type:string}[]};
    return Response.json({retCode:'CBC.0000',results:request.dsl_list.map(item=>{
      const rows=item.object_type==='Demo/Zero Total/empty'?[]:[{'地区部':'甲地区部','得分':0},{'地区部':'乙地区部','得分':-2}];
      return {code:'SUCCESS',columns:null,data:rows,total_count:item.object_type==='Demo/Zero Total/normal'?rows.length:0};
    })});
  }})};
}

export function zeroTotalPreviewGateway(pageId:string, fallback:DataGateway):DataGateway {
  return pageId==='query-zero-total-demo'?createZeroTotalPreview().dataGateway:fallback;
}
