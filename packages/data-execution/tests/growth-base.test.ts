import { expect, it } from 'vitest';
import { applyComputation } from '../src/compute';

it('relative change rejects a nonpositive or missing base without changing general division', () => {
  const rows = [{ current: 10, base: 0 }, { current: 10, base: null }, { current: 10, base: -10 }, { current: 20, base: 10 }];
  const original = structuredClone(rows);
  expect(applyComputation([
    { op: 'delta', minuend: 'current', subtrahend: 'base', output: 'change' },
    { op: 'ratio', numerator: 'change', denominator: 'base', output: 'growth', scale: 100, onZeroDenominator: 'zero' }
  ], rows).map(row => row.growth)).toEqual([null, null, null, 100]);
  expect(applyComputation([{ op: 'ratio', numerator: 'current', denominator: 'base', output: 'ratio', scale: 100, onZeroDenominator: 'zero' }], rows).map(row => row.ratio)).toEqual([0, 0, -100, 200]);
  expect(rows).toEqual(original);
});
