import { iocHeaderDeclaration, hasLegacyDefaultHeader } from '@metriccanvas/page/internal';
import { pageListEntry, type Page, type FilterDeclaration } from '@metriccanvas/page/internal';
import { contentFilterDeclarations } from '../report-date-header';
import { visibleFilterDeclarations } from '../filters/filter-bar';
import { headerFilterGroups, placeHeaderFilterRows, selectHeaderFilters, type ResolvedHeaderFilterRow } from './filter-groups';
import { resolvedIocHeader, type ResolvedIocHeader } from './model';

export interface PageHeaderPresentation {
  model?: ResolvedIocHeader;
  primary: FilterDeclaration[];
  overflow: FilterDeclaration[];
  filterRows?: ResolvedHeaderFilterRow[];
  content: FilterDeclaration[];
  readOnly: boolean;
  note?: string;
}

/** Legacy metadata is accepted at this seam; every page uses IocHeader to render. */
export function pageFiltersReadOnly(page: Page): boolean {
  return iocHeaderDeclaration(page)?.readOnly === true || typeof page.dashboardToolbar === 'object' && page.dashboardToolbar.readOnly === true;
}

function legacyHeader(page: Page): ResolvedIocHeader | undefined {
  if (page.layout !== 'dashboard' || page.dashboardToolbar === 'hidden' || page.dashboardToolbar===undefined&&!hasLegacyDefaultHeader(page)) return undefined;
  const compact = typeof page.dashboardToolbar === 'object' && page.dashboardToolbar.variant === 'compact';
  return {...resolvedIocHeader({identity:{title:pageListEntry(page).title},back:true,presentation:{layout:'inline',collapse:'overflow',density:compact?'compact':'normal'}}),legacyBack:true};
}

/** Owns filter placement, not filter state, candidates, or queries. */
export function resolvePageHeader(page: Page, declarations: FilterDeclaration[]): PageHeaderPresentation {
  const available = contentFilterDeclarations(page, declarations);
  const header = iocHeaderDeclaration(page);
  const model = header ? resolvedIocHeader(header) : legacyHeader(page);
  const readOnly = pageFiltersReadOnly(page);
  const note = header?.note ?? (typeof page.dashboardToolbar === 'object' ? page.dashboardToolbar.note : undefined);
  if (!model) return {primary:[],overflow:[],content:available,readOnly,note};
  const selected = header ? selectHeaderFilters(available, header.filterIds) : available;
  const { primary, filterRows } = placeHeaderFilterRows(visibleFilterDeclarations(selected), header?.filterRows);
  const groups = model.collapse === 'overflow' ? headerFilterGroups(primary,model.density==='compact'?'compact':undefined) : {primary,overflow:[],content:[]};
  const claimed = new Set(selected.map(filter=>filter.id));
  return {model,...groups,filterRows,content:[...available.filter(filter=>!claimed.has(filter.id)),...groups.content],readOnly,note};
}
