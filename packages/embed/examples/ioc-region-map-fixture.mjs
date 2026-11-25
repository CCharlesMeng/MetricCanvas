import {createRegionDepartmentFacts} from './region-department-facts.mjs';
const departments = [
  { 'org-key': '欧洲地区部', discount: 38.5 },
  { 'org-key': '中国地区部', discount: 31.2 },
  { 'org-key': '拉美地区部', discount: 44.1 }
];

const offices = [
  { 'org-key': '德国代表处', 'region-key': '欧洲地区部', discount: 35.7 },
  { 'org-key': '法国代表处', 'region-key': '欧洲地区部', discount: 41.4 },
  { 'org-key': '北京代表处', 'region-key': '中国地区部', discount: 29.8 },
  { 'org-key': '上海代表处', 'region-key': '中国地区部', discount: 27.4 },
  { 'org-key': '深圳办事处', 'region-key': '中国地区部', discount: 32.6 },
  { 'org-key': '巴西代表处', 'region-key': '拉美地区部', discount: 45.2 }
];

const regionNodes = ['全球', ...departments.map(row => row['org-key'])]
  .map(value => ({ level: 'region-dept', value, label: value }));
const officeNodes = offices.map(row => ({
  level: 'office', value: row['org-key'], label: row['org-key'],
  parent: { level: 'region-dept', value: row['region-key'] }
}));

const displayNames = {
  'region-dept': { 中国地区部: '中国区', 欧洲地区部: '欧洲' },
  office: { 德国代表处: '德国', 法国代表处: ' ' }
};

/** @type {Partial<Record<'region-dept' | 'office', Record<string, import('@metriccanvas/engine/ui').MapViewport>>>} */
const viewports = {
  'region-dept': { 欧洲地区部: { center: [14, 48], zoom: 6.4 } },
  office: {
    德国代表处: { center: [10.45, 51.16], zoom: 5 },
    法国代表处: { center: [2.2, 46.8], zoom: 5 }
  }
};

/** @param {Parameters<import('@metriccanvas/engine').RuntimeDataGateway['fetchData']>[0]} query */
function queryRows(query) {
  const source = query.body.dsl_list[0].output_dims.includes('代表处') ? offices : departments;
  const region = query.filterValues.find(filter => filter.target === 'dimension');
  return source.filter(row => {
    if (!region) return true;
    const field = region.queryField === '地区部' && source === offices ? 'region-key' : 'org-key';
    return region.values.includes(row[field]);
  });
}

/** @param {typeof import('@metriccanvas/engine').withOperationMapRegion} withOperationMapRegion */
export function createRegionMapFixture(withOperationMapRegion, { focus = true, delay = 0, initialSearch = '', baseGateway } = {}) {
  const queries = [];
  const viewRequests = [];
  const dataGateway = withOperationMapRegion(baseGateway ?? {
    async fetchData(query) {
      queries.push(query.filterValues);
      const rows = queryRows(query);
      return { rows, totalCount: rows.length };
    }
  }, {
    async fetchRegionCandidates(request, { signal }) {
      signal.throwIfAborted();
      const values = request.level === 'geo' ? [] : regionNodes;
      return { kind: 'values', candidates: request.level === 'office' ? [...values, ...officeNodes] : values };
    }
  });

  /** @type {import('@metriccanvas/engine/ui').RegionMapAdapter} */
  const regionMap = {
    displayNames: new URLSearchParams(initialSearch).get('mapLabels') === 'short' ? displayNames : undefined,
    geography: {
      world: {
        'region-dept': {
          欧洲地区部: {point:{lngLat:[21,52.13]}, ...(focus && {viewport:{center:[20.7129,60.166],zoom:3}})},
          中国地区部: {point:{feature:'China'}},
          拉美地区部: {point:{lngLat:[-62,-15]},features:['Brazil','Argentina']}
        },
        office:{德国代表处:{point:{feature:'Germany'}},法国代表处:{point:{feature:'France'}},巴西代表处:{point:{feature:'Brazil'}}}
      },
      china:{office:{北京代表处:{point:{feature:'北京市'}},上海代表处:{point:{feature:'上海市'}},深圳办事处:{point:{feature:'广东省'}}}}
    },
    async resolveViewport(request, { signal }) {
      const record = { ...request, aborted: false };
      viewRequests.push(record);
      // Slow demo mode intentionally returns a late response to exercise Embed cancellation.
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      record.aborted = signal.aborted;
      if (focus && request.basemap === 'world') return viewports[request.level]?.[request.value];
    }
  };
  return { dataGateway, regionMap, queries, viewRequests, ...createRegionDepartmentFacts([...regionNodes,...officeNodes], initialSearch) };
}
