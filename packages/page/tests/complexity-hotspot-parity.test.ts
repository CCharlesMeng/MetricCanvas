import { describe, expect, it } from 'vitest';
import { rowExpansionErrors } from '../src/table/validate-expansion';
import { presentationPolicyErrors } from '../src/presentation-policy';
import { validate } from '../src/validate';
import { hotspotCases } from './fixtures/complexity-hotspot-cases';
import expected from './fixtures/complexity-hotspot-errors.json';

describe('complexity hotspot refactor preserves complete ordered diagnostics and inputs', () => {
  it.each(Object.entries(hotspotCases()))('%s', (name, page) => {
    const original = structuredClone(page);
    const result = { expansion: rowExpansionErrors(page, validate), policy: presentationPolicyErrors(page) };
    expect(JSON.parse(JSON.stringify(result))).toEqual(expected[name as keyof typeof expected]);
    expect(page).toEqual(original);
  });
});
