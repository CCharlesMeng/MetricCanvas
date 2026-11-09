import { expect, it } from 'vitest';
import document from '../../../pages/capabilities/table/table-time-format.json';
import { parsePage } from '../src/validate';

it('accepts time patterns, rejects malformed declarations and gates the new format by version', () => {
  expect(parsePage(document).ok).toBe(true);
  for (const format of [
    { type: 'time', pattern: '' }, { type: 'time', pattern: 'yyyy-MM-dd' },
    { type: 'time', pattern: 'YYYY-MM-DD', timeZone: 'UTC' }, { type: 'other', pattern: 'YYYY' }
  ]) {
    const raw = structuredClone(document);
    Object.assign(raw.sections[0].components[0].props.columns[1], { field: { data: 'main', field: 'createdAt', format } });
    expect(parsePage(raw)).toMatchObject({ ok: false });
  }
  const old = structuredClone(document);
  old.schemaVersion = '6.101';
  const rejected = parsePage(old);
  expect(rejected).toMatchObject({ ok: false });
  if (!rejected.ok) expect(rejected.errors.some(error => error.path.includes('/columns/1/field/format'))).toBe(true);
  Object.assign(old.sections[0].components[0].props, { columns: [{ title: 'legacy', field: { data: 'main', field: 'createdAt', format: 'date' } }] });
  expect(parsePage(old).ok).toBe(true);
});
