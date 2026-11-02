import type { RuntimeDataGateway } from '@metriccanvas/engine';

/** Synthetic organization values demonstrate Chinese stable values, not production permissions. */
const offices = [
  { office: '上海代表处', region: '中国地区部', amount: 10 },
  { office: '北京代表处', region: '中国地区部', amount: 20 },
  { office: '法国代表处', region: '欧洲地区部', amount: 30 }
];

export function createRegionURLGateway(): RuntimeDataGateway {
  return {
    async fetchFilterCandidates(_request, { signal }) {
      signal.throwIfAborted();
      return { kind: 'values', candidates: [
        ...['中国地区部', '欧洲地区部'].map(value => ({ value, label: value, level: 'region-dept' })),
        ...offices.map(item => ({ value: item.office, label: item.office, level: 'office', parent: { level: 'region-dept', value: item.region } }))
      ] };
    },
    async fetchData(query) {
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('metriccanvas:synthetic-region-url', { detail: query }));
      const rows = offices.filter(item => query.filterValues.every(predicate => {
        if (predicate.target !== 'dimension') return true;
        if (predicate.queryField === 'demo_region') return predicate.values.includes(item.region);
        if (predicate.queryField === 'demo_office') return predicate.values.includes(item.office);
        return true;
      })).map(item => ({ office: item.office, amount: item.amount }));
      return { rows, totalCount: rows.length };
    }
  };
}
