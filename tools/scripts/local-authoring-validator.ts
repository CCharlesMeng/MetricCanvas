import { readFileSync, realpathSync, statSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { pageFilesById } from './page-files.mjs';
import { fileURLToPath } from 'node:url';
import { parsePage } from '../../packages/page/src/validate';
import { fileNameErrors } from '../../packages/page/src/file-name';
import { versionPolicy } from '../../packages/page/src/version';
import type { TypedError } from '../../packages/page/src/errors';

type ExpectedLayout = 'dashboard' | 'report';

export function inspectPageDocument(fileName: string, document: unknown, expectedLayout?: ExpectedLayout): TypedError[] {
  const parsed = parsePage(document);
  if (!parsed.ok) return parsed.errors;
  const errors = fileNameErrors(fileName, parsed.page);
  const actual = parsed.page.layout ?? 'report';
  if (expectedLayout && actual !== expectedLayout) errors.push({
    type: 'SCHEMA_ERROR', path: '/layout',
    message: `布局形态与本次确认不一致：预期 ${expectedLayout}，实际 ${actual}`
  });
  return errors;
}

function validationFiles(target: string): string[] {
  const files = statSync(target).isDirectory() ? [...pageFilesById(target).values()] : [target];
  if (!files.length) throw new Error('No JSON page documents found');
  return files;
}

/** Distribution entrypoint: bundled with the product validator, never imports the author's checkout. */
function main(args: string[]): number {
  if (args.length === 1 && args[0] === '--version') {
    console.log(JSON.stringify({ schemaVersion: versionPolicy.current, validation: 'page-and-file-name' }));
    return 0;
  }
  let expectedLayout: ExpectedLayout | undefined;
  const option = args.indexOf('--expected-layout');
  const value = args[option + 1];
  if (option >= 0 && (value === 'dashboard' || value === 'report')) {
    expectedLayout = value;
    args = args.filter((_, index) => index !== option && index !== option + 1);
  }
  if (args.length !== 1 || (option >= 0 && !expectedLayout)) {
    console.error('Usage: node validate-page.mjs [--expected-layout dashboard|report] <page.json|directory> | --version');
    return 2;
  }
  const target = resolve(args[0]);
  let files: string[];
  try {
    files = validationFiles(target);
  } catch (cause) {
    console.error(String(cause));
    return 2;
  }
  let failed = 0;
  for (const file of files) {
    let errors: TypedError[];
    try {
      errors = inspectPageDocument(basename(file), JSON.parse(readFileSync(file, 'utf8')), expectedLayout);
    } catch (cause) {
      errors = [{ type: 'SCHEMA_ERROR', path: '/', message: String(cause) }];
    }
    if (errors.length) failed++;
    console.log(JSON.stringify({ file, ok: errors.length === 0, errors }));
  }
  return failed ? 1 : 0;
}

if (process.argv[1] && realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url))) {
  process.exitCode = main(process.argv.slice(2));
}
