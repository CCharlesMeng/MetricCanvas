import type {RuntimeDataGateway} from '@metriccanvas/engine';
import type {EffectiveQuery} from '@metriccanvas/page/internal';

function selected(query: EffectiveQuery, field: string): string | undefined {
  const predicate = query.filterValues.find(value => value.target === 'dimension' && value.queryField === field);
  return predicate?.target === 'dimension' ? String(predicate.values[0]) : undefined;
}

/** Synthetic independent queries; regional selection never enters the benchmark query. */
export function createGlobalBenchmarkPreview(state = 'ready') {
  const requests: EffectiveQuery[] = [];
  const dataGateway: RuntimeDataGateway = {async fetchData(query, context, signal) {
    signal?.throwIfAborted();
    requests.push(structuredClone(query));
    const benchmark = context?.dataSourceIds?.includes('benchmark');
    const adjustment = (selected(query,'统计月份') === '2026-11' ? 1 : 0) + (selected(query,'国内或海外') === '海外' ? 5 : 0);
    if (benchmark) return benchmarkResult(state, adjustment);
    const dept = selected(query,'地区部');
    const offices = [{office:'甲代表处',dept:'东区',actual:20,mom:2,yoy:5},{office:'乙代表处',dept:'东区',actual:12,mom:-1,yoy:3},{office:'丙代表处',dept:'西区',actual:18,mom:1,yoy:-2}];
    const rows = offices.filter(row => !dept || row.dept === dept).map(row => ({office:row.office,actual:row.actual+adjustment,mom:row.mom,yoy:row.yoy}));
    return {rows,totalCount:rows.length};
  }};
  return {dataGateway,requests};
}

function benchmarkResult(state: string, adjustment: number) {
  if (state === 'error') throw new Error('合成均值查询失败');
  if (state === 'empty') return {rows:[],totalCount:0};
  const average = state === 'zero' ? 0 : 15+adjustment;
  const rows = state === 'duplicate' ? [{average},{average}] : [{average}];
  return {rows,totalCount:rows.length};
}
