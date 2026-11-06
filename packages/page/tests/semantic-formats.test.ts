import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { validate } from '../src/validate';
import { versionPolicy } from '../src/version';
const fixture = JSON.parse(readFileSync(new URL('../../../pages/capabilities/data/semantic-numeric-display.json', import.meta.url), 'utf8'));
it('declares semantic formatting through existing format fields and rejects older capability versions', () => {
  expect(fixture.schemaVersion).toBe(versionPolicy.current);
  expect(validate(fixture)).toEqual([]);
  const old = { ...fixture, schemaVersion: '6.85' };
  expect(validate(old).some(error => error.message.includes(versionPolicy.current))).toBe(true);
  expect(validate({ ...fixture, schemaVersion: '5.4' }).length).toBeGreaterThan(0);
});
