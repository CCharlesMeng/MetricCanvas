import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { geoRegionName } from '../../engine/widgets/src/components/map-chart/options';
const contract = JSON.parse(readFileSync('contracts/metriccanvas/page/map-regions.json','utf8'));
it.each(['china','world'])('%s地名来自实际底图且nameMap映射一致', name => {
  const map = contract.maps[name];
  const source = readFileSync(map.source.file,'utf8');
  const regions = [...new Set(JSON.parse(source).features.map((f: any)=>f.properties.name).filter((n: unknown)=>typeof n==='string' && n.length>0))].sort();
  expect(map.source.sha256).toBe(createHash('sha256').update(source).digest('hex'));
  expect(map.regions).toEqual(regions);
  expect(map.regions.length).toBeGreaterThan(0);
  expect(geoRegionName({region:'business-name'},'region',{'business-name':map.regions[0]})).toBe(map.regions[0]);
  expect(geoRegionName({region:map.regions[0]},'region')).toBe(map.regions[0]);
});
