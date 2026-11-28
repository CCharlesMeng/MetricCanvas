import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { countLines, measureSource } from './measure-ts-complexity.mjs';

test('measures closures and returned methods separately from factory setup', () => {
  const { functions } = measureSource(
    'factory.ts',
    `
    function factory() {
      const normalize = (value: unknown) => value ? 1 : 0;
      return { save(ok: boolean) { if (ok) return normalize(ok); } };
    }
  `,
  );
  assert.deepEqual(
    functions.map((f) => [f.name, f.selfCC, f.subtreeCC, f.nestedFunctions]),
    [
      ['factory', 1, 3, 2],
      ['normalize', 2, 2, 0],
      ['save', 2, 2, 0],
    ],
  );
  assert.equal(functions[2].qualifiedName, 'factory/save');
});

test('counts runtime defaults and logical expressions, excluding conditional types and optional access', () => {
  const { functions } = measureSource(
    'typed.ts',
    `
    type Result<T> = T extends true ? 'yes' : 'no';
    function read<T>(input?: { value?: number }, fallback = flag ? 1 : 2): Result<T> {
      return (input?.value ?? fallback) && (left || right) ? 'yes' : 'no';
    }
  `,
  );
  assert.equal(functions.length, 1);
  assert.equal(functions[0].selfCC, 6);
  assert.equal(functions[0].optionalChains, 1);
});

test('counts loops, cases, catches and logical assignment; default and finally add no branch', () => {
  const { functions } = measureSource(
    'control.ts',
    `
    function run(values: number[]) {
      for (const value of values) { if (value) continue; }
      while (ready) { ready &&= more; }
      try { switch (mode) { case 1: break; case 2: break; default: break; } }
      catch { recover(); } finally { close(); }
    }
  `,
  );
  assert.equal(functions[0].selfCC, 8);
});

test('includes constructors, accessors, generators and anonymous callbacks', () => {
  const { functions } = measureSource(
    'methods.ts',
    `
    class Store {
      constructor(value: boolean) { if (value) open(); }
      get state() { return ready ? 1 : 0; }
      *read() { for (const row of rows) yield row; }
    }
    const result = rows.map(row => row ? 1 : 0);
  `,
  );
  assert.deepEqual(
    functions.map((f) => f.selfCC),
    [2, 2, 2, 2],
  );
  assert.match(functions[3].name, /^<anonymous@/);
});

test('rejects parse errors instead of reporting a misleading successful measurement', () => {
  assert.throws(() => measureSource('broken.ts', 'function broken( {'), /broken.ts:/);
});

test('detects nested-closure subtreeCC inflation even when outer and inner selfCC stay low', () => {
  const { functions } = measureSource(
    'factory-inflation.ts',
    `
    function createSession(state: number) {
      const a = (x: number) => (x > 1 && x < 10) || x === 20 || x === 30 || x === 40 || x === 50 || x === 60 || x === 70 || x === 80 || x === 90;
      const b = (x: number) => {
        const inner = (y: number) => (y > 1 && y < 10) || y === 20 || y === 30 || y === 40 || y === 50 || y === 60 || y === 70 || y === 80 || y === 90;
        return x === 1 || x === 2 || x === 3 || x === 4 || x === 5 || x === 6 || x === 7 || x === 8 || x === 9 || inner(x);
      };
      const c = (x: number) => x === 1 || x === 2 || x === 3 || x === 4 || x === 5 || x === 6 || x === 7 || x === 8 || x === 9 || x === 10;
      return {
        run(x: number) {
          return x === 1 || x === 2 || x === 3 || x === 4 || x === 5 || x === 6 || x === 7 || x === 8 || x === 9 || a(x) || b(x) || c(x);
        },
      };
    }
  `,
  );
  const outer = functions.find((fn) => fn.qualifiedName === 'createSession');
  const b = functions.find((fn) => fn.qualifiedName === 'createSession/b');
  assert.ok(outer && b);
  assert.equal(outer.selfCC, 1);
  assert.ok(functions.every((fn) => fn.selfCC <= 15));
  assert.equal(outer.nestedFunctions, 5);
  assert.equal(b.nestedFunctions, 1);
  assert.equal(
    b.subtreeCC,
    b.selfCC + (functions.find((fn) => fn.qualifiedName === 'createSession/b/inner').selfCC - 1),
  );
  assert.ok(outer.subtreeCC > 45);
});

test('counts file lines consistently for empty, trailing-newline, no-trailing-newline and CRLF sources', () => {
  assert.equal(countLines(''), 0);
  assert.equal(countLines('\n'), 1);
  assert.equal(countLines('a'), 1);
  assert.equal(countLines('a\n'), 1);
  assert.equal(countLines('a\nb\n'), 2);
  assert.equal(countLines('a\r\nb\r\nc'), 3);
  assert.equal(measureSource('lines.ts', 'const a = 1;\nconst b = 2;\n').lines, 2);
});
