import type { MapViewport } from '../../widgets/src/components/map-chart/options';
import type { DimensionValuesSnapshot, FilterValue } from '../../runtime/src';

export interface RegionMapViewportRequest {
  level: 'region-dept' | 'office';
  value: string;
  basemap: 'china' | 'world';
}

export interface RegionMapAdapter {
  resolveViewport(
    request: RegionMapViewportRequest,
    options: { signal: AbortSignal }
  ): Promise<MapViewport | undefined>;
}

export type { MapViewport };

export const REGION_MAP_CONTEXT = Symbol('region-map');
export interface RegionMapContext {
  adapter(): RegionMapAdapter | undefined;
  selection(): Pick<RegionMapViewportRequest, 'level' | 'value'> | undefined;
}

export function regionMapSelection(value: FilterValue | undefined) {
  if (value?.type !== 'dimension' || value.values.length !== 1) return;
  const { level } = value;
  const [selected] = value.values;
  if ((level === 'region-dept' || level === 'office') && selected && selected !== '全球') {
    return { level, value: selected } as const;
  }
}

export function regionMapCandidate(
  snapshot: DimensionValuesSnapshot,
  level: 'region-dept' | 'office',
  value: unknown,
  parent?: { value: unknown }
) {
  if (snapshot.status !== 'ready' || typeof value !== 'string') return;
  const node = snapshot.candidates.find(candidate =>
    candidate.level === level && candidate.value === value && !candidate.disabled
  );
  if (!node || (parent && (typeof parent.value !== 'string' || node.parent?.value !== parent.value))) return;
  return node;
}

export async function resolveRegionMapViewport(
  adapter: RegionMapAdapter,
  request: RegionMapViewportRequest,
  signal: AbortSignal
): Promise<MapViewport | undefined> {
  const viewport = await adapter.resolveViewport(request, { signal });
  if (!viewport || !Array.isArray(viewport.center) || viewport.center.length !== 2) return;
  const [longitude, latitude] = viewport.center;
  if (!Number.isFinite(longitude) || Math.abs(longitude) > 180 ||
      !Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
      !Number.isFinite(viewport.zoom) || viewport.zoom <= 0) return;
  return { center: [longitude, latitude], zoom: viewport.zoom };
}
