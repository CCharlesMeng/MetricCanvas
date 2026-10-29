const zeroTotalPages = new Set(['query-zero-total-demo', 'query-zero-total-hierarchy']);
const unionPages = new Set(['multi-source-table', 'multi-source-composite-key', 'multi-source-generated-key']);
const businessPages = new Set(Object.keys(import.meta.glob('../../../pages/capabilities/ioc-header/business/*.json')).map(path => path.split('/').pop()!.slice(0, -5)));
const exactInputs = new Map([
  ['key-office-filter-demo','key-office'], ['key-office-filter-target','key-office'],
  ['ioc-project-overview','ioc-region'], ['ioc-opportunity-list','ioc-region'], ['ioc-opportunity-analysis','ioc-region'],
  ['table-column-candidates-query', 'full-query-candidates'],
  ['partner-health-union-null-probe', 'organization-union'],
  ['table-data-recovery', 'table-recovery'],
  ['table-hierarchy-selection', 'hierarchy'],
  ['record-join-demo', 'record-join'],
  ['record-join-no-row-limit', 'record-join'],
  ['record-join-batch-timeout', 'record-join'],
  ['decision-opinion-details', 'decision-opinion'],
  ['page-visibility-inputs', 'visibility'],
  ['ioc-header-selection', 'selection']
]);

/** Fixture routing belongs to preview adapters; directory discovery has no registrations. */
export function pageExternalInputs(id: string | undefined) {
  if (!id) return undefined;
  const exact = exactInputs.get(id);
  if (exact) return exact;
  if (zeroTotalPages.has(id)) return 'zero-total';
  if (unionPages.has(id)) return 'paged-union';
  if (businessPages.has(id)) return 'ioc-business';
  if (id.startsWith('ioc-header-') && id.endsWith('-demo')) return 'ioc-header';
  return undefined;
}


/** Synthetic record volume is owned by the preview fixture, not the page route. */
export function rejectionPreviewRowCount(id:string|undefined,mode:'page'|'catalog'='page'):number|undefined {
  if(id==='record-join-batch-timeout')return 12;
  if(mode==='catalog')return undefined;
  return id==='record-join-no-row-limit'?100001:undefined;
}

/** Slow synthetic batches demonstrate timeout renewal without calling a real service. */
export function rejectionPreviewDelay(id:string|undefined,params=new URLSearchParams()):number|undefined {
  if(id!=='record-join-batch-timeout')return undefined;
  return params.get('sourceTimeout')==='true'?1500:250;
}
