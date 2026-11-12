// Local diagnostic preview only. All business rows are synthetic.
import { dqeDefaultSort, type EffectiveQuery, type Row } from '../../../packages/page/src/internal';
import type { DataGateway } from '../../../packages/data-execution/src';
import { sortTableRows, localColumnCandidates } from '../../../packages/data-execution/src/runtime';

type RawRow = Record<string, string | number>;
type Predicate = EffectiveQuery['filterValues'][number];
export interface QueryTrace { member: string; offset: number; limit: number; total: number; search: string; sort: string; }

function contract(month: string, index: number): RawRow {
  const serial = String(index + 1).padStart(4, '0');
  const day = String(Math.floor(index / 2) + 1).padStart(2, '0');
  const time = `${month}-${day} ${index % 2 ? '09' : '08'}:00:00`;
  return {
    合同ID: `${month}-${serial}`, 合同编码: `HT-${month.replace('-', '')}-${serial}`,
    地区部: '仿真地区部', 代表处: '仿真代表处', 版本号: 'V1', 合同类型: '销售合同',
    公有云NA级别中文名称: '核心NA', 客户类型: '核心NA', 账期: `${month}-01 00:00:00`,
    项目名称: `仿真合同项目 ${serial}`, 合同状态名称: '已激活', 责任人名称: '仿真责任人',
    合同电子流创建时间: time, 合同激活时间: time, 实际生效时间: time,
    实际失效时间: '2027-12-31 00:00:00', 合同生效日期: `${month}-${day}`,
    合同失效日期: '2027-12-31', 客户名称: `仿真客户 ${serial}`, 华为云账号: `demo-${serial}`,
    合同级别名称: '标准合同'
  };
}
const records = ['2026-10', '2026-11'].flatMap(month => Array.from({ length: 36 }, (_, index) => contract(month, index)));

function matches(row: RawRow, predicate: Predicate): boolean {
  if (predicate.target === 'dimension') return predicate.values.includes(row[predicate.queryField]);
  if (predicate.target === 'time') {
    const month = String(row.账期).slice(0, 7);
    return month >= predicate.value.from.slice(0, 7) && month <= predicate.value.to.slice(0, 7);
  }
  return true;
}

function fieldId(query: EffectiveQuery, queryField: string): string {
  return Object.entries(query.fieldMappings).find(([, definition]) => 'queryField' in definition && definition.queryField === queryField)?.[0] ?? '';
}

function matchingRows(query: EffectiveQuery): Row[] {
  if (!('contract-id' in query.fieldMappings)) return [];
  const selected = records.filter(row => query.filterValues.every(predicate => matches(row, predicate)));
  const search = query.search;
  const matching = search ? selected.filter(row => search.queryFields.some(field => search.match === 'equals' ? row[field] === search.query : String(row[field]).toLowerCase().includes(search.query.toLowerCase()))) : selected;
  const mapped = matching.map(row => Object.fromEntries(Object.entries(query.fieldMappings).map(([id, definition]) => [id, 'queryField' in definition ? row[definition.queryField] ?? null : null])));
  const sort = (query.sort ?? dqeDefaultSort(query.body.dsl_list[0])).map(rule => ({ field: fieldId(query, rule.queryField), direction: rule.direction }));
  return sortTableRows(mapped, sort);
}

export function createContractPreviewGateway(record: (trace: QueryTrace) => void = () => {}): DataGateway {
  return {
    async fetchData(query) {
      const rows = matchingRows(query), window = query.pagination;
      record({ member: 'eflow-create-time' in query.fieldMappings ? '基础资料' : '明细查询', offset: window?.offset ?? 0,
        limit: window?.limit ?? rows.length, total: rows.length, search: query.search?.query ?? '',
        sort: (query.sort ?? dqeDefaultSort(query.body.dsl_list[0])).map(rule => `${rule.queryField} ${rule.direction}`).join(', ') });
      return { rows: window ? rows.slice(window.offset, window.offset + window.limit) : rows, totalCount: rows.length };
    },
    async fetchColumnCandidates(request) {
      return localColumnCandidates(matchingRows(request.query), request.field, { pageIndex: 0, pageSize: request.limit, sort: [], predicates: [] }, request.search, request.offset, request.limit);
    }
  };
}
