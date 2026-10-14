import { readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePage } from '../../packages/page/src/validate';
import { fileNameErrors } from '../../packages/page/src/file-name';
import { versionPolicy } from '../../packages/page/src/version';
import type { TypedError } from '../../packages/page/src/errors';

export function inspectPageDocument(fileName: string, document: unknown): TypedError[] {
  const parsed = parsePage(document);
  return parsed.ok ? fileNameErrors(fileName, parsed.page) : parsed.errors;
}

/** Distribution entrypoint: bundled with the product validator, never imports the author's checkout. */
function main(args: string[]): number {
  if (args.length === 1 && args[0] === '--version') {
    console.log(JSON.stringify({ schemaVersion: versionPolicy.current, validation: 'page-and-file-name' }));
    return 0;
  }
  if (args.length !== 1) {
    console.error('Usage: node validate-page.mjs <page.json|directory> | --version');
    return 2;
  }
  const target = resolve(args[0]);
  let files: string[];
  try {
    files = statSync(target).isDirectory()
      ? readdirSync(target).filter(name => name.endsWith('.json')).sort().map(name => join(target, name))
      : [target];
    if (!files.length) throw new Error('No JSON page documents found');
  } catch (cause) {
    console.error(String(cause));
    return 2;
  }
  let failed = 0;
  for (const file of files) {
    let errors: TypedError[];
    try {
      errors = inspectPageDocument(basename(file), JSON.parse(readFileSync(file, 'utf8')));
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
