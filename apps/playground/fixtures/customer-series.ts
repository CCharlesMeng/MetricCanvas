import type {RuntimeDataGateway} from '@metriccanvas/engine';
import {effectiveDqeItem} from '@metriccanvas/engine/dqe';
import type {JsonObject} from '@metriccanvas/page/internal';

const categories = ['卓越', '核心', '战略', '商业客户'];
const groups = [
  {region: '华东', amounts: [100, 60, 40, 80]},
  {region: '华南', amounts: [80, 50, 30, 120]},
  {region: '华北', amounts: [60, 40, 20, 100]},
  {region: '西部', amounts: [40, 30, 0, 60]}
];
const records = groups.flatMap(group => categories.map((category, index) => ({
  region: group.region, category, amount: group.amounts[index]!
})));

/** Synthetic grouped query results; evaluate the encoded customer predicate before runtime computation. */
export function createCustomerSeriesPreview(state = 'ready') {
  const requests: JsonObject[] = [];
  const dataGateway: RuntimeDataGateway = {
    async fetchData(query, _context, signal) {
      signal?.throwIfAborted();
      const item = effectiveDqeItem(query);
      requests.push(structuredClone(item));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('metriccanvas:customer-series-query', {detail: item}));
      }
      if (state === 'error') throw new Error('合成客户分类查询失败');
      if (state === 'empty') return {rows: [], totalCount: 0};
      const filter = item.filter as JsonObject;
      const predicates = filter.dims as JsonObject[];
      const rows = records.filter(row => predicates.every(predicate => matchesCustomer(row.category, predicate)));
      // This complete result is pivoted from category rows to region rows; no remote paging count is needed.
      return {rows};
    }
  };
  return {dataGateway, requests};
}

function matchesCustomer(category: string, predicate: JsonObject): boolean {
  if (predicate.dim_name !== '客户级别') throw new Error('合成示例仅支持客户级别筛选');
  const values = predicate.dim_value_list as unknown[];
  const included = values.includes(category);
  return predicate.is_exclude === true ? !included : included;
}
