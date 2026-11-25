import type { RuntimeDataGateway, withOperationMapRegion } from '@metriccanvas/engine';
import type { RegionMapAdapter, RegionMapViewportRequest } from '@metriccanvas/engine/ui';

export function createRegionMapFixture(
  installRegion: typeof withOperationMapRegion,
  options?: { focus?: boolean; delay?: number; initialSearch?: string; baseGateway?: RuntimeDataGateway }
): {
  displayInputs: import('@metriccanvas/engine').DisplayInputs;
  setSelection(search:string,revision?:number):void;
  dataGateway: RuntimeDataGateway;
  regionMap: RegionMapAdapter;
  queries: Array<Parameters<RuntimeDataGateway['fetchData']>[0]['filterValues']>;
  viewRequests: Array<RegionMapViewportRequest & { aborted: boolean }>;
};
