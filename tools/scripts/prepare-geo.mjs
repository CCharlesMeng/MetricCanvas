/**
 * geojson 底图资产制备脚本(一次性,产物入库;资产更新时重跑):
 * 原始数据 → 精简后写入 packages/widgets/src/maps/。
 *
 * 原始数据来源:
 * - 中国省级:阿里云 DataV https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json
 * - 世界国家:https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json
 *
 * 精简策略(体积:中国 582KB→约 55%,世界 257KB→约 70%):
 * - 坐标四舍五入到 2 位小数(约 1km 精度,看板着色用途足够),去除舍入后的连续重复点;
 * - properties 只保留 name 与 cp(区域中心点,散点叠加的坐标来源):
 *   中国取 DataV 的 center(省会坐标),世界按最大环的形心计算。
 *
 * 用法:node tools/scripts/prepare-geo.mjs <china-raw.json> <world-raw.json>
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '../../packages/widgets/src/maps');
const [chinaRaw, worldRaw] = process.argv.slice(2);
if (!chinaRaw || !worldRaw) {
  console.error('用法:node tools/scripts/prepare-geo.mjs <china-raw.json> <world-raw.json>');
  process.exit(2);
}

const round = (n) => Math.round(n * 100) / 100;

/** 递归舍入坐标并去除舍入后的连续重复点(环闭合点保留) */
function slimCoords(coords) {
  if (typeof coords[0] === 'number') return coords.map(round);
  const slimmed = coords.map(slimCoords);
  if (typeof slimmed[0]?.[0] !== 'number') return slimmed;
  return slimmed.filter(
    (point, i) => i === 0 || point[0] !== slimmed[i - 1][0] || point[1] !== slimmed[i - 1][1]
  );
}

/** 最大环的形心(shoelace):世界国家无中心点供给,按几何计算 */
function centroid(geometry) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  let best = null;
  for (const polygon of polygons) {
    const ring = polygon[0];
    let area = 0;
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const cross = ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
      area += cross;
      cx += (ring[i][0] + ring[i + 1][0]) * cross;
      cy += (ring[i][1] + ring[i + 1][1]) * cross;
    }
    if (best === null || Math.abs(area) > Math.abs(best.area)) {
      best = { area, cx, cy };
    }
  }
  if (!best || best.area === 0) return null;
  return [round(best.cx / (3 * best.area)), round(best.cy / (3 * best.area))];
}

function slim(raw, pickCp) {
  return {
    type: 'FeatureCollection',
    features: raw.features.map((feature) => {
      const cp = pickCp(feature);
      return {
        type: 'Feature',
        properties: { name: feature.properties.name ?? '', ...(cp ? { cp } : {}) },
        geometry: { type: feature.geometry.type, coordinates: slimCoords(feature.geometry.coordinates) }
      };
    })
  };
}

mkdirSync(outDir, { recursive: true });

const china = slim(JSON.parse(readFileSync(chinaRaw, 'utf8')), (feature) => {
  const center = feature.properties.center;
  return Array.isArray(center) ? center.map(round) : null;
});
writeFileSync(join(outDir, 'china.json'), JSON.stringify(china));

const world = slim(JSON.parse(readFileSync(worldRaw, 'utf8')), (feature) => centroid(feature.geometry));
writeFileSync(join(outDir, 'world.json'), JSON.stringify(world));

for (const name of ['china.json', 'world.json']) {
  const size = readFileSync(join(outDir, name)).length;
  console.log(`${name}: ${(size / 1024).toFixed(0)}KB`);
}
