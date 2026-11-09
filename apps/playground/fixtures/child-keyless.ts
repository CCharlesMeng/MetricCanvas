import type { EffectiveQuery } from '@metriccanvas/page/internal';
import type { RuntimeDataGateway } from '@metriccanvas/engine';
import fixture from '../../../tools/dqe-sim/fixtures/table-hierarchy-selection.json';

const parents = fixture.parents.map(row => ({ 'row-id': row.h_row_id, 'region-id': row.h_region, 'region-name': row.h_region_name, amount: row.h_parent_amount }));
const parentOf = new Map(fixture.lookup.map(row => [row.h_office, row.h_parent]));
const records = fixture.children.map(row => ({ 'office-id': row.h_office, 'office-name': row.h_office_name, amount: row.h_child_amount }));
records.splice(1, 0, { ...records[0]!, amount: 999 });
function values(query: EffectiveQuery, field: string): readonly (string | number)[] {
  const input = query.filterValues.find(value => value.target === 'dimension' && value.queryField === field);
  return input?.target === 'dimension' ? input.values : [];
}
function childRows(query: EffectiveQuery): typeof records {
  const region = values(query, 'h_region'), office = values(query, 'h_office');
  if (!region.length) throw Error('子查询必须绑定父行');
  let rows = records.filter(row => region.includes(parentOf.get(row['office-id'])!));
  if (office.length) rows = rows.filter(row => office.includes(row['office-id']));
  if (query.search) rows = rows.filter(row => row['office-name'].includes(query.search!.query));
  const sort = query.sort?.[0];
  const fields: Record<string, keyof typeof records[number]> = { h_office: 'office-id', h_office_name: 'office-name', h_child_amount: 'amount' };
  if (sort) {
    const field = fields[sort.queryField]!;
    rows.sort((a, b) => (sort.direction === 'desc' ? -1 : 1) * String(a[field]).localeCompare(String(b[field]), 'zh-CN', { numeric: true }));
  }
  return rows;
}
function dimensionCandidates(dimension: string) {
  if (dimension === 'h_region') return parents.map(row => ({ value: row['region-id'], label: row['region-name'] }));
  if (dimension === 'h_office') return fixture.children.map(row => ({ value: row.h_office, label: row.h_office_name }));
  if (dimension === 'h_year') return ['2026', '2025'].map(value => ({ value, label: value }));
  if (dimension === 'h_product') return ['all', 'cloud'].map(value => ({ value, label: value }));
  return undefined;
}
/** Synthetic normalized gateway; duplicate office IDs are deliberate independent records. */
export function createKeylessChildPreview(): { dataGateway: RuntimeDataGateway } {
  return { dataGateway: {
    async fetchDimensionValues(dimension, request) {
      request?.signal?.throwIfAborted();
      const candidates = dimensionCandidates(dimension);
      return candidates ? { kind: 'values', candidates } : { kind: 'unavailable' };
    },
    async fetchData(query, _context, signal) {
      await new Promise(resolve => setTimeout(resolve, 120));
      signal?.throwIfAborted();
      const factor = (values(query, 'h_year').includes('2025') ? .8 : 1) * (values(query, 'h_product').includes('cloud') ? .5 : 1);
      if (query.fieldMappings['row-id']) return { rows: parents.map(row => ({ ...row, amount: row.amount * factor })), totalCount: parents.length };
      if (query.fieldMappings['located-region-id']) {
        const rows = fixture.lookup.filter(row => values(query, 'h_office').includes(row.h_office)).map(row => ({ 'located-region-id': row.h_parent }));
        return { rows, totalCount: rows.length };
      }
      const all = childRows(query), offset = query.pagination?.offset ?? 0, limit = query.pagination?.limit ?? all.length;
      return { rows: all.slice(offset, offset + limit).map(row => ({ ...row, amount: row.amount * factor })), totalCount: all.length };
    },
    async fetchFilterCandidates(request, { signal }) {
      signal.throwIfAborted();
      if (request.filterId !== 'region') {
        const candidates = dimensionCandidates(request.dimension);
        return candidates ? { kind: 'values', candidates } : { kind: 'unavailable' };
      }
      return { kind: 'values', candidates: [
        ...parents.map(row => ({ level: 'region-dept', value: row['region-id'], label: row['region-name'] })),
        ...fixture.children.map(row => ({ level: 'office', value: row.h_office, label: row.h_office_name, parent: { level: 'region-dept', value: parentOf.get(row.h_office)! } }))
      ] };
    }
  } };
}
