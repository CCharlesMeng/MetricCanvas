import type { RuntimeDataGateway, withOperationMapRegion } from '@metriccanvas/engine';
import type { RegionMapAdapter, RegionMapViewportRequest } from '@metriccanvas/engine/ui';

export function createRegionMapFixture(
  installRegion: typeof withOperationMapRegion,
  options?: { focus?: boolean; delay?: number }
): {
  dataGateway: RuntimeDataGateway;
  regionMap: RegionMapAdapter;
  queries: Array<Parameters<RuntimeDataGateway['fetchData']>[0]['filterValues']>;
  viewRequests: Array<RegionMapViewportRequest & { aborted: boolean }>;
};
