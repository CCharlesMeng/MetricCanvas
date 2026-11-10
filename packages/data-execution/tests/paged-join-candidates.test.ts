import { expect, it } from 'vitest';
import document from '../../../pages/capabilities/table/paged-join-on-demand.json';
import { parsePage, type JsonObject } from '@metriccanvas/page/internal';
import { createSourceProgram, defaultSourceView } from '../src/runtime';
import { createDqeGateway } from '../src/dqe';

it.each(['dimension', 'object'])('preloads a supplementary %s field through its own query mapping', async kind => {
  const input = structuredClone(document);
  if (kind === 'object') {
    Object.assign(input.dataSources['project-information'].source.query.body.dsl_list[0], {
      query_type: 'object', object_type: 'Example/Projects', output_fields: ['项目编号', '项目状态', '合同金额'], filter: { fields: [] }
    });
    Reflect.deleteProperty(input.dataSources['project-information'].source.query.body.dsl_list[0], 'output_dims');
    Reflect.deleteProperty(input.dataSources['project-information'].source.query.body.dsl_list[0], 'output_metrics');
  }
  const parsed = parsePage(input); if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
  const requests: JsonObject[] = [];
  const gateway = createDqeGateway({ columnCandidates: { mode: 'fullQuery' }, fetchImpl: async (_url, init) => {
    const items: JsonObject[] = JSON.parse(String(init?.body)).dsl_list;
    requests.push(...items);
    return Response.json({retCode:'CBC.0000',results:items.map(() => ({code:'SUCCESS',total_count:80,
      data:Array.from({length:80},(_,index)=>({'项目编号':`P${index}`, '项目状态':index%2?'已关闭':'进行中', '合同金额':index*1000}))}))});
  } });
  const program = createSourceProgram(parsed.page, { gateway });
  const request = { sourceId:'projects', field:'project-status', conditions:new Map(),
    view:{...defaultSourceView(parsed.page,'projects'),predicates:[{field:'approval-count',op:'gte' as const,value:70}]}, preload:true };
  try {
    expect(await program.readColumnCandidates(request)).toMatchObject({kind:'values',totalCount:2});
    expect(requests).toHaveLength(1);
    expect(JSON.stringify(requests)).not.toContain('审批次数');
    if (kind === 'object') expect(requests[0].output_fields).toEqual(['项目状态']);
    else expect(requests[0].output_dims).toEqual(['项目编号','项目状态']);
    expect(await program.readColumnCandidates({...request,preload:false})).toMatchObject({kind:'values',totalCount:2});
    expect(requests).toHaveLength(1);
  } finally { program.dispose(); }
});

it('keeps an ineligible supplementary member unavailable without issuing a query', async () => {
  const input = structuredClone(document);
  input.dataSources.projects.source.members.b.canSelectPage = false;
  const parsed = parsePage(input); if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
  let calls = 0;
  const program = createSourceProgram(parsed.page, { gateway: {
    fetchData: async () => { calls++; return { rows: [], totalCount: 0 }; },
    fetchColumnCandidates: async () => { calls++; return { kind: 'values', candidates: [], totalCount: 0 }; }
  } });
  try {
    for (const preload of [true, false]) expect(await program.readColumnCandidates({sourceId:'projects',field:'project-status',conditions:new Map(),view:defaultSourceView(parsed.page,'projects'),preload})).toEqual({kind:'unavailable'});
    expect(calls).toBe(0);
  } finally { program.dispose(); }
});
