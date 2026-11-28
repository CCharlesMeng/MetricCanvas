import { hasLegacyDefaultHeader, iocHeaderDeclaration } from '../header-binding';
import { supportsNativePreparation } from '../native-preparation-capability';
import type { DashboardToolbar, Page, PageLayoutForm } from '../page-types';
import type { IocHeaderDeclaration } from '../schema/ioc-header';
import { legacyTableCandidateSearch } from '../table/candidate-search';
import {
  supportsIndependentExclusionCandidates,
  supportsUnrestrictedFilterClear,
} from '../version';

export type DashboardToolbarMode = 'visible' | 'hidden' | 'compact';

export interface DashboardHeaderConfig {
  /** Normalized `iocHeader` declaration when present (component or legacy root). */
  iocHeader?: IocHeaderDeclaration;
  /** Whether a legacy dashboard toolbar should be projected as an IocHeader. */
  legacyDashboardHeader: boolean;
  /** Compact density for legacy `{ variant: 'compact' }` dashboardToolbar. */
  compact: boolean;
  /** Effective page-level readOnly flag (from iocHeader or legacy dashboardToolbar). */
  readOnly: boolean;
  /** Effective page-level note (from iocHeader or legacy dashboardToolbar). */
  note?: string;
  /** Effective toolbar visibility/variant mode for host layout attributes (`data-dashboard-toolbar`). */
  toolbarMode: DashboardToolbarMode;
}

export interface PageRuntimeCompatibility {
  layout: PageLayoutForm;
  legacyReportHeaderPeriod: boolean;
  legacyCandidateSearch: boolean;
  unrestrictedFilterClear: boolean;
  independentExclusionCandidates: boolean;
  nativePreparation: boolean;
  legacyDefaultHeader: boolean;
  dashboardToolbarMode: DashboardToolbarMode;
  dashboardHeader: DashboardHeaderConfig;
}

type LegacyToolbarObject = Extract<DashboardToolbar, Record<string, unknown>>;

function legacyToolbarObject(
  toolbar: DashboardToolbar | undefined,
): LegacyToolbarObject | undefined {
  return typeof toolbar === 'object' && toolbar !== null ? toolbar : undefined;
}

function resolveToolbarMode(
  toolbar: DashboardToolbar | undefined,
  hasIocHeader: boolean,
  legacyDashboardHeader: boolean,
): DashboardToolbarMode {
  if (hasIocHeader) return 'hidden';
  if (toolbar === undefined) return legacyDashboardHeader ? 'visible' : 'hidden';
  return typeof toolbar === 'string' ? toolbar : toolbar.variant;
}

/**
 * 6.13 / 6.14 `reportHeader` implicit date period text compatibility;
 * `6.15+` uses explicit text references and `5.x` has no reportHeader filterIds.
 */
export function usesLegacyReportHeaderPeriod(schemaVersion: string | undefined): boolean {
  return schemaVersion === '6.13' || schemaVersion === '6.14';
}

/**
 * Consolidates `iocHeader`, legacy `dashboardToolbar`, `readOnly`, `note`,
 * and pre-6.81 implicit dashboard header rules at the entry ACL boundary.
 */
export function resolveDashboardHeaderConfig(page: Page): DashboardHeaderConfig {
  const iocHeader = iocHeaderDeclaration(page);
  const toolbar = page.dashboardToolbar;
  const toolbarObj = legacyToolbarObject(toolbar);
  const layout: PageLayoutForm = page.layout ?? 'report';
  const legacyDashboardHeader =
    !iocHeader &&
    layout === 'dashboard' &&
    toolbar !== 'hidden' &&
    (toolbar !== undefined || hasLegacyDefaultHeader(page));
  const compact = legacyDashboardHeader && toolbarObj?.variant === 'compact';
  const readOnly = iocHeader?.readOnly === true || toolbarObj?.readOnly === true;
  const note = iocHeader?.note ?? toolbarObj?.note;
  const toolbarMode = resolveToolbarMode(toolbar, iocHeader !== undefined, legacyDashboardHeader);
  return {
    ...(iocHeader ? { iocHeader } : {}),
    legacyDashboardHeader,
    compact,
    readOnly,
    ...(note !== undefined ? { note } : {}),
    toolbarMode,
  };
}

/**
 * Computes the runtime compatibility profile once at the page entry boundary
 * so runtime and UI consumers never branch directly on `schemaVersion` or
 * legacy `dashboardToolbar` fields.
 */
export function resolvePageCompatibility(page: Page): PageRuntimeCompatibility {
  const dashboardHeader = resolveDashboardHeaderConfig(page);
  return {
    layout: page.layout ?? 'report',
    legacyReportHeaderPeriod: usesLegacyReportHeaderPeriod(page.schemaVersion),
    legacyCandidateSearch: legacyTableCandidateSearch(page.schemaVersion),
    unrestrictedFilterClear: supportsUnrestrictedFilterClear(page.schemaVersion),
    independentExclusionCandidates: supportsIndependentExclusionCandidates(page.schemaVersion),
    nativePreparation: supportsNativePreparation(page),
    legacyDefaultHeader: hasLegacyDefaultHeader(page),
    dashboardToolbarMode: dashboardHeader.toolbarMode,
    dashboardHeader,
  };
}
