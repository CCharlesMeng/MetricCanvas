import {readFileSync} from 'node:fs';
import {expect, it} from 'vitest';
import {parsePage} from '../src/validate';

it('accepts the real toolbar page and rejects its declaration before the capability version', () => {
  const page = JSON.parse(readFileSync('pages/capabilities/filters/filter-group-parallel-selects.json','utf8'));
  expect(parsePage(page).ok).toBe(true);
  expect(parsePage({...page,schemaVersion:'6.62'}).ok).toBe(false);
  page.sections[0].components[0].props.filterLayout = 'implicit';
  expect(parsePage(page).ok).toBe(false);
});
