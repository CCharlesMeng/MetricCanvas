import * as echarts from 'echarts';

/**
 * 底图注册(包内私有):geojson 静态资产随包入库(src/maps/,由
 * tools/scripts/prepare-geo.mjs 制备),无运行时网络依赖。
 * 动态 import 使底图独立分包、渲染到地图组件时才加载;同名底图只注册一次。
 */
export type BasemapName = 'china' | 'world';

export interface BasemapMeta {
  /** 区域名 → 区域中心点经纬度(取自资产的 properties.cp),散点叠加的坐标来源 */
  centers: ReadonlyMap<string, [number, number]>;
}

interface GeoFeature {
  properties: { name: string; cp?: [number, number] };
}

const registered = new Map<BasemapName, Promise<BasemapMeta>>();

export function ensureBasemap(name: BasemapName): Promise<BasemapMeta> {
  let promise = registered.get(name);
  if (!promise) {
    promise = load(name);
    registered.set(name, promise);
  }
  return promise;
}

async function load(name: BasemapName): Promise<BasemapMeta> {
  // 两个 import 写成字面量而非模板串:vite 静态分析各自成 chunk。
  // 资产结构由制备脚本保证({name, cp?}),经 unknown 收窄而非携带巨型 JSON 推断类型
  const geoJson = (
    name === 'china'
      ? (await import('./maps/china.json')).default
      : (await import('./maps/world.json')).default
  ) as unknown;
  echarts.registerMap(name, geoJson as Parameters<typeof echarts.registerMap>[1]);

  const centers = new Map<string, [number, number]>();
  for (const feature of (geoJson as { features: GeoFeature[] }).features) {
    if (feature.properties.name && feature.properties.cp) {
      centers.set(feature.properties.name, feature.properties.cp);
    }
  }
  return { centers };
}
