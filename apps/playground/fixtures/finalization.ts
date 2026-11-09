import type {RuntimeDataGateway} from '@metriccanvas/engine';
import {effectiveDqeItem} from '@metriccanvas/engine/dqe';

/** Synthetic receipts exercise engine initialization; no production table or endpoint is implied. */
export function createFinalizationPreview(state = 'ready') {
  let cutoffReads = 0;
  const dataGateway: RuntimeDataGateway = {
    finalizationSource: {
      body: {dsl_list: [{output_dims: ['名称', '截止日期'], filter: {}}]},
      nameField: '名称', dateField: '截止日期', timeoutMs: 50
    },
    async fetchData(query, _context, signal) {
      signal?.throwIfAborted();
      if (query.fieldMappings.name) {
        cutoffReads++;
        return cutoffResult(state);
      }
      const item = effectiveDqeItem(query);
      const time = (item.filter as {time: {start: string; end: string}}).time;
      return {rows: [{entry: `${time.start} 至 ${time.end}；定稿查询 ${cutoffReads} 次`, amount: 42}], totalCount: 1};
    }
  };
  return {dataGateway};
}

function cutoffResult(state: string): Promise<{rows: Array<{name: string; date: string}>}> | {rows: Array<{name: string; date: string}>} {
  if (state === 'error') throw new Error('合成定稿查询失败');
  if (state === 'timeout') return new Promise(() => {});
  if (state === 'missing') return {rows: []};
  const rows = [{name: '经营数据', date: state === 'invalid' ? '2026-02-30' : '2026-10-18'}];
  if (state === 'conflict') rows.push({name: '经营数据', date: '2026-09-30'});
  return {rows};
}
