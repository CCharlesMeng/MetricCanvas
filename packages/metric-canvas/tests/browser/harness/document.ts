import { parsePage } from '@metriccanvas/page';
import type { RuntimeDataGateway } from '@metriccanvas/engine';

export const document = {
  schemaVersion: '6.0', id: 'authoring-isolation',
  dataSources: {
    sales: {
      fields: {
        region: { queryField: '区域', type: 'string', role: 'dimension' },
        gmv: { queryField: '成交额', type: 'number', role: 'measure' }
      },
      source: {
        type: 'query',
        query: {
          language: 'dqe',
          body: { dsl_list: [{ output_dims: ['区域'], output_metrics: ['成交额'], filter: { dims: [], metrics: [] }, order: { offset: 0, limit: 10 } }] },
          filterBindings: { region: { target: 'dimension', queryField: '区域' } }
        }
      }
    }
  },
  filters: [{ id: 'region', type: 'dimension', dimension: 'region', label: '区域', display: 'tabs' }],
  sections: [{
    id: 'main', container: 'card', title: '成交情况', components: [
      { id: 'note', type: 'text', layout: { span: 12 }, props: { title: '说明', body: '固定说明', links: [{ label: '关联内容', href: '#linked-content' }] } },
      { id: 'sales', type: 'table', layout: { span: 12 }, data: { main: 'sales' }, props: { title: '成交明细', columns: [{ field: 'region' }, { field: 'gmv' }], pagination: { mode: 'query' } } }
    ]
  }]
};

export function validDocument(raw: unknown) {
  const parsed = parsePage(raw);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  return parsed.page;
}

export function gateway(onfetch: () => void): RuntimeDataGateway {
  return {
    async fetchData(query) {
      onfetch();
      const filter = query.filterValues.find((value) => value.target === 'dimension');
      const region = filter?.target === 'dimension' ? String(filter.values[0]) : '全部';
      const rows = Array.from({ length: 25 }, (_, index) => ({ region: `${region}-${index + 1}`, gmv: index + 100 }));
      const offset = query.pagination?.offset ?? 0;
      const limit = query.pagination?.limit ?? rows.length;
      return { rows: rows.slice(offset, offset + limit), totalCount: rows.length };
    },
    async fetchDimensionValues() { return { kind: 'values', candidates: [{ value: '华东', label: '华东' }, { value: '华南', label: '华南' }] }; }
  };
}
