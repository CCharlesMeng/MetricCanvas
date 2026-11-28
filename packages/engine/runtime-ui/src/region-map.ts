import {
  type IocOrganizationLevel,
  isIocGlobalRegionValue,
  isIocOrganizationLevel,
  type MapGeography,
} from '@metriccanvas/page/internal';
import {
  type GeographyInput,
  organizationEntries,
  type RegionMapDisplayNames,
} from '../../widgets/src/components/map-chart/geography';

export type { MapGeography } from '@metriccanvas/page/internal';
export type { RegionMapDisplayNames } from '../../widgets/src/components/map-chart/geography';

import type { DimensionValuesSnapshot, FilterValue } from '../../runtime/src';
import type { MapViewport } from '../../widgets/src/components/map-chart/options';

export interface RegionMapViewportRequest {
  level: IocOrganizationLevel;
  value: string;
  basemap: 'china' | 'world';
}

export interface RegionMapAdapter {
  geography?: MapGeography;
  displayNames?: RegionMapDisplayNames;
  resolveViewport?(
    request: RegionMapViewportRequest,
    options: { signal: AbortSignal },
  ): Promise<MapViewport | undefined>;
}

export function hasRegionMapRouting(adapter: RegionMapAdapter | undefined): boolean {
  // A mount that supplies only display names keeps its existing Region selection path.
  return (
    !!adapter &&
    (adapter.displayNames === undefined || !!adapter.geography || !!adapter.resolveViewport)
  );
}

export type { MapViewport };

export const REGION_MAP_CONTEXT = Symbol('region-map');
export interface RegionMapContext {
  frozenViewport?(key: string): MapViewport | undefined;
  overrides(): MapGeography | undefined;
  capture?(key: string, read: () => MapViewport | undefined): () => void;
  adapter(): RegionMapAdapter | undefined;
  selection(): Pick<RegionMapViewportRequest, 'level' | 'value'> | undefined;
}

export function regionMapSelection(value: FilterValue | undefined) {
  if (value?.type !== 'dimension' || value.values.length !== 1) return;
  const { level } = value;
  const [selected] = value.values;
  if (isIocOrganizationLevel(level) && selected && !isIocGlobalRegionValue(selected)) {
    return { level, value: selected } as const;
  }
}

export function regionMapCandidate(
  snapshot: DimensionValuesSnapshot,
  level: IocOrganizationLevel,
  value: unknown,
  parent?: { value: unknown },
) {
  if (snapshot.status !== 'ready' || typeof value !== 'string') return;
  const node = snapshot.candidates.find(
    (candidate) => candidate.level === level && candidate.value === value && !candidate.disabled,
  );
  if (
    !node ||
    (parent && (typeof parent.value !== 'string' || node.parent?.value !== parent.value))
  )
    return;
  return node;
}

export async function resolveRegionMapViewport(
  adapter: RegionMapAdapter,
  request: RegionMapViewportRequest,
  signal: AbortSignal,
): Promise<MapViewport | undefined> {
  const viewport = await adapter.resolveViewport?.(request, { signal });
  if (!viewport || !Array.isArray(viewport.center) || viewport.center.length !== 2) return;
  const [longitude, latitude] = viewport.center;
  if (
    !Number.isFinite(longitude) ||
    Math.abs(longitude) > 180 ||
    !Number.isFinite(latitude) ||
    Math.abs(latitude) > 90 ||
    !Number.isFinite(viewport.zoom) ||
    viewport.zoom <= 0
  )
    return;
  return { center: [longitude, latitude], zoom: viewport.zoom };
}

export function selectedViewport(
  input: GeographyInput,
  request: RegionMapViewportRequest,
  dynamic?: MapViewport,
): MapViewport | undefined {
  const { host, page } = organizationEntries(input, request.basemap, request.level, request.value);
  const merged = { ...dynamic, ...host?.viewport, ...page?.viewport };
  if (merged.center && merged.zoom) return { center: merged.center, zoom: merged.zoom };
}

export function viewportKey(basemap: string, level?: string, value?: string) {
  return JSON.stringify([basemap, level, value]);
}
