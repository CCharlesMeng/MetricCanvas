import { expect, it } from 'vitest';
import type { EffectiveQuery } from '@metriccanvas/page/internal';
import { normalizeQueryRows } from '@metriccanvas/page/internal';
import { createDqeGateway } from '../src/dqe';

const query: EffectiveQuery = { language: 'dqe', body: { dsl_list: [{output_dims:['id','name'],output_metrics:[]}] }, filterValues: [],
  fieldMappings: { id:{queryField:'id',type:'string',role:'dimension',nullable:false}, name:{queryField:'name',type:'string',role:'dimension'} } };

it('recovers malformed DQE rows and missing totals only in bounded composition requests', async () => {
  const bodies: unknown[] = [];
  const gateway = createDqeGateway({ fetchImpl: async (_url, init) => {
    bodies.push(JSON.parse(String(init?.body)));
    return Response.json({retCode:'CBC.0000',results:[{code:'SUCCESS',data:[null,{id:'A',name:{private:'value'}},{id:'B'}]}]});
  } });
  await expect(gateway.fetchData(query)).rejects.toMatchObject({code:'DQE_ROW_CONTRACT_ERROR'});
  const recovered = await gateway.fetchData({...query,resultPolicy:'display'});
  expect(recovered.rows).toEqual([{id:null,name:null},{id:'A',name:null},{id:'B',name:null}]);
  expect(recovered.totalCount).toBeUndefined();
  expect(JSON.stringify(bodies)).not.toContain('resultPolicy');
  expect(normalizeQueryRows([{}],query.fieldMappings).ok).toBe(false);
});

it('treats a null result set as unavailable rows without changing the ordinary contract', async () => {
  const gateway = createDqeGateway({fetchImpl:async()=>Response.json({retCode:'CBC.0000',results:[{code:'SUCCESS',data:null,total_count:0}]})});
  await expect(gateway.fetchData(query)).rejects.toMatchObject({code:'DQE_ROW_CONTRACT_ERROR'});
  expect(await gateway.fetchData({...query,resultPolicy:'display'})).toMatchObject({rows:[],totalCount:0});
});
