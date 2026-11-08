import type { DataGateway } from '@metriccanvas/engine';
import type { EffectiveQuery } from '@metriccanvas/page/internal';
import { effectiveDqeItem } from '@metriccanvas/engine/dqe';

/** Deterministic monthly receipts. They do not implement annual aggregation. */
export function createPeriodAggregationPreview(state = 'ready') {
  const requests: EffectiveQuery[] = [];
  const dataGateway: DataGateway = {
    async fetchData(query, _diagnostics, signal) {
      signal?.throwIfAborted();
      requests.push(structuredClone(query));
      const time = effectiveDqeItem(query).filter as { time: { start: string; end: string; period: string } };
      if (time.time.period !== 'month' || time.time.start !== time.time.end) throw Object.assign(new Error('合成场景只接受完整单月请求'), { code: 'DQE_QUERY_REJECTED' });
      if (state === 'error') throw Object.assign(new Error('合成月度查询失败'), { code: 'DQE_TRANSPORT_ERROR' });
      const month = Number(time.time.start.slice(5));
      const rows = [
        { 'rep-office': '合成代表处甲', 'decision-count': 10, 'avg-decision-time': month },
        { 'rep-office': '合成代表处乙', 'decision-count': 5, 'avg-decision-time': 0 },
        { 'rep-office': '合成代表处丙', 'decision-count': null, 'avg-decision-time': null }
      ];
      if (state === 'missing' && month === 2) rows.splice(1, 1);
      if (state === 'duplicate') rows.push(rows[0]);
      return { rows, totalCount: rows.length + (state === 'truncated' ? 1 : 0) };
    }
  };
  return { dataGateway, requests };
}
