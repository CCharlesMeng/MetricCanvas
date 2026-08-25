#!/usr/bin/env -S pnpm exec tsx

import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync
} from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import {
  fileNameErrors,
  navigateErrors,
  parsePage,
  type Page,
  type TypedError
} from '../../../../packages/page/src/index.ts';

interface FileResult {
  file: string;
  valid: boolean;
  errorCount: number;
  errors: TypedError[];
  page?: Page;
}

function main(argv: string[]): number {
  const input = resolve(argv[0] ?? 'pages');
  if (!existsSync(input)) {
    printFatal(input, '路径不存在');
    return 2;
  }

  const stats = statSync(input);
  if (!stats.isFile() && !stats.isDirectory()) {
    printFatal(input, '路径必须是 JSON 文件或目录');
    return 2;
  }
  if (stats.isFile() && extname(input) !== '.json') {
    printFatal(input, '单文件必须以 .json 结尾');
    return 2;
  }

  const directory = stats.isDirectory() ? input : dirname(input);
  const names = stats.isDirectory()
    ? readdirSync(input).filter((name) => name.endsWith('.json')).sort()
    : [basename(input)];
  const knownPageIds = new Set(names.map((name) => name.replace(/\.json$/u, '')));
  const pagesById = new Map<string, Page>();
  const checkFileName = stats.isDirectory() || basename(directory) === 'pages';
  const results = names.map((name) =>
    inspectFile(join(directory, name), name, checkFileName)
  );

  for (const result of results) {
    if (result.page !== undefined && result.errors.length === 0) {
      pagesById.set(result.page.id, result.page);
    }
  }

  if (stats.isDirectory()) {
    for (const result of results) {
      if (result.page === undefined || result.errors.length > 0) continue;
      result.errors.push(...navigateErrors(result.page, knownPageIds, pagesById));
      result.errorCount = result.errors.length;
      result.valid = result.errors.length === 0;
    }
  }

  const failures = results.filter((result) => !result.valid).length;
  const report = {
    scope: stats.isDirectory() ? 'directory' : 'file',
    target: input,
    summary: {
      files: results.length,
      passed: results.length - failures,
      failed: failures,
      errors: results.reduce((total, result) => total + result.errorCount, 0)
    },
    results: results.map(({ page: _page, ...result }) => result)
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  return failures === 0 ? 0 : 1;
}

function inspectFile(path: string, file: string, checkFileName: boolean): FileResult {
  let document: unknown;
  try {
    document = JSON.parse(readFileSync(path, 'utf8'));
  } catch (cause) {
    const errors: TypedError[] = [{
      type: 'SCHEMA_ERROR',
      path: '/',
      message: `不是合法 JSON:${messageOf(cause)}`
    }];
    return { file, valid: false, errorCount: errors.length, errors };
  }

  const parsed = parsePage(document);
  if (!parsed.ok) {
    return {
      file,
      valid: false,
      errorCount: parsed.errors.length,
      errors: parsed.errors
    };
  }

  const errors = checkFileName ? fileNameErrors(file, parsed.page) : [];
  return {
    file,
    valid: errors.length === 0,
    errorCount: errors.length,
    errors,
    page: parsed.page
  };
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function printFatal(target: string, message: string): void {
  process.stderr.write(`${JSON.stringify({ target, error: message }, null, 2)}\n`);
}

process.exitCode = main(process.argv.slice(2));
