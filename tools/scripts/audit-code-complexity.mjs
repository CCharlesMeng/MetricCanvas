/** Repository inventory. The AST counting contract stays metriccanvas-ts-ast/1. */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { countLines, measureSource } from './measure-ts-complexity.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const generatedPrefixes = ['metriccanvas-authoring/mc-content/', 'metriccanvas-authoring/skill/'];
const generatedFiles = new Set([
  'metriccanvas-authoring/scripts/page-validation-bridge.mjs',
  'packages/engine/runtime-ui/src/report-pdf-capture.ts',
]);
export const limits = {
  averageExclusive: 5,
  functionMaximum: 15,
  subtreeMaximum: 45,
  fileSizeMaximum: 600,
};
const subtreeCategories = new Set(['production', 'tooling']);

export function categoryOf(file) {
  if (generatedFiles.has(file) || generatedPrefixes.some((prefix) => file.startsWith(prefix)))
    return 'generated';
  if (/^(docs|artifacts)\//.test(file) || /\/(?:prototype|prototypes)\//.test(file))
    return 'historical';
  if (/(?:^|\/)(?:tests?|fixtures?|test-harness)(?:\/|$)|\.test\.[cm]?[jt]sx?$/.test(file))
    return 'tests';
  if (/^(?:tools|scripts)\/|\/scripts\/|(?:^|\/)\w+\.config\./.test(file)) return 'tooling';
  return 'production';
}

/** Parse Svelte first; script offsets and line numbers are preserved, templates are not CC. */
export function svelteScript(file, source) {
  const ast = parse(source, { modern: true, filename: file });
  const chars = source.split('').map((char) => (char === '\n' ? '\n' : ' '));
  for (const script of [ast.module, ast.instance].filter(Boolean)) {
    for (let i = script.content.start; i < script.content.end; i++) chars[i] = source[i];
  }
  return chars.join('');
}

export function isSubtreeViolation(fn) {
  return (
    typeof fn.subtreeCC === 'number' &&
    fn.subtreeCC > limits.subtreeMaximum &&
    fn.subtreeCC > fn.selfCC
  );
}

export function isFileSizeViolation(file) {
  return (
    file.category === 'production' &&
    file.language === 'typescript-javascript' &&
    typeof file.lines === 'number' &&
    file.lines > limits.fileSizeMaximum
  );
}

export function summarize(files) {
  const functions = files.flatMap((file) => file.functions);
  const decisions = functions.reduce((sum, row) => sum + row.selfCC - 1, 0);
  return {
    files: files.length,
    functions: functions.length,
    decisions,
    average: functions.length ? 1 + decisions / functions.length : null,
    maximum: Math.max(0, ...functions.map((row) => row.selfCC)),
    overFunctionMaximum: functions.filter((row) => row.selfCC > limits.functionMaximum).length,
    overSubtreeMaximum: functions.filter(isSubtreeViolation).length,
    overFileSizeMaximum: files.filter(
      (file) => typeof file.lines === 'number' && file.lines > limits.fileSizeMaximum,
    ).length,
  };
}

function inventory(repository) {
  const gitOptions = { cwd: repository, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 };
  const tracked = execFileSync('git', ['ls-files', '-z'], gitOptions);
  // Include new maintained sources, without pulling unrelated untracked release archives into the audit.
  const added = execFileSync(
    'git',
    [
      'ls-files',
      '--others',
      '--exclude-standard',
      '-z',
      '--',
      'apps',
      'packages',
      'tools',
      'tests',
      'metriccanvas-authoring',
    ],
    gitOptions,
  );
  return [...new Set((tracked + added).split('\0'))].filter(supported).sort();
}
function baselineMetadata(repository, ref) {
  const tree = execFileSync('git', ['ls-tree', '-r', '-z', '--format=%(objectname) %(path)', ref], {
    cwd: repository,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  const entries = tree
    .split('\0')
    .filter(Boolean)
    .map((line) => ({ oid: line.slice(0, 40), file: line.slice(41) }))
    .filter((entry) => supported(entry.file));
  const blobs = execFileSync('git', ['cat-file', '--batch'], {
    cwd: repository,
    input: entries.map((entry) => entry.oid).join('\n') + '\n',
    maxBuffer: 128 * 1024 * 1024,
  });
  let offset = 0;
  return entries.map((entry) => {
    const end = blobs.indexOf(10, offset);
    const size = Number(blobs.subarray(offset, end).toString().split(' ')[2]);
    const source = blobs.subarray(end + 1, end + 1 + size).toString('utf8');
    offset = end + 2 + size;
    return fileMetadata(repository, entry.file, source);
  });
}
function supported(file) {
  return /\.(?:[cm]?[jt]sx?|svelte|py)$/.test(file) && !/\.d\.[cm]?ts$/.test(file);
}
function fileMetadata(repository, file, source = readFileSync(resolve(repository, file), 'utf8')) {
  return {
    file,
    category: categoryOf(file),
    sha256: createHash('sha256').update(source).digest('hex'),
    lines: countLines(source),
    source,
  };
}
function measureJavaScript(metadata) {
  const { file, source, ...identity } = metadata;
  const script = file.endsWith('.svelte') ? svelteScript(file, source) : source;
  const measured = measureSource(file.endsWith('.svelte') ? file + '.ts' : file, script);
  return {
    file,
    ...identity,
    language: 'typescript-javascript',
    coverage: file.endsWith('.svelte') ? 'scripts-only' : 'full-file',
    functions: measured.functions,
  };
}
function pythonMeasurements(repository, files, python) {
  if (!files.length) return [];
  const output = execFileSync(
    python,
    [resolve(repository, 'tools/scripts/measure-python-complexity.py')],
    {
      cwd: repository,
      input: JSON.stringify(files.map(({ file, source }) => ({ file, source }))),
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    },
  );
  const measured = new Map(JSON.parse(output).files.map((file) => [file.file, file]));
  return files.map(({ source, ...metadata }) => ({
    ...metadata,
    ...measured.get(metadata.file),
    language: 'python',
  }));
}
function groupedSummary(files) {
  return Object.fromEntries(
    ['production', 'tooling', 'tests', 'generated', 'historical'].map((category) => [
      category,
      summarize(files.filter((file) => file.category === category)),
    ]),
  );
}
function languageSummary(files) {
  return Object.fromEntries(
    ['typescript-javascript', 'python'].map((language) => {
      const selected = files.filter((file) => file.language === language);
      return [
        language,
        {
          maintained: summarize(maintainedFiles(selected)),
          inclusive: summarize(selected),
          categories: groupedSummary(selected),
        },
      ];
    }),
  );
}
function maintainedFiles(files) {
  return files.filter((file) => !['generated', 'historical'].includes(file.category));
}
export function gateFailures(report, enforceFunctions = false) {
  const failures = report.errors.map((error) => `${error.file}: ${error.error}`);
  for (const [language, summary] of Object.entries(report.languages)) {
    for (const scope of ['maintained', 'inclusive']) {
      const average = summary[scope]?.average;
      if (typeof average === 'number' && average >= limits.averageExclusive)
        failures.push(`${language}: ${scope} average ${average} must be <5`);
    }
    if (enforceFunctions && summary.maintained.overFunctionMaximum)
      failures.push(`${language}: ${summary.maintained.overFunctionMaximum} functions exceed 15`);
  }
  return failures;
}
function debtKey(row) {
  return JSON.stringify([
    row.file,
    row.language,
    row.qualifiedName.replace(/<anonymous@\d+:\d+>/g, '<anonymous>'),
  ]);
}
function staleCorrection(measured, limit) {
  return measured > limit ? `lower allowance to ${measured}` : 'remove unused allowance';
}
function increasedScore(row, maximum) {
  return `${row.file}:${row.line} ${row.qualifiedName}: CC=${row.selfCC} exceeds permitted ${maximum}`;
}
function staleAllowance(row, measured) {
  return `${row.file}:${row.line} ${row.qualifiedName}: ledger CC=${row.selfCC}; ${staleCorrection(measured, limits.functionMaximum)}`;
}
function increasedSubtree(row, maximum) {
  return `${row.file}:${row.line} ${row.qualifiedName}: subtreeCC=${row.subtreeCC} exceeds permitted ${maximum}`;
}
function staleSubtreeAllowance(row, measured) {
  return `${row.file}:${row.line} ${row.qualifiedName}: ledger subtreeCC=${row.subtreeCC}; ${staleCorrection(measured, limits.subtreeMaximum)}`;
}
function increasedFileSize(row, maximum) {
  return `${row.file}: lines=${row.lines} exceeds permitted ${maximum}`;
}
function staleFileSizeAllowance(row, measured) {
  return `${row.file}: ledger lines=${row.lines}; ${staleCorrection(measured, limits.fileSizeMaximum)}`;
}
const selfCcSpec = {
  keyOf: debtKey,
  scoreOf: (row) => row.selfCC,
  limit: limits.functionMaximum,
  describeExceeded: increasedScore,
  describeStale: staleAllowance,
};
const subtreeCcSpec = {
  keyOf: debtKey,
  scoreOf: (row) => row.subtreeCC,
  limit: limits.subtreeMaximum,
  describeExceeded: increasedSubtree,
  describeStale: staleSubtreeAllowance,
};
const fileSizeSpec = {
  keyOf: (row) => row.file,
  scoreOf: (row) => row.lines,
  limit: limits.fileSizeMaximum,
  describeExceeded: increasedFileSize,
  describeStale: staleFileSizeAllowance,
};
/** A counted multiset prevents an extra anonymous sibling from borrowing an existing allowance. */
function metricRegressions(violations, baseline, { keyOf, scoreOf, limit, describe }) {
  const available = new Map();
  for (const row of baseline) {
    const key = keyOf(row),
      scores = available.get(key) ?? [];
    scores.push(scoreOf(row));
    available.set(key, scores);
  }
  for (const scores of available.values()) scores.sort((a, b) => a - b);
  const failures = [];
  for (const row of [...violations].sort((a, b) => scoreOf(b) - scoreOf(a))) {
    const maximum = available.get(keyOf(row))?.pop();
    if (maximum === undefined || scoreOf(row) > maximum) {
      failures.push(describe(row, maximum ?? limit));
    }
  }
  return failures;
}
export function regressionFailures(violations, baseline, describe = increasedScore) {
  return metricRegressions(violations, baseline, { ...selfCcSpec, describe });
}
function sectionLedgerFailures(measured, candidate, previous, spec) {
  const failures = [
    ...metricRegressions(measured, candidate, { ...spec, describe: spec.describeExceeded }),
    ...metricRegressions(candidate, measured, { ...spec, describe: spec.describeStale }),
  ];
  if (Array.isArray(previous)) {
    failures.push(
      ...metricRegressions(candidate, previous, { ...spec, describe: spec.describeExceeded }).map(
        (message) => `ledger exceeds base: ${message}`,
      ),
    );
  }
  return failures;
}
const ledgerPath = 'tools/scripts/complexity-debt.json';
function readLedger(ref) {
  const source =
    ref === undefined
      ? readFileSync(resolve(root, ledgerPath), 'utf8')
      : execFileSync('git', ['show', `${ref}:${ledgerPath}`], { cwd: root, encoding: 'utf8' });
  const parsed = JSON.parse(source);
  return {
    violations: parsed.violations,
    subtreeViolations: parsed.subtreeViolations,
    fileSizeViolations: parsed.fileSizeViolations,
  };
}
export function ledgerFailures(measured, candidate, previous) {
  return sectionLedgerFailures(measured, candidate, previous, selfCcSpec);
}
export function subtreeLedgerFailures(measured, candidate, previous) {
  return sectionLedgerFailures(measured, candidate, previous, subtreeCcSpec);
}
export function fileSizeLedgerFailures(measured, candidate, previous) {
  return sectionLedgerFailures(measured, candidate, previous, fileSizeSpec);
}
export function allLedgerFailures(measured, candidate, previous) {
  const failures = [
    ...ledgerFailures(measured.violations, candidate.violations ?? [], previous?.violations),
  ];
  if (!Array.isArray(candidate.subtreeViolations)) {
    failures.push('ledger missing required array "subtreeViolations"');
  } else {
    failures.push(
      ...subtreeLedgerFailures(
        measured.subtreeViolations,
        candidate.subtreeViolations,
        previous?.subtreeViolations,
      ),
    );
  }
  if (!Array.isArray(candidate.fileSizeViolations)) {
    failures.push('ledger missing required array "fileSizeViolations"');
  } else {
    failures.push(
      ...fileSizeLedgerFailures(
        measured.fileSizeViolations,
        candidate.fileSizeViolations,
        previous?.fileSizeViolations,
      ),
    );
  }
  return failures;
}
export function collectViolations(files) {
  return maintainedFiles(files).flatMap((file) =>
    file.functions
      .filter((fn) => fn.selfCC > limits.functionMaximum)
      .map((fn) => ({ file: file.file, language: file.language, ...fn })),
  );
}
export function collectSubtreeViolations(files) {
  return files
    .filter((file) => subtreeCategories.has(file.category))
    .flatMap((file) =>
      file.functions.filter(isSubtreeViolation).map((fn) => ({
        file: file.file,
        language: file.language,
        qualifiedName: fn.qualifiedName,
        line: fn.line,
        selfCC: fn.selfCC,
        subtreeCC: fn.subtreeCC,
        nestedFunctions: fn.nestedFunctions,
      })),
    );
}
export function collectFileSizeViolations(files) {
  return files
    .filter(isFileSizeViolation)
    .map((file) => ({ file: file.file, language: file.language, lines: file.lines }));
}
export function audit(
  repository = root,
  python = process.env.METRICCANVAS_PYTHON ?? 'python3',
  sourceRef,
) {
  const commit = execFileSync(
    'git',
    ['rev-parse', '--verify', (sourceRef ?? 'HEAD') + '^{commit}'],
    { cwd: repository, encoding: 'utf8' },
  ).trim();
  const metadata = sourceRef
    ? baselineMetadata(repository, commit)
    : inventory(repository).map((file) => fileMetadata(repository, file));
  const files = [],
    errors = [];
  for (const file of metadata.filter((file) => !file.file.endsWith('.py'))) {
    try {
      files.push(measureJavaScript(file));
    } catch (error) {
      errors.push({ file: file.file, error: error.message });
    }
  }
  const pythonFiles = pythonMeasurements(
    repository,
    metadata.filter((file) => file.file.endsWith('.py')),
    python,
  );
  for (const file of pythonFiles)
    if (file.error) errors.push({ file: file.file, error: file.error });
  files.push(...pythonFiles);
  files.sort((a, b) => a.file.localeCompare(b.file, 'en'));
  const violations = collectViolations(files);
  const subtreeViolations = collectSubtreeViolations(files);
  const fileSizeViolations = collectFileSizeViolations(files);
  return {
    analyzers: {
      typescript: 'metriccanvas-ts-ast/1',
      typescriptVersion: ts.version,
      python: 'radon/6.0.1',
    },
    sourceCommit: commit,
    inventorySha256: createHash('sha256')
      .update(JSON.stringify(files.map(({ file, sha256 }) => [file, sha256])))
      .digest('hex'),
    snapshot: sourceRef ?? 'working-tree',
    limits,
    languages: languageSummary(files),
    errors,
    violations,
    subtreeViolations,
    fileSizeViolations,
    files,
  };
}
function main() {
  const { values } = parseArgs({
    options: {
      baseline: { type: 'string' },
      output: { type: 'string' },
      check: { type: 'boolean' },
      'check-functions': { type: 'boolean' },
    },
  });
  const report = audit(root, process.env.METRICCANVAS_PYTHON ?? 'python3', values.baseline);
  if (values.output) writeFileSync(resolve(values.output), JSON.stringify(report, null, 2) + '\n');
  const failures = gateFailures(report, values['check-functions']);
  if (values.check) {
    const previous = readLedger(process.env.METRICCANVAS_COMPLEXITY_BASE ?? 'HEAD');
    failures.push(...allLedgerFailures(report, readLedger(values.baseline), previous));
  }
  console.log(
    JSON.stringify(
      {
        ...report,
        files: undefined,
        violations: undefined,
        subtreeViolations: undefined,
        fileSizeViolations: undefined,
        failures,
      },
      null,
      2,
    ),
  );
  if (values.check || values['check-functions']) process.exitCode = Number(failures.length > 0);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
