import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { validate } from '../src/validate';
import { pageCapabilities } from '../src/version';
const fixture = JSON.parse(readFileSync(new URL('../../../pages/capabilities/data/semantic-numeric-display.json', import.meta.url), 'utf8'));
it('declares semantic formatting through existing format fields and rejects older capability versions', () => {
  const introduced = `6.${pageCapabilities['semantic-numeric-formats'].minor}`;
  expect(fixture.schemaVersion).toBe(introduced);
  expect(validate(fixture)).toEqual([]);
  const old = { ...fixture, schemaVersion: '6.85' };
  expect(validate(old).some(error => error.message.includes(introduced))).toBe(true);
  expect(validate({ ...fixture, schemaVersion: '5.4' }).length).toBeGreaterThan(0);
});
