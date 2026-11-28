import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { basename, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TypedError } from './errors';
import { fileNameErrors } from './file-name';
import { parsePage } from './validate';

export interface ValidateCliIo {
  stdout?: (line: string) => void;
  stderr?: (line: string) => void;
  cwd?: string;
}

export interface ValidateFileResult {
  file: string;
  ok: boolean;
  errors: TypedError[];
}

export interface ValidateJsonOutput {
  ok: boolean;
  checkedCount: number;
  failedCount: number;
  results: ValidateFileResult[];
}

interface ParsedArgs {
  json: boolean;
  targets: string[];
}

interface TargetFile {
  displayFile: string;
  absolutePath: string;
}

function toPosixPath(filePath: string): string {
  return sep === '/' ? filePath : filePath.split(sep).join('/');
}

function formatDisplayPath(absolutePath: string, cwd: string): string {
  const rel = relative(cwd, absolutePath);
  if (rel === '' || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    return toPosixPath(absolutePath);
  }
  return toPosixPath(rel);
}

/** 递归发现目录下的页面 JSON 相对路径（统一使用 `/` 分隔并按字典序排序）。 */
export function collectPageFiles(root: string): string[] {
  const entries = readdirSync(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      for (const nested of collectPageFiles(join(root, entry.name))) {
        files.push(`${entry.name}/${nested}`);
      }
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(entry.name);
    }
  }
  return files.sort();
}

function collectDirectoryTarget(
  dirPath: string,
  useRelativeToDir: boolean,
  cwd: string,
): TargetFile[] {
  const relativeFiles = collectPageFiles(dirPath);
  if (relativeFiles.length === 0) {
    throw new Error(`没有找到页面文档:${dirPath}`);
  }
  const seenIds = new Map<string, string>();
  const targets: TargetFile[] = [];
  for (const relFile of relativeFiles) {
    const absolutePath = join(dirPath, relFile);
    const id = basename(relFile, '.json');
    const existing = seenIds.get(id);
    if (existing !== undefined) {
      throw new Error(`重复页面 ID ${id}: ${existing} / ${absolutePath}`);
    }
    seenIds.set(id, absolutePath);
    targets.push({
      displayFile: useRelativeToDir ? relFile : formatDisplayPath(absolutePath, cwd),
      absolutePath,
    });
  }
  return targets;
}

function parseCliArgs(
  argv: string[],
): { ok: true; args: ParsedArgs } | { ok: false; message: string } {
  let json = false;
  const targets: string[] = [];
  for (const arg of argv) {
    if (arg === '--json') {
      json = true;
      continue;
    }
    if (arg === '') {
      return { ok: false, message: '路径不能为空' };
    }
    if (arg.startsWith('-')) {
      return { ok: false, message: `未知参数:${arg}` };
    }
    targets.push(arg);
  }
  return {
    ok: true,
    args: {
      json,
      targets: targets.length > 0 ? targets : ['pages'],
    },
  };
}

function resolveSingleTarget(
  rawTarget: string,
  useRelativeToDir: boolean,
  cwd: string,
): TargetFile[] {
  const resolved = resolve(cwd, rawTarget);
  if (!existsSync(resolved)) {
    throw new Error(`路径不存在:${resolved}`);
  }
  const stat = statSync(resolved);
  if (stat.isDirectory()) {
    return collectDirectoryTarget(resolved, useRelativeToDir, cwd);
  }
  if (!stat.isFile()) {
    throw new Error(`不支持的目标类型:${resolved}`);
  }
  if (!resolved.endsWith('.json')) {
    throw new Error(`仅支持 .json 页面文档:${resolved}`);
  }
  return [{ displayFile: formatDisplayPath(resolved, cwd), absolutePath: resolved }];
}

function resolveTargetFiles(rawTargets: string[], cwd: string): TargetFile[] {
  const useRelativeToDir = rawTargets.length === 1;
  const files: TargetFile[] = [];
  for (const rawTarget of rawTargets) {
    files.push(...resolveSingleTarget(rawTarget, useRelativeToDir, cwd));
  }
  return files;
}

function normalizeError(error: TypedError): TypedError {
  return {
    type: error.type,
    path: error.path,
    message: error.message,
  };
}

function validateTargetFile(target: TargetFile): ValidateFileResult {
  let document: unknown;
  try {
    document = JSON.parse(readFileSync(target.absolutePath, 'utf8'));
  } catch (cause) {
    return {
      file: target.displayFile,
      ok: false,
      errors: [
        {
          type: 'SCHEMA_ERROR',
          path: '/',
          message: `不是合法 JSON:${String(cause)}`,
        },
      ],
    };
  }

  const parsed = parsePage(document);
  if (!parsed.ok) {
    return {
      file: target.displayFile,
      ok: false,
      errors: parsed.errors.map(normalizeError),
    };
  }

  const errors = fileNameErrors(basename(target.absolutePath), parsed.page).map(normalizeError);
  return {
    file: target.displayFile,
    ok: errors.length === 0,
    errors,
  };
}

function buildJsonOutput(results: ValidateFileResult[]): ValidateJsonOutput {
  let failedCount = 0;
  for (const result of results) {
    if (!result.ok) failedCount++;
  }
  return {
    ok: failedCount === 0,
    checkedCount: results.length,
    failedCount,
    results,
  };
}

function writeTextReport(
  results: ValidateFileResult[],
  stdout: (line: string) => void,
  stderr: (line: string) => void,
): number {
  let failed = 0;
  for (const result of results) {
    if (result.ok) {
      stdout(`✓ ${result.file}`);
      continue;
    }
    failed++;
    stderr(`✗ ${result.file}`);
    for (const error of result.errors) {
      stderr(`  [${error.type}] ${error.path} ${error.message}`);
    }
  }
  stdout(`\n共 ${results.length} 个页面文档,${results.length - failed} 通过,${failed} 失败`);
  return failed;
}

function defaultStdout(line: string): void {
  console.log(line);
}

function defaultStderr(line: string): void {
  console.error(line);
}

function formatCause(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

export function runValidateCli(argv: string[], io: ValidateCliIo = {}): number {
  const stdout = io.stdout ?? defaultStdout;
  const stderr = io.stderr ?? defaultStderr;
  const cwd = io.cwd ?? process.cwd();

  const parsedArgs = parseCliArgs(argv);
  if (!parsedArgs.ok) {
    stderr(parsedArgs.message);
    return 2;
  }

  let targets: TargetFile[];
  try {
    targets = resolveTargetFiles(parsedArgs.args.targets, cwd);
  } catch (cause) {
    stderr(formatCause(cause));
    return 2;
  }

  const results = targets.map(validateTargetFile);
  if (parsedArgs.args.json) {
    const payload = buildJsonOutput(results);
    stdout(JSON.stringify(payload, null, 2));
    return payload.ok ? 0 : 1;
  }

  const failed = writeTextReport(results, stdout, stderr);
  return failed > 0 ? 1 : 0;
}

function isDirectExecution(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  const selfPath = fileURLToPath(import.meta.url);
  try {
    return realpathSync(entry) === realpathSync(selfPath);
  } catch {
    return resolve(entry) === resolve(selfPath);
  }
}

if (isDirectExecution()) {
  process.exitCode = runValidateCli(process.argv.slice(2));
}
