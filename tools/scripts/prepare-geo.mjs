/**
 * geojson 底图资产制备脚本(一次性,产物入库;资产更新时重跑):
 * 原始数据 → 精简后写入 packages/widgets/src/maps/。
 *
 * 原始数据来源与许可(选 Natural Earth 的理由:公有领域,无许可风险;
 * 此前用过的 DataV 边界数据无开放许可承诺、johan/world.geo.json 无 LICENSE,均弃用):
 * - 世界国家:Natural Earth 1:110m admin-0 countries(公有领域,https://www.naturalearthdata.com/about/terms-of-use/)
 *   https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson
 * - 中国省级:Natural Earth 1:50m admin-1 states/provinces 的中国子集(同为公有领域),
 *   区域名取 name_zh(如 上海市/广东省)
 *   https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_1_states_provinces.geojson
 *
 * 已知边界口径风险:Natural Earth 按其自身口径绘制边界(如台湾在 admin-0 中单列、
 * 中国省级子集不含港澳台),与中国官方地图表述有差异;当前用于开发演示的 visualMap
 * 着色精度足够,正式对外发布前需替换为具审图号的合规数据源。
 *
 * 精简策略:
 * - 坐标四舍五入到 2 位小数(约 1km 精度,看板着色用途足够),去除舍入后的连续重复点;
 * - properties 只保留 name 与 cp(区域中心点,散点叠加的坐标来源):
 *   中国取 NE 的 longitude/latitude 标注点,世界取 LABEL_X/LABEL_Y,缺失时按最大环形心计算。
 *
 * 用法:node tools/scripts/prepare-geo.mjs <ne_50m_admin_1.geojson> <ne_110m_admin_0.geojson>
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '../../packages/widgets/src/maps');
const [admin1Raw, countriesRaw] = process.argv.slice(2);
if (!admin1Raw || !countriesRaw) {
  console.error('用法:node tools/scripts/prepare-geo.mjs <ne_50m_admin_1.geojson> <ne_110m_admin_0.geojson>');
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

/** 最大环的形心(shoelace):标注点缺失时的兜底 */
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

function slim(features, pickName, pickCp) {
  return {
    type: 'FeatureCollection',
    features: features.map((feature) => {
      const cp = pickCp(feature) ?? centroid(feature.geometry);
      return {
        type: 'Feature',
        properties: { name: pickName(feature) ?? '', ...(cp ? { cp } : {}) },
        geometry: { type: feature.geometry.type, coordinates: slimCoords(feature.geometry.coordinates) }
      };
    })
  };
}

const labelPoint = (lng, lat) =>
  typeof lng === 'number' && typeof lat === 'number' ? [round(lng), round(lat)] : null;

mkdirSync(outDir, { recursive: true });

const admin1 = JSON.parse(readFileSync(admin1Raw, 'utf8'));
const china = slim(
  admin1.features.filter((feature) => feature.properties.admin === 'China'),
  (feature) => feature.properties.name_zh || feature.properties.name,
  (feature) => labelPoint(feature.properties.longitude, feature.properties.latitude)
);
writeFileSync(join(outDir, 'china.json'), JSON.stringify(china));

const countries = JSON.parse(readFileSync(countriesRaw, 'utf8'));
const world = slim(
  countries.features,
  (feature) => feature.properties.NAME ?? feature.properties.name,
  (feature) =>
    labelPoint(
      feature.properties.LABEL_X ?? feature.properties.label_x,
      feature.properties.LABEL_Y ?? feature.properties.label_y
    )
);
writeFileSync(join(outDir, 'world.json'), JSON.stringify(world));

for (const name of ['china.json', 'world.json']) {
  const size = readFileSync(join(outDir, name)).length;
  console.log(`${name}: ${(size / 1024).toFixed(0)}KB`);
}
