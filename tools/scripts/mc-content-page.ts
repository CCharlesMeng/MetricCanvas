import { readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export { inspectPageSchema as inspectSchema } from '../../metriccanvas-authoring/core/page/inspect';
import { inspectPageSchema as inspectSchema } from '../../metriccanvas-authoring/core/page/inspect';

export function main(args: string[]): number {
  const [file] = args;
  try {
    if (!file || args.length !== 1) throw new Error('Usage: node inspect-page.mjs <page.json|--stdin>');
    console.log(JSON.stringify(inspectSchema(JSON.parse(readFileSync(file === '--stdin' ? 0 : file, 'utf8')))));
    return 0;
  } catch (error) {
    console.error(JSON.stringify({ code: 'PAGE_INSPECTION_INPUT_INVALID', message: String(error) }));
    return 2;
  }
}

if (process.argv[1] && realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url))) {
  process.exitCode = main(process.argv.slice(2));
}
