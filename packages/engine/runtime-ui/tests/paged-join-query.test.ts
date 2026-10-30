import {it,expect,vi} from 'vitest';
import document from '../../../../pages/capabilities/table/paged-join-on-demand.json';
import recordDocument from '../../../../pages/capabilities/table/record-join-on-demand.json';
import {parsePage} from '@metriccanvas/page';
import {orchestrate} from '../../runtime/src/orchestrator';
import {createTableController} from '../src/table/controller';
import {createPagedJoinPreview} from '../../../../apps/playground/fixtures/query-join-gateway';
import {createRejectionPreview} from '../../../../apps/playground/fixtures/rejection-details/gateway';

it('atomically replaces source state, clears draft checkboxes, and never starts idle preloads',async()=>{
  const result=parsePage(document);if(!result.ok)throw Error(JSON.stringify(result.errors));
  const page=result.page,table=page.sections[0].components[0];if(table.type!=='table')throw Error('table');
  const preview=createPagedJoinPreview(),stream=orchestrate(page,preview.dataGateway),stop=stream.subscribe(()=>{});
  const controller=createTableController(page,()=>stream,()=>{});
  try{
    await vi.waitFor(()=>expect(preview.calls).toHaveLength(2));
    controller.candidateBinding(table).oncandidatepreloadvisible(true);
    await new Promise(resolve=>setTimeout(resolve,80));expect(preview.calls).toHaveLength(2);
    controller.header(table,'project-status',{mode:'select',values:['已关闭']});
    expect(stream.getQueryView('projects')).toMatchObject({sort:[],pageIndex:0,predicates:[{field:'project-status',op:'in',values:['已关闭']}]});
    await vi.waitFor(()=>expect(preview.calls).toHaveLength(4));
    controller.sort(table,[{field:'approval-count',direction:'asc'}]);
    expect(stream.getQueryView('projects')).toMatchObject({sort:[{field:'approval-count',direction:'asc'}],predicates:[],pageIndex:0});
    expect(controller.render(table).headerFilters).toEqual({});
    await vi.waitFor(()=>expect(preview.calls).toHaveLength(6));
    controller.sort(table,[{field:'approval-count',direction:'asc'},{field:'contract-amount',direction:'desc'}]);
    expect(stream.getQueryView('projects')?.sort).toEqual([{field:'contract-amount',direction:'desc'}]);
    await vi.waitFor(()=>expect(preview.calls).toHaveLength(8));
    controller.header(table,'project-status',{mode:'isNull'});
    expect(controller.render(table).operationNotice).toContain('为空');expect(preview.calls).toHaveLength(8);
  }finally{controller.dispose();stop();}
});
it('shows an unsupported record-source operation while retaining the valid page',async()=>{
  const result=parsePage(recordDocument);if(!result.ok)throw Error(JSON.stringify(result.errors));
  const page=result.page,table=page.sections.flatMap(section=>section.components).find(component=>component.type==='table');if(!table||table.type!=='table')throw Error('table');
  const preview=createRejectionPreview({rows:30}),stream=orchestrate(page,preview.dataGateway),stop=stream.subscribe(()=>{});
  const controller=createTableController(page,()=>stream,()=>{});
  try{
    await vi.waitFor(()=>expect(stream.captureRawSnapshots().get('rejection-overview')?.status).toBe('ready'));
    const before=preview.calls.length,view=stream.getQueryView('rejection-overview');
    controller.header(table,'life-status',{mode:'select',values:['已关闭']});
    expect(controller.render(table).operationNotice).toContain('分页');expect(stream.getQueryView('rejection-overview')).toEqual(view);expect(preview.calls).toHaveLength(before);
  }finally{controller.dispose();stop();}
});
