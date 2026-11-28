import { execFileSync } from 'node:child_process';
import { lstatSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const MAX_FILE_BYTES = 1_000_000;
export const EVIDENCE_PREFIX = 'docs/evidence/';
export const ALLOWED_EVIDENCE_PATHS = new Set(['docs/evidence/README.md']);

const GIT_MAX_BUFFER = 64 * 1024 * 1024;
const SUBMODULE_MODE = '160000';

export function normalizeRepoPath(filePath) {
  return filePath.replaceAll('\\', '/').replace(/^\.\//, '');
}

function runGit(args, cwd, input) {
  return execFileSync('git', args, {
    cwd,
    input,
    encoding: 'utf8',
    maxBuffer: GIT_MAX_BUFFER,
  });
}

function splitNulList(output) {
  return output.split('\0').filter(Boolean);
}

function readFileByteSize(cwd, filePath) {
  try {
    const stat = lstatSync(resolve(cwd, filePath));
    if (!stat.isFile() && !stat.isSymbolicLink()) return null;
    return stat.size;
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') return null;
    throw error;
  }
}

export function readTrackedEntries(cwd = process.cwd()) {
  const paths = splitNulList(runGit(['ls-files', '-z'], cwd));
  const entries = [];
  for (const filePath of paths) {
    const size = readFileByteSize(cwd, filePath);
    if (size === null) continue;
    entries.push({ path: normalizeRepoPath(filePath), size });
  }
  return entries;
}

export function parseStageIndex(raw) {
  const index = new Map();
  for (const record of splitNulList(raw)) {
    const tabIndex = record.indexOf('\t');
    if (tabIndex === -1) continue;
    const [mode, oid] = record.slice(0, tabIndex).split(' ');
    if (!mode || !oid || mode === SUBMODULE_MODE) continue;
    const filePath = normalizeRepoPath(record.slice(tabIndex + 1));
    index.set(filePath, { mode, oid });
  }
  return index;
}

function readBlobSizes(oids, cwd) {
  if (oids.length === 0) return [];
  const raw = runGit(['cat-file', '--batch-check=%(objectsize)'], cwd, `${oids.join('\n')}\n`);
  return raw
    .trimEnd()
    .split('\n')
    .map((line) => Number.parseInt(line, 10));
}

export function readStagedEntries(cwd = process.cwd()) {
  const stagedPaths = splitNulList(
    runGit(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], cwd),
  ).map(normalizeRepoPath);
  if (stagedPaths.length === 0) return [];

  const stageIndex = parseStageIndex(runGit(['ls-files', '--stage', '-z'], cwd));
  const stagedBlobs = [];
  for (const filePath of stagedPaths) {
    const meta = stageIndex.get(filePath);
    if (!meta) continue;
    stagedBlobs.push({ path: filePath, oid: meta.oid });
  }

  const sizes = readBlobSizes(
    stagedBlobs.map((item) => item.oid),
    cwd,
  );
  return stagedBlobs.map((item, idx) => ({ path: item.path, size: sizes[idx] }));
}

function compareViolations(a, b) {
  if (a.rule !== b.rule) return a.rule.localeCompare(b.rule);
  return a.path.localeCompare(b.path);
}

export function evaluateRepoHygiene(entries, options = {}) {
  const maxBytes = options.maxBytes ?? MAX_FILE_BYTES;
  const allowedEvidencePaths = options.allowedEvidencePaths ?? ALLOWED_EVIDENCE_PATHS;
  const violations = [];

  for (const entry of entries) {
    const normalized = normalizeRepoPath(entry.path);
    if (entry.size > maxBytes) {
      violations.push({
        rule: 'max-file-size',
        path: normalized,
        size: entry.size,
        limit: maxBytes,
      });
    }
    if (normalized.startsWith(EVIDENCE_PREFIX) && !allowedEvidencePaths.has(normalized)) {
      violations.push({
        rule: 'forbidden-evidence-path',
        path: normalized,
      });
    }
  }

  violations.sort(compareViolations);
  return {
    ok: violations.length === 0,
    checkedFiles: entries.length,
    violations,
  };
}

export function formatViolation(violation) {
  if (violation.rule === 'max-file-size') {
    return `[max-file-size] ${violation.path}: ${violation.size} bytes exceeds limit of ${violation.limit} bytes`;
  }
  return `[forbidden-evidence-path] ${violation.path}: files under ${EVIDENCE_PREFIX} are disallowed except docs/evidence/README.md`;
}

export function formatHygieneReport(result, mode = 'tracked') {
  const header = `Repo hygiene (${mode}): checked ${result.checkedFiles} files, ${result.violations.length} violation(s).`;
  if (result.ok) return header;
  return [header, ...result.violations.map((item) => `  - ${formatViolation(item)}`)].join('\n');
}

export function checkRepoHygiene(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const staged = Boolean(options.staged);
  const entries = staged ? readStagedEntries(cwd) : readTrackedEntries(cwd);
  return evaluateRepoHygiene(entries, {
    maxBytes: options.maxBytes ?? MAX_FILE_BYTES,
    allowedEvidencePaths: options.allowedEvidencePaths ?? ALLOWED_EVIDENCE_PATHS,
  });
}

function main(argv = process.argv.slice(2)) {
  const staged = argv.includes('--staged');
  const unknownFlags = argv.filter((arg) => arg !== '--staged');
  if (unknownFlags.length > 0) {
    console.error(`Unknown argument(s): ${unknownFlags.join(', ')}`);
    process.exitCode = 2;
    return;
  }

  const mode = staged ? 'staged' : 'tracked';
  const result = checkRepoHygiene({ staged });
  const report = formatHygieneReport(result, mode);
  if (result.ok) {
    console.log(report);
  } else {
    console.error(report);
    process.exitCode = 1;
  }
}

const isDirectRun =
  typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main();
}
