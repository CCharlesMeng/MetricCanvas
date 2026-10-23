import {isObjectDqeItem,type EffectiveQuery} from '@metriccanvas/page/internal';
import {fetchComplete} from '../source-program/range-policy';
import type { DataSnapshot, TableQueryView } from '@metriccanvas/page/internal';
import type { QueryRunner } from '../query-runner';
import { evaluateTableView } from '../table-view';
import { rawSnapshot } from '../snapshots';
import { memberQuery, restrictKeys } from './member-query';
import { memberRows, projectRows, ordinalRows, rowFailure } from './rows';
import type { PagedJoinPlan } from './plan';

export async function executePagedJoin(plan: PagedJoinPlan, runner: QueryRunner, scope: string, signal?: AbortSignal, complete = false): Promise<{ snapshot: DataSnapshot; viewCorrection?: TableQueryView }> {
  signal?.throwIfAborted();
  const run = (id: string, query = memberQuery(plan, id)) => runMemberQuery(plan,id,query,runner,scope,signal);
  if (!plan.selection) {
    const domainId = plan.source.source.domainMember;
    const domain = memberRows(plan, domainId, await run(domainId));
    const keys = [...domain.keys()];
    const members = new Map([[domainId, domain]]);
    if (keys.length) await Promise.all([...plan.members.keys()].filter(id => id !== domainId).map(async id => {
      const query = memberQuery(plan, id), member = plan.source.source.members[id];
      const allowed = restrictKeys(query, member.key.queryField, keys);
      members.set(id, memberRows(plan, id, allowed.length ? await run(id, query) : rawSnapshot([], 0), allowed));
    }));
    signal?.throwIfAborted();
    const rows = projectRows(plan, keys, members);
    const sort = [...plan.view.sort];
    if (!sort.some(rule => rule.field === plan.source.source.rowKey)) sort.push({ field: plan.source.source.rowKey, direction: 'asc' });
    const result = evaluateTableView(rows, { ...plan.view, sort }, complete);
    return { snapshot: rawSnapshot(ordinalRows(plan, result.rows, complete ? 0 : result.pageIndex * plan.view.pageSize), result.totalCount),
      ...(result.pageIndex === plan.view.pageIndex ? {} : { viewCorrection: { ...plan.view, pageIndex: result.pageIndex } }) };
  }
  let pageIndex = plan.view.pageIndex;
  let selection = await run(plan.selection, memberQuery(plan, plan.selection, pageIndex));
  if (selection.status === 'ready' || selection.status === 'empty') {
    const total = selection.totalCount;
    if (total !== undefined && pageIndex > 0 && pageIndex * plan.view.pageSize >= total) {
      pageIndex = Math.max(0, Math.ceil(total / plan.view.pageSize) - 1);
      selection = await run(plan.selection, memberQuery(plan, plan.selection, pageIndex));
    }
  }
  const selected = memberRows(plan, plan.selection, selection, undefined, { offset: pageIndex * plan.view.pageSize, limit: plan.view.pageSize });
  const keys = [...selected.keys()], members = new Map([[plan.selection, selected]]);
  if (keys.length) await Promise.all([...plan.members.keys()].filter(id => id !== plan.selection).map(async id => {
    const query = memberQuery(plan, id), member = plan.source.source.members[id];
    const allowed = restrictKeys(query, member.key.queryField, keys);
    members.set(id, memberRows(plan, id, allowed.length ? await run(id, query) : rawSnapshot([], 0), allowed));
  }));
  signal?.throwIfAborted();
  const rows = keys.length ? projectRows(plan, keys, members) : [];
  if (selection.status !== 'ready' && selection.status !== 'empty') throw rowFailure('选页未完成');
  return { snapshot: rawSnapshot(ordinalRows(plan, rows, pageIndex * plan.view.pageSize), selection.totalCount),
    ...(pageIndex === plan.view.pageIndex ? {} : { viewCorrection: { ...plan.view, pageIndex } }) };
}

async function runMemberQuery(plan: PagedJoinPlan, id: string, query: EffectiveQuery, runner: QueryRunner, scope: string, signal?: AbortSignal): Promise<DataSnapshot> {
  const diagnostics={pageId:plan.page.id,dataSourceIds:[plan.source.source.members[id].source]};
  if(isObjectDqeItem(query.body.dsl_list[0]) && !query.pagination) return fetchComplete(query,runner,scope,signal,diagnostics,true);
  return runner.run(query,diagnostics,scope,signal);
}
