import { expect, test } from 'vitest';
import { barOption } from '../src/components/bar-chart/options';
import type { MainDataSlots } from '../src/shared/component-data';

test('horizontal formatted ticks avoid overlap and edge clipping without dropping result rows', () => {
  const data: MainDataSlots = { main: {
    fields: { name: { type: 'string', role: 'dimension' }, amount: { type: 'number', role: 'measure', defaultFormat: 'compact-million-1' } },
    snapshot: { status: 'ready', rows: [{ name: '甲', amount: 3670255713 }, { name: '乙', amount: 2989715307 }] }
  } };
  const option = barOption(data, { categoryField: 'name', series: [{ field: 'amount' }], horizontal: true });
  expect(option.xAxis).toMatchObject({ axisLabel: { hideOverlap: true, alignMinLabel: 'left', alignMaxLabel: 'right', formatter: expect.any(Function) } });
  expect(option.series).toMatchObject([{ data: [3670255713, 2989715307] }]);
  expect(option.yAxis).toMatchObject({ data: ['甲', '乙'] });
});
