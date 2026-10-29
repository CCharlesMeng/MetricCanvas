const recordJoinPages = new Set(['record-join-demo', 'record-join-no-row-limit', 'record-join-batch-timeout']);
const zeroTotalPages = new Set(['query-zero-total-demo', 'query-zero-total-hierarchy']);
const unionPages = new Set(['multi-source-table', 'multi-source-composite-key', 'multi-source-generated-key']);
const businessPages = new Set(Object.keys(import.meta.glob('../../../pages/capabilities/ioc-header/business/*.json')).map(path => path.split('/').pop()!.slice(0, -5)));

/** Fixture routing belongs to preview adapters; directory discovery has no registrations. */
export function pageExternalInputs(id: string | undefined) {
  if (!id) return undefined;
  if (id === 'partner-health-union-null-probe') return 'organization-union';
  if (id === 'table-data-recovery') return 'table-recovery';
  if (zeroTotalPages.has(id)) return 'zero-total';
  if (id === 'table-hierarchy-selection') return 'hierarchy';
  if (recordJoinPages.has(id)) return 'record-join';
  if (unionPages.has(id)) return 'paged-union';
  if (id === 'decision-opinion-details') return 'decision-opinion';
  if (id === 'page-visibility-inputs') return 'visibility';
  if (id === 'ioc-header-selection') return 'selection';
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
