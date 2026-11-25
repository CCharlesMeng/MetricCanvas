import { fieldName, type MapChartProps } from '@metriccanvas/page/internal';
import { organizationBinding, organizationEntries, resolvePlacement, type GeographyInput, type OrganizationLevel, type mapRows } from './geography';
import type { MapViewport } from './options';

type Point = [number, number];
export type Bounds = [Point, Point];
export type MapFocus = MapViewport | { boundingCoords: Bounds };
export type OrganizationSelection = { level: OrganizationLevel; value: string };

function include(bounds: Bounds, [x, y]: Point) {
  bounds[0][0] = Math.min(bounds[0][0], x);
  bounds[0][1] = Math.min(bounds[0][1], y);
  bounds[1][0] = Math.max(bounds[1][0], x);
  bounds[1][1] = Math.max(bounds[1][1], y);
}

function emptyBounds(): Bounds {
  return [[Infinity, Infinity], [-Infinity, -Infinity]];
}

export function polygonBounds(polygons: Point[][][]): Bounds {
  const bounds = emptyBounds();
  for (const polygon of polygons) {
    for (const point of polygon[0]) include(bounds, point);
  }
  return bounds;
}

function fit(bounds: Bounds): MapFocus | undefined {
  const [[west, south], [east, north]] = bounds;
  if (!Number.isFinite(west)) return;
  const width = east - west;
  const height = north - south;
  if (!width && !height) return { center: [west, south], zoom: 4 };
  // ECharts fits the padded geographic rectangle to the actual chart or its safe area.
  const padX = Math.max(width, height * 0.1) * 0.12;
  const padY = Math.max(height, width * 0.1) * 0.12;
  return { boundingCoords: [[west - padX, south - padY], [east + padX, north + padY]] };
}

interface FocusMap {
  centers: ReadonlyMap<string, Point>;
  bounds: ReadonlyMap<string, Bounds>;
}

function childExtent(parentField: string, parent: string, locations: ReturnType<typeof mapRows>, map: FocusMap) {
  const bounds = emptyBounds();
  for (const [row, placement] of locations.placements) {
    if (row[parentField] !== parent) continue;
    const point = placement.point;
    const coordinates = 'lngLat' in point ? point.lngLat : map.centers.get(point.feature);
    if (coordinates) include(bounds, coordinates);
  }
  return fit(bounds);
}

function selectedPlacement(
  props: MapChartProps, selection: OrganizationSelection, geography: GeographyInput, locations: ReturnType<typeof mapRows>
) {
  const binding = organizationBinding(props);
  if (binding?.level === selection.level) {
    for (const [row, placement] of locations.placements) {
      if (row[binding.field] === selection.value) return placement;
    }
  }
  const { host, page } = organizationEntries(geography, props.map, selection.level, selection.value);
  return resolvePlacement(host, page, props.nameMap?.[selection.value], selection.value);
}

export function automaticMapFocus(
  props: MapChartProps, selection: OrganizationSelection, geography: GeographyInput,
  locations: ReturnType<typeof mapRows>, map: FocusMap
): MapFocus | undefined {
  const { level, value } = selection;
  const placement = selectedPlacement(props, selection, geography, locations);
  const bounds = emptyBounds();
  for (const feature of placement.features) {
    const area = map.bounds.get(feature);
    if (area) { include(bounds, area[0]); include(bounds, area[1]); }
  }
  if (Number.isFinite(bounds[0][0])) {
    if ('lngLat' in placement.point) include(bounds, placement.point.lngLat);
    return fit(bounds);
  }
  if (level === 'region-dept' && props.parentField) {
    const children = childExtent(fieldName(props.parentField), value, locations, map);
    if (children) return children;
  }
  const point = placement.point;
  if ('feature' in point) {
    const area = map.bounds.get(point.feature);
    if (area) return fit(area);
  }
  const center = 'lngLat' in point ? point.lngLat : map.centers.get(point.feature);
  if (center) return { center, zoom: 4 };
}
