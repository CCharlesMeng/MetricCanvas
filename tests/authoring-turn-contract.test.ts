import { expect, it } from 'vitest';
import vectors from '../metriccanvas-authoring/contracts/authored/authoring-turn.conformance.json';
import { validateAuthoringTurn } from '../metriccanvas-authoring/contracts/authored/authoring-turn-contract';

for (const vector of vectors.cases) it(`trusted authoring turn structure: ${vector.name}`, () => {
  expect(validateAuthoringTurn(vector.input)).toBe(vector.valid);
});

import bytes from '../metriccanvas-authoring/contracts/authored/authoring-turn.bytes.json';
import { canonicalizeJson } from '../packages/page/src/canonical-json';
import { createHash } from 'node:crypto';
for (const vector of bytes.cases) it(`trusted authoring snapshot bytes: ${vector.name}`, () => {
  expect(canonicalizeJson(vector.input)).toBe(vector.documentJson);
  expect(createHash('sha256').update(vector.documentJson, 'utf8').digest('hex')).toBe(vector.sha256);
});
