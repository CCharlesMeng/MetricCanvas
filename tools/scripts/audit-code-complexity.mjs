/** Repository inventory. The AST counting contract stays metriccanvas-ts-ast/1. */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { measureSource } from './measure-ts-complexity.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const generatedPrefixes = ['metriccanvas-authoring/mc-content/', 'metriccanvas-authoring/skill/'];
const generatedFiles = new Set([
  'metriccanvas-authoring/scripts/page-validation-bridge.mjs',
  'packages/engine/runtime-ui/src/report-pdf-capture.ts',
]);
export const limits = { averageExclusive: 5, functionMaximum: 15 };

export function categoryOf(file) {
  if (generatedFiles.has(file) || generatedPrefixes.some(prefix => file.startsWith(prefix))) return 'generated';
  if (/^(docs|artifacts)\//.test(file) || /\/(?:prototype|prototypes)\//.test(file)) return 'historical';
  if (/(?:^|\/)(?:tests?|fixtures?|test-harness)(?:\/|$)|\.test\.[cm]?[jt]sx?$/.test(file)) return 'tests';
  if (/^(?:tools|scripts)\/|\/scripts\/|(?:^|\/)\w+\.config\./.test(file)) return 'tooling';
  return 'production';
}

/** Parse Svelte first; script offsets and line numbers are preserved, templates are not CC. */
export function svelteScript(file, source) {
  const ast = parse(source, { modern: true, filename: file });
  const chars = source.split('').map(char => char === '\n' ? '\n' : ' ');
  for (const script of [ast.module, ast.instance].filter(Boolean)) {
    for (let i = script.content.start; i < script.content.end; i++) chars[i] = source[i];
  }
  return chars.join('');
}

export function summarize(files) {
  const functions = files.flatMap(file => file.functions);
  const decisions = functions.reduce((sum, row) => sum + row.selfCC - 1, 0);
  return {
    files: files.length, functions: functions.length, decisions,
    average: functions.length ? 1 + decisions / functions.length : null,
    maximum: Math.max(0, ...functions.map(row => row.selfCC)),
    overFunctionMaximum: functions.filter(row => row.selfCC > limits.functionMaximum).length,
  };
}

function inventory(repository) {
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: repository, encoding: 'utf8' });
  // Include new maintained sources, without pulling unrelated untracked release archives into the audit.
  const added = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z', '--',
    'apps', 'packages', 'tools', 'tests', 'metriccanvas-authoring'], { cwd: repository, encoding: 'utf8' });
  return [...new Set((tracked + added).split('\0'))].filter(supported).sort();
}
function baselineMetadata(repository, ref) {
  const tree = execFileSync('git', ['ls-tree', '-r', '-z', '--format=%(objectname) %(path)', ref], { cwd: repository, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const entries = tree.split('\0').filter(Boolean).map(line => ({ oid: line.slice(0, 40), file: line.slice(41) })).filter(entry => supported(entry.file));
  const blobs = execFileSync('git', ['cat-file', '--batch'], { cwd: repository,
    input: entries.map(entry => entry.oid).join('\n') + '\n', maxBuffer: 128 * 1024 * 1024 });
  let offset = 0;
  return entries.map(entry => {
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
  return { file, category: categoryOf(file), sha256: createHash('sha256').update(source).digest('hex'), source };
}
function measureJavaScript(metadata) {
  const { file, source, ...identity } = metadata;
  const script = file.endsWith('.svelte') ? svelteScript(file, source) : source;
  const measured = measureSource(file.endsWith('.svelte') ? file + '.ts' : file, script);
  return { file, ...identity, language: 'typescript-javascript',
    coverage: file.endsWith('.svelte') ? 'scripts-only' : 'full-file', functions: measured.functions };
}
function pythonMeasurements(repository, files, python) {
  if (!files.length) return [];
  const output = execFileSync(python, [resolve(repository, 'tools/scripts/measure-python-complexity.py')], {
    cwd: repository, input: JSON.stringify(files.map(({file, source}) => ({file, source}))), encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
  });
  const measured = new Map(JSON.parse(output).files.map(file => [file.file, file]));
  return files.map(({ source, ...metadata }) => ({ ...metadata, ...measured.get(metadata.file), language: 'python' }));
}
function groupedSummary(files) {
  return Object.fromEntries(['production', 'tooling', 'tests', 'generated', 'historical'].map(category =>
    [category, summarize(files.filter(file => file.category === category))]));
}
function languageSummary(files) {
  return Object.fromEntries(['typescript-javascript', 'python'].map(language => {
    const selected = files.filter(file => file.language === language);
    return [language, { maintained: summarize(maintainedFiles(selected)), inclusive: summarize(selected), categories: groupedSummary(selected) }];
  }));
}
function maintainedFiles(files) {
  return files.filter(file => !['generated', 'historical'].includes(file.category));
}
export function gateFailures(report, enforceFunctions = false) {
  const failures = report.errors.map(error => `${error.file}: ${error.error}`);
  for (const [language, summary] of Object.entries(report.languages)) {
    for (const scope of ['maintained', 'inclusive']) {
      const average = summary[scope]?.average;
      if (typeof average === 'number' && average >= limits.averageExclusive) failures.push(`${language}: ${scope} average ${average} must be <5`);
    }
    if (enforceFunctions && summary.maintained.overFunctionMaximum) failures.push(`${language}: ${summary.maintained.overFunctionMaximum} functions exceed 15`);
  }
  return failures;
}
function debtKey(row) {
  return JSON.stringify([row.file, row.language, row.qualifiedName.replace(/<anonymous@\d+:\d+>/g, '<anonymous>')]);
}
/** A counted multiset prevents an extra anonymous sibling from borrowing an existing allowance. */
export function regressionFailures(violations, baseline) {
  const available = new Map();
  for (const row of baseline) {
    const key = debtKey(row), scores = available.get(key) ?? [];
    scores.push(row.selfCC); available.set(key, scores);
  }
  const failures = [];
  for (const row of [...violations].sort((a,b) => b.selfCC - a.selfCC)) {
    const scores = available.get(debtKey(row)) ?? [];
    const index = scores.findIndex(score => score >= row.selfCC);
    if (index < 0) failures.push(`${row.file}:${row.line} ${row.qualifiedName}: new or increased CC=${row.selfCC} exceeds 15`);
    else scores.splice(index, 1);
  }
  return failures;
}
export function audit(repository = root, python = process.env.METRICCANVAS_PYTHON ?? 'python3', sourceRef) {
  const commit = execFileSync('git', ['rev-parse', '--verify', (sourceRef ?? 'HEAD') + '^{commit}'], { cwd: repository, encoding: 'utf8' }).trim();
  const metadata = sourceRef ? baselineMetadata(repository, commit) : inventory(repository).map(file => fileMetadata(repository, file));
  const files = [], errors = [];
  for (const file of metadata.filter(file => !file.file.endsWith('.py'))) {
    try { files.push(measureJavaScript(file)); }
    catch (error) { errors.push({ file: file.file, error: error.message }); }
  }
  const pythonFiles = pythonMeasurements(repository, metadata.filter(file => file.file.endsWith('.py')), python);
  for (const file of pythonFiles) if (file.error) errors.push({ file: file.file, error: file.error });
  files.push(...pythonFiles);
  files.sort((a, b) => a.file.localeCompare(b.file, 'en'));
  const violations = maintainedFiles(files).flatMap(file => file.functions
    .filter(fn => fn.selfCC > limits.functionMaximum).map(fn => ({ file: file.file, language: file.language, ...fn })));
  return { analyzers: { typescript: 'metriccanvas-ts-ast/1', typescriptVersion: ts.version, python: 'radon/6.0.1' },
    sourceCommit: commit,
    inventorySha256: createHash('sha256').update(JSON.stringify(files.map(({file,sha256}) => [file,sha256]))).digest('hex'),
    snapshot: sourceRef ?? 'working-tree', limits, languages: languageSummary(files), errors, violations, files };
}
function main() {
  const { values } = parseArgs({ options: {
    baseline: { type: 'string' }, output: { type: 'string' }, check: { type: 'boolean' }, 'check-functions': { type: 'boolean' },
  } });
  const report = audit(root, process.env.METRICCANVAS_PYTHON ?? 'python3', values.baseline);
  if (values.output) writeFileSync(resolve(values.output), JSON.stringify(report, null, 2) + '\n');
  const failures = gateFailures(report, values['check-functions']);
  if (values.check && !values.baseline) {
    const debt = JSON.parse(readFileSync(new URL('./complexity-debt.json', import.meta.url), 'utf8'));
    failures.push(...regressionFailures(report.violations, debt.violations));
  }
  console.log(JSON.stringify({ ...report, files: undefined, violations: undefined, failures }, null, 2));
  if (values.check || values['check-functions']) process.exitCode = Number(failures.length > 0);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
