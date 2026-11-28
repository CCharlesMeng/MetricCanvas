import {
  type FilterDeclaration,
  type Page,
  pageListEntry,
  resolveDashboardHeaderConfig,
} from '@metriccanvas/page/internal';
import { visibleFilterDeclarations } from '../filters/filter-bar';
import { contentFilterDeclarations } from '../report-date-header';
import {
  headerFilterGroups,
  placeHeaderFilterRows,
  type ResolvedHeaderFilterRow,
  selectHeaderFilters,
} from './filter-groups';
import { type ResolvedIocHeader, resolvedIocHeader } from './model';

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
  return resolveDashboardHeaderConfig(page).readOnly;
}

function legacyHeader(page: Page, compact: boolean): ResolvedIocHeader {
  return {
    ...resolvedIocHeader({
      identity: { title: pageListEntry(page).title },
      back: true,
      presentation: {
        layout: 'inline',
        collapse: 'overflow',
        density: compact ? 'compact' : 'normal',
      },
    }),
    legacyBack: true,
  };
}

/** Owns filter placement, not filter state, candidates, or queries. */
export function resolvePageHeader(
  page: Page,
  declarations: FilterDeclaration[],
): PageHeaderPresentation {
  const available = contentFilterDeclarations(page, declarations);
  const config = resolveDashboardHeaderConfig(page);
  const header = config.iocHeader;
  const model = header
    ? resolvedIocHeader(header)
    : config.legacyDashboardHeader
      ? legacyHeader(page, config.compact)
      : undefined;
  const { readOnly, note } = config;
  if (!model) return { primary: [], overflow: [], content: available, readOnly, note };
  const selected = header ? selectHeaderFilters(available, header.filterIds) : available;
  const { primary, filterRows } = placeHeaderFilterRows(
    visibleFilterDeclarations(selected),
    header?.filterRows,
  );
  const groups =
    model.collapse === 'overflow'
      ? headerFilterGroups(primary, model.density === 'compact' ? 'compact' : undefined)
      : { primary, overflow: [], content: [] };
  const claimed = new Set(selected.map((filter) => filter.id));
  return {
    model,
    ...groups,
    filterRows,
    content: [...available.filter((filter) => !claimed.has(filter.id)), ...groups.content],
    readOnly,
    note,
  };
}
