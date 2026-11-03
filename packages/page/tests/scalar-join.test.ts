import {readFileSync} from 'node:fs';
import {expect, it} from 'vitest';
import {validate} from '../src/validate';
const fixture = () => JSON.parse(readFileSync(new URL('../../../pages/capabilities/chart/chart-global-benchmark.json',import.meta.url),'utf8'));

it('accepts an explicit scalar dependency and requires 6.83', () => {
  const page=fixture();
  expect(validate(page)).toEqual([]);
  page.schemaVersion='6.82';
  expect(validate(page)).toContainEqual(expect.objectContaining({path:'/dataSources/offices',message:expect.stringContaining('6.83')}));
});

it('rejects summation, unknown dependencies, incompatible units and paged scalar inputs', () => {
  const page=fixture();
  page.dataSources.offices.compute[0].values[0].aggregate='sum';
  expect(validate(page).some(error=>error.message.includes('仅允许 unique'))).toBe(true);
  page.dataSources.offices.compute[0].values[0].aggregate='unique';
  page.dataSources.benchmark.fields.average.unit='P';
  expect(validate(page).some(error=>error.message.includes('单位'))).toBe(true);
  page.dataSources.benchmark.fields.average.unit='%';
  page.dataSources.benchmark.source.query.body.dsl_list[0].order={limit:1};
  expect(validate(page).some(error=>error.message.includes('完整行集'))).toBe(true);
  page.dataSources.offices.compute[0].source='missing';
  expect(validate(page).some(error=>error.message.includes('未知数据依赖'))).toBe(true);
});
