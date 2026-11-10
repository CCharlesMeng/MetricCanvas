import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { referenceProjection } from '../tools/scripts/local-authoring-projection';
import { parsePage } from '../packages/page/src/validate';

it.each(['dynamic','static','current'])('preserves candidate search when projecting %s examples with a legacy toolbar', kind => {
  const document = JSON.parse(readFileSync('pages/capabilities/table/table-header-filter-search.json','utf8'));
  const index = kind === 'static' ? 0 : 3;
  document.schemaVersion = kind === 'current' ? '6.112' : '6.111';
  document.dashboardToolbar = 'hidden';
  document.sections[0].components = [document.sections[0].components[index]];
  delete document.sections[0].components[0].props.columns[1].filterable.showSearch;
  const raw = JSON.stringify(document), file = 'page/reference/examples/legacy-search.json';
  const inputs = new Map([[file,raw]]);
  const result = JSON.parse(referenceProjection(inputs).get('examples/legacy-search.json')!);
  expect(parsePage(result).ok).toBe(true);
  expect(result.sections[0].components[0].props.columns[1].filterable.showSearch).toBe(kind === 'dynamic' ? true : undefined);
  expect(document).toEqual(JSON.parse(raw));
  expect(inputs.get(file)).toBe(raw);
});
