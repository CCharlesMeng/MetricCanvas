import {readFileSync} from 'node:fs';
import {expect, it} from 'vitest';
import {parsePage} from '@metriccanvas/page/internal';
import {compositeFilterToolbar} from '../src/dashboard/filter-toolbar';

it('projects the actual page to left buttons and two right selectors without consuming chart content', () => {
  const parsed = parsePage(JSON.parse(readFileSync('pages/capabilities/filters/filter-group-parallel-selects.json','utf8')));
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  const card = parsed.page.sections[0]!.components[0]!;
  if (card.type !== 'compositeCard') throw new Error('Expected the chart card');
  expect(compositeFilterToolbar(card)).toEqual({left:[0],right:[1,2],count:3});
  expect(card.props.components[3]!.type).toBe('lineChart');
  expect(compositeFilterToolbar({...card,props:{...card.props,filterLayout:undefined}}))
    .toEqual({left:[],right:[],count:0});
});
