import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { parsePage } from '../src/validate';
const fixture = () => JSON.parse(readFileSync(new URL('../../../pages/table-row-number.json', import.meta.url), 'utf8'));
it('supports a presentation-only row number without a result field', () => {
  expect(parsePage(fixture()).ok).toBe(true);
});
it.each(['6.47', '5.4'])('rejects row numbers before introduction: %s', version => {
  const document = fixture(); document.schemaVersion = version;
  expect(parsePage(document).ok).toBe(false);
});
it.each([true, {width:0}, {width:1.5}, {fixed:'right'}, {field:'name'}, {sortable:true}])('rejects invalid row-number declarations %j', value => {
  const document = fixture(); document.sections[0].components[0].props.rowNumber = value;
  expect(parsePage(document).ok).toBe(false);
});
