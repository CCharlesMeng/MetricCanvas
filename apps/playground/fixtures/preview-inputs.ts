const businessPages = new Set(Object.keys(import.meta.glob('../../../pages/capabilities/ioc-header/business/*.json')).map(path => path.split('/').pop()!.slice(0, -5)));

/** Fixture routing belongs to preview adapters; directory discovery has no registrations. */
export function pageExternalInputs(id: string | undefined) {
  if (!id) return undefined;
  if (id === 'table-hierarchy-selection') return 'hierarchy';
  if (id === 'record-join-demo' || id === 'record-join-no-row-limit') return 'record-join';
  if (id === 'multi-source-table') return 'paged-union';
  if (id === 'decision-opinion-details') return 'decision-opinion';
  if (id === 'page-visibility-inputs') return 'visibility';
  if (id === 'ioc-header-selection') return 'selection';
  if (businessPages.has(id)) return 'ioc-business';
  if (id.startsWith('ioc-header-') && id.endsWith('-demo')) return 'ioc-header';
  return undefined;
}


/** Synthetic record volume is owned by the preview fixture, not the page route. */
export function rejectionPreviewRowCount(id:string|undefined):number|undefined {
  return id==='record-join-no-row-limit'?100001:undefined;
}
