import { expect, it } from 'vitest';
import { createFilterState, initialFilterValues } from '../src/filter-state';
import type { FilterDeclaration } from '@metriccanvas/page/internal';

it('keeps closed single-choice values independent through writes and URL restoration', () => {
  const declarations: FilterDeclaration[] = ['one', 'two'].map(id => ({id,type:'dimension',dimension:'region',default:['CN']}));
  const options = new Map([['one', ['CN', 'OVERSEAS']], ['two', ['CN', 'OVERSEAS']]]);
  const state = createFilterState(initialFilterValues(declarations), declarations, options);
  const current = () => { let values: any; const stop = state.subscribe(value => values = value); stop(); return values; };
  state.write('one', {type:'dimension',dimension:'region',values:['OVERSEAS']});
  expect(current().get('one').values).toEqual(['OVERSEAS']);
  expect(current().get('two').values).toEqual(['CN']);
  for (const values of [[], ['CN', 'OVERSEAS'], ['unknown']]) state.write('one', {type:'dimension',dimension:'region',values});
  state.write('one', null);
  state.writeMany([['one', {type:'dimension',dimension:'region',values:['unknown']}]]);
  expect(current().get('one').values).toEqual(['OVERSEAS']);
  state.fromURL('one=unknown&two=OVERSEAS', declarations);
  expect(current().get('one').values).toEqual(['OVERSEAS']);
  expect(current().get('two').values).toEqual(['OVERSEAS']);
});
