import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { measureSource } from './measure-ts-complexity.mjs';

test('measures closures and returned methods separately from factory setup', () => {
  const { functions } = measureSource('factory.ts', `
    function factory() {
      const normalize = (value: unknown) => value ? 1 : 0;
      return { save(ok: boolean) { if (ok) return normalize(ok); } };
    }
  `);
  assert.deepEqual(functions.map(f => [f.name, f.selfCC, f.subtreeCC, f.nestedFunctions]), [
    ['factory', 1, 3, 2], ['normalize', 2, 2, 0], ['save', 2, 2, 0],
  ]);
  assert.equal(functions[2].qualifiedName, 'factory/save');
});

test('counts runtime defaults and logical expressions, excluding conditional types and optional access', () => {
  const { functions } = measureSource('typed.ts', `
    type Result<T> = T extends true ? 'yes' : 'no';
    function read<T>(input?: { value?: number }, fallback = flag ? 1 : 2): Result<T> {
      return (input?.value ?? fallback) && (left || right) ? 'yes' : 'no';
    }
  `);
  assert.equal(functions.length, 1);
  assert.equal(functions[0].selfCC, 6);
  assert.equal(functions[0].optionalChains, 1);
});

test('counts loops, cases, catches and logical assignment; default and finally add no branch', () => {
  const { functions } = measureSource('control.ts', `
    function run(values: number[]) {
      for (const value of values) { if (value) continue; }
      while (ready) { ready &&= more; }
      try { switch (mode) { case 1: break; case 2: break; default: break; } }
      catch { recover(); } finally { close(); }
    }
  `);
  assert.equal(functions[0].selfCC, 8);
});

test('includes constructors, accessors, generators and anonymous callbacks', () => {
  const { functions } = measureSource('methods.ts', `
    class Store {
      constructor(value: boolean) { if (value) open(); }
      get state() { return ready ? 1 : 0; }
      *read() { for (const row of rows) yield row; }
    }
    const result = rows.map(row => row ? 1 : 0);
  `);
  assert.deepEqual(functions.map(f => f.selfCC), [2, 2, 2, 2]);
  assert.match(functions[3].name, /^<anonymous@/);
});

test('rejects parse errors instead of reporting a misleading successful measurement', () => {
  assert.throws(() => measureSource('broken.ts', 'function broken( {'), /broken.ts:/);
});
