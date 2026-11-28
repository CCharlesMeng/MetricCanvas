import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  allLedgerFailures,
  categoryOf,
  collectFileSizeViolations,
  collectSubtreeViolations,
  fileSizeLedgerFailures,
  gateFailures,
  ledgerFailures,
  regressionFailures,
  subtreeLedgerFailures,
  summarize,
  svelteScript,
} from './audit-code-complexity.mjs';
import { measureSource } from './measure-ts-complexity.mjs';

const file = (functions) => ({ functions: functions.map((selfCC) => ({ selfCC })) });
test('uses an unrounded function-weighted average, with 5 excluded', () => {
  assert.equal(summarize([file([1]), file([5, 6])]).average, 4);
  assert.equal(summarize([file([])]).average, null);
  const report = { errors: [], languages: { ts: { maintained: summarize([file([5])]) } } };
  assert.match(gateFailures(report)[0], /must be <5/);
});
test('reports individual hotspots even when the average passes; strict function check is explicit', () => {
  const report = {
    errors: [],
    languages: { ts: { maintained: summarize([file([1, 1, 1, 16])]) } },
  };
  assert.deepEqual(gateFailures(report), []);
  assert.equal(report.languages.ts.maintained.overFunctionMaximum, 1);
  assert.match(gateFailures(report, true)[0], /exceed 15/);
  assert.equal(
    gateFailures({ ...report, errors: [{ file: 'broken.ts', error: 'parse failure' }] }).length,
    1,
  );
});
test('keeps generated and historical code separately visible rather than treating duplicate copies as fixes', () => {
  assert.equal(
    categoryOf('metriccanvas-authoring/mc-content/scripts/inspect-page.mjs'),
    'generated',
  );
  assert.equal(categoryOf('packages/engine/runtime-ui/src/report-pdf-capture.ts'), 'generated');
  assert.equal(
    categoryOf('metriccanvas-authoring/contracts/authored/publication-contract.ts'),
    'production',
  );
  assert.equal(categoryOf('packages/page/tests/page.test.ts'), 'tests');
  assert.equal(categoryOf('tools/scripts/page-reference.ts'), 'tooling');
  assert.equal(categoryOf('docs/evidence/previous/check.mjs'), 'historical');
});
test('parses actual Svelte script blocks, preserves source lines, and explicitly excludes template branches', () => {
  const source = `<!-- <script>broken(</script> -->\n<script module lang="ts">\nexport function outer() { return () => flag ? 1 : 0; }\n</script>\n<script lang="ts">\nconst sample = '<script>not code';\nfunction run(value: number) { if (value) return 1; return 0; }\n</script>\n{#if visible}<p>{sample}</p>{/if}`;
  const script = svelteScript('sample.svelte', source);
  assert.deepEqual(
    measureSource('sample.ts', script).functions.map((fn) => [fn.line, fn.selfCC]),
    [
      [3, 1],
      [3, 2],
      [7, 2],
    ],
  );
  assert.throws(() => svelteScript('broken.svelte', '<script>const x = ;</script>'));
});
test('Python inventory includes nested callables and class methods once, and rejects invalid sources', () => {
  const directory = mkdtempSync(join(tmpdir(), 'mc-python-complexity-'));
  const source = join(directory, 'sample.py'),
    broken = join(directory, 'broken.py');
  writeFileSync(
    source,
    'class Store:\n def read(self, value):\n  if value: return 1\n  return 0\ndef outer():\n def child(value):\n  return 1 if value else 0\n return child\n',
  );
  writeFileSync(broken, 'def broken(:');
  try {
    const output = execFileSync(
      process.env.METRICCANVAS_PYTHON ?? 'python3',
      ['tools/scripts/measure-python-complexity.py'],
      {
        input: JSON.stringify([source, broken]),
        encoding: 'utf8',
      },
    );
    const report = JSON.parse(output);
    assert.deepEqual(
      report.files[0].functions.map((fn) => [fn.qualifiedName, fn.selfCC]),
      [
        ['outer', 1],
        ['outer/child', 2],
        ['Store.read', 2],
      ],
    );
    assert.ok(report.files[1].error);
  } finally {
    rmSync(directory, { recursive: true });
  }
});

test('rejects new, increased, moved and duplicated high-complexity functions without treating line shifts as new debt', () => {
  const row = {
    file: 'source.ts',
    language: 'typescript-javascript',
    qualifiedName: 'factory/<anonymous@4:2>',
    selfCC: 20,
    line: 4,
  };
  const shifted = { ...row, qualifiedName: 'factory/<anonymous@40:2>', line: 40 };
  assert.deepEqual(regressionFailures([shifted], [row]), []);
  assert.equal(regressionFailures([{ ...shifted, selfCC: 21 }], [row]).length, 1);
  assert.equal(regressionFailures([{ ...row, file: 'moved.ts' }], [row]).length, 1);
  assert.equal(regressionFailures([{ ...row, qualifiedName: 'renamed' }], [row]).length, 1);
  assert.equal(regressionFailures([row, shifted], [row]).length, 1);
  assert.equal(regressionFailures([row], []).length, 1);
  assert.deepEqual(regressionFailures([{ ...row, selfCC: 18 }], [row]), []);
});

test('requires closing or lowering a repaid allowance and rejects raising it with the code', () => {
  const row = (selfCC) => ({
    file: 'source.ts',
    language: 'typescript-javascript',
    qualifiedName: 'run',
    line: 5,
    selfCC,
  });
  // The scanner reports only scores above 15, so both 9 and 10 have empty debt.
  assert.match(ledgerFailures([], [row(28)], [row(28)])[0], /remove unused allowance/);
  assert.deepEqual(ledgerFailures([], [], [row(28)]), []);
  assert.deepEqual(ledgerFailures([], [], []), []);
  assert.match(ledgerFailures([row(16)], [row(16)], [])[0], /ledger exceeds base.*permitted 15/);
  assert.match(ledgerFailures([row(36)], [row(48)], [row(48)])[0], /lower allowance to 36/);
  assert.deepEqual(ledgerFailures([row(36)], [row(36)], [row(48)]), []);
  assert.match(ledgerFailures([row(37)], [row(36)], [row(36)])[0], /CC=37 exceeds permitted 36/);
  assert.match(
    ledgerFailures([row(37)], [row(37)], [row(36)])[0],
    /ledger exceeds base.*permitted 36/,
  );
});

test('matches anonymous siblings by descending score and multiplicity on both sides of the ratchet', () => {
  const row = (line, selfCC) => ({
    file: 'x.ts',
    language: 'typescript-javascript',
    qualifiedName: `outer/<anonymous@${line}:1>`,
    line,
    selfCC,
  });
  const previous = [row(6, 18), row(3, 25)];
  const measured = [row(10, 22), row(15, 17)];
  assert.deepEqual(ledgerFailures(measured, measured.toReversed(), previous), []);
  assert.equal(ledgerFailures(measured, previous, previous).length, 2);
  assert.match(ledgerFailures([row(10, 22)], measured, previous)[0], /remove unused allowance/);
});

test('collects subtreeCC > 45 violations only when nested closures inflate subtreeCC in production and tooling files', () => {
  const files = [
    {
      file: 'packages/core/src/factory.ts',
      category: 'production',
      language: 'typescript-javascript',
      lines: 120,
      functions: [
        { qualifiedName: 'factory', line: 1, selfCC: 2, subtreeCC: 60, nestedFunctions: 12 },
        { qualifiedName: 'flatBig', line: 50, selfCC: 48, subtreeCC: 48, nestedFunctions: 0 },
        { qualifiedName: 'atLimit', line: 80, selfCC: 2, subtreeCC: 45, nestedFunctions: 5 },
      ],
    },
    {
      file: 'tools/scripts/helper.mjs',
      category: 'tooling',
      language: 'typescript-javascript',
      lines: 90,
      functions: [{ qualifiedName: 'run', line: 1, selfCC: 3, subtreeCC: 46, nestedFunctions: 8 }],
    },
    {
      file: 'packages/core/tests/suite.test.ts',
      category: 'tests',
      language: 'typescript-javascript',
      lines: 300,
      functions: [
        {
          qualifiedName: '<anonymous@1:1>',
          line: 1,
          selfCC: 1,
          subtreeCC: 80,
          nestedFunctions: 40,
        },
      ],
    },
    {
      file: 'metriccanvas-authoring/mc-content/generated.mjs',
      category: 'generated',
      language: 'typescript-javascript',
      lines: 700,
      functions: [{ qualifiedName: 'gen', line: 1, selfCC: 1, subtreeCC: 99, nestedFunctions: 20 }],
    },
    {
      file: 'metriccanvas-authoring/tool/mod.py',
      category: 'production',
      language: 'python',
      lines: 700,
      functions: [{ qualifiedName: 'py_fn', line: 1, selfCC: 10 }],
    },
  ];
  assert.deepEqual(collectSubtreeViolations(files), [
    {
      file: 'packages/core/src/factory.ts',
      language: 'typescript-javascript',
      qualifiedName: 'factory',
      line: 1,
      selfCC: 2,
      subtreeCC: 60,
      nestedFunctions: 12,
    },
    {
      file: 'tools/scripts/helper.mjs',
      language: 'typescript-javascript',
      qualifiedName: 'run',
      line: 1,
      selfCC: 3,
      subtreeCC: 46,
      nestedFunctions: 8,
    },
  ]);
});

test('enforces zero-growth and shrink-only ratchet on subtreeCC > 45', () => {
  const row = (subtreeCC, line = 10) => ({
    file: 'packages/core/src/session.ts',
    language: 'typescript-javascript',
    qualifiedName: 'createSession',
    line,
    selfCC: 2,
    subtreeCC,
    nestedFunctions: 20,
  });
  assert.deepEqual(subtreeLedgerFailures([row(120, 14)], [row(120, 10)], [row(120, 10)]), []);
  assert.match(subtreeLedgerFailures([row(46)], [], [])[0], /subtreeCC=46 exceeds permitted 45/);
  assert.match(
    subtreeLedgerFailures([row(46)], [row(46)], [])[0],
    /ledger exceeds base.*subtreeCC=46 exceeds permitted 45/,
  );
  assert.match(
    subtreeLedgerFailures([row(121)], [row(120)], [row(120)])[0],
    /subtreeCC=121 exceeds permitted 120/,
  );
  assert.match(
    subtreeLedgerFailures([row(121)], [row(121)], [row(120)])[0],
    /ledger exceeds base.*subtreeCC=121 exceeds permitted 120/,
  );
  assert.match(
    subtreeLedgerFailures([row(95)], [row(120)], [row(120)])[0],
    /ledger subtreeCC=120; lower allowance to 95/,
  );
  assert.deepEqual(subtreeLedgerFailures([row(95)], [row(95)], [row(120)]), []);
  assert.match(
    subtreeLedgerFailures([], [row(120)], [row(120)])[0],
    /ledger subtreeCC=120; remove unused allowance/,
  );
  assert.deepEqual(subtreeLedgerFailures([], [], [row(120)]), []);
});

test('collects > 600-line violations only for production TS/JS/Svelte source files', () => {
  const files = [
    {
      file: 'packages/page/src/validate.ts',
      category: 'production',
      language: 'typescript-javascript',
      lines: 601,
      functions: [],
    },
    {
      file: 'packages/page/src/exact.ts',
      category: 'production',
      language: 'typescript-javascript',
      lines: 600,
      functions: [],
    },
    {
      file: 'packages/engine/runtime-ui/src/View.svelte',
      category: 'production',
      language: 'typescript-javascript',
      lines: 650,
      functions: [],
    },
    {
      file: 'packages/page/tests/big.test.ts',
      category: 'tests',
      language: 'typescript-javascript',
      lines: 1200,
      functions: [],
    },
    {
      file: 'tools/dqe-sim/src/execute.ts',
      category: 'tooling',
      language: 'typescript-javascript',
      lines: 1100,
      functions: [],
    },
    {
      file: 'packages/engine/runtime-ui/src/report-pdf-capture.ts',
      category: 'generated',
      language: 'typescript-javascript',
      lines: 900,
      functions: [],
    },
    {
      file: 'metriccanvas-authoring/tool/big.py',
      category: 'production',
      language: 'python',
      lines: 900,
      functions: [],
    },
  ];
  assert.deepEqual(collectFileSizeViolations(files), [
    { file: 'packages/page/src/validate.ts', language: 'typescript-javascript', lines: 601 },
    {
      file: 'packages/engine/runtime-ui/src/View.svelte',
      language: 'typescript-javascript',
      lines: 650,
    },
  ]);
});

test('enforces zero-growth and shrink-only ratchet on production file size > 600 lines', () => {
  const row = (lines) => ({
    file: 'packages/page/src/validate.ts',
    language: 'typescript-javascript',
    lines,
  });
  assert.deepEqual(fileSizeLedgerFailures([row(750)], [row(750)], [row(750)]), []);
  assert.match(fileSizeLedgerFailures([row(601)], [], [])[0], /lines=601 exceeds permitted 600/);
  assert.match(
    fileSizeLedgerFailures([row(601)], [row(601)], [])[0],
    /ledger exceeds base.*lines=601 exceeds permitted 600/,
  );
  assert.match(
    fileSizeLedgerFailures([row(751)], [row(750)], [row(750)])[0],
    /lines=751 exceeds permitted 750/,
  );
  assert.match(
    fileSizeLedgerFailures([row(751)], [row(751)], [row(750)])[0],
    /ledger exceeds base.*lines=751 exceeds permitted 750/,
  );
  assert.match(
    fileSizeLedgerFailures([row(680)], [row(750)], [row(750)])[0],
    /ledger lines=750; lower allowance to 680/,
  );
  assert.deepEqual(fileSizeLedgerFailures([row(680)], [row(680)], [row(750)]), []);
  assert.match(
    fileSizeLedgerFailures([], [row(750)], [row(750)])[0],
    /ledger lines=750; remove unused allowance/,
  );
  assert.deepEqual(fileSizeLedgerFailures([], [], [row(750)]), []);
});

test('handles first rollout gracefully when Git base ledger lacks subtreeViolations and fileSizeViolations', () => {
  const selfRow = {
    file: 'a.ts',
    language: 'typescript-javascript',
    qualifiedName: 'run',
    line: 1,
    selfCC: 18,
  };
  const subtreeRow = {
    file: 'b.ts',
    language: 'typescript-javascript',
    qualifiedName: 'factory',
    line: 1,
    selfCC: 2,
    subtreeCC: 80,
    nestedFunctions: 10,
  };
  const sizeRow = { file: 'b.ts', language: 'typescript-javascript', lines: 700 };
  const measured = {
    violations: [selfRow],
    subtreeViolations: [subtreeRow],
    fileSizeViolations: [sizeRow],
  };
  const candidate = {
    violations: [selfRow],
    subtreeViolations: [subtreeRow],
    fileSizeViolations: [sizeRow],
  };
  const legacyBase = { violations: [selfRow] };

  assert.deepEqual(allLedgerFailures(measured, candidate, legacyBase), []);
  // Even on first rollout, candidate ledger must still match working tree without padded allowances.
  const padded = { ...candidate, subtreeViolations: [{ ...subtreeRow, subtreeCC: 90 }] };
  assert.match(
    allLedgerFailures(measured, padded, legacyBase)[0],
    /ledger subtreeCC=90; lower allowance to 80/,
  );
  // Missing required sections in candidate cannot bypass the ratchet.
  const stripped = { violations: [selfRow] };
  assert.deepEqual(
    allLedgerFailures(
      { violations: [selfRow], subtreeViolations: [], fileSizeViolations: [] },
      stripped,
      legacyBase,
    ),
    [
      'ledger missing required array "subtreeViolations"',
      'ledger missing required array "fileSizeViolations"',
    ],
  );
  // Once base has the sections, subsequent PRs reject raising any section.
  const raised = { ...candidate, fileSizeViolations: [{ ...sizeRow, lines: 705 }] };
  assert.match(
    allLedgerFailures(raised, raised, candidate)[0],
    /ledger exceeds base.*lines=705 exceeds permitted 700/,
  );
});
