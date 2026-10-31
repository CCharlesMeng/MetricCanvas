#!/usr/bin/env -S pnpm exec tsx

import { readFileSync, statSync } from 'node:fs';
import { basename, extname, relative, resolve, sep } from 'node:path';
import { pageFilesById } from '../../../../tools/scripts/page-files.mjs';
import { inspectPageDocument } from '../../../../tools/scripts/local-authoring-validator';
import type { TypedError } from '../../../../packages/page/src/errors';

interface FileResult {
  file: string;
  valid: boolean;
  errorCount: number;
  errors: TypedError[];
}

function inputFiles(input: string): { scope: 'directory' | 'file'; files: string[] } {
  const stats = statSync(input);
  if (stats.isDirectory()) {
    const files = [...pageFilesById(input).values()];
    if (!files.length) throw new Error('目录中没有 JSON 页面文档');
    return { scope: 'directory', files };
  }
  if (!stats.isFile() || extname(input) !== '.json') throw new Error('输入必须是 JSON 文件或页面目录');
  return { scope: 'file', files: [input] };
}

function inspectFile(path: string, file: string): FileResult {
  let errors: TypedError[];
  try {
    errors = inspectPageDocument(basename(path), JSON.parse(readFileSync(path, 'utf8')));
  } catch (cause) {
    errors = [{ type: 'SCHEMA_ERROR', path: '/', message: String(cause) }];
  }
  return { file, valid: errors.length === 0, errorCount: errors.length, errors };
}

function main(argv: string[]): number {
  const target = resolve(argv[0] ?? 'pages');
  try {
    if (argv.length > 1) throw new Error('用法：inspect-page-metadata.ts <file-or-directory>');
    const { scope, files } = inputFiles(target);
    const results = files.map(file => inspectFile(file,
      scope === 'directory' ? relative(target, file).split(sep).join('/') : basename(file)));
    const failed = results.filter(result => !result.valid).length;
    const summary = { files: results.length, passed: results.length - failed, failed,
      errors: results.reduce((total, result) => total + result.errorCount, 0) };
    process.stdout.write(`${JSON.stringify({ scope, target, summary, results }, null, 2)}\n`);
    return failed ? 1 : 0;
  } catch (cause) {
    process.stderr.write(`${JSON.stringify({ target, error: String(cause) }, null, 2)}\n`);
    return 2;
  }
}

process.exitCode = main(process.argv.slice(2));
