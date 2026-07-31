import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { TypedError } from './errors';
import { fileNameErrors } from './file-name';
import { navigateErrors } from './navigate';
import type { Page } from './page';
import { validate } from './validate';

function main(argv: string[]): number {
  const pagesDir = resolve(argv[0] ?? 'pages');
  if (!existsSync(pagesDir)) {
    console.error(`页面目录不存在:${pagesDir}`);
    return 2;
  }

  const files = readdirSync(pagesDir).filter((file) => file.endsWith('.json'));
  const results: Array<{ file: string; errors: TypedError[]; page?: Page }> = [];
  const knownPageIds = new Set(files.map((file) => file.replace(/\.json$/, '')));
  const pagesById = new Map<string, Page>();

  for (const file of files) {
    let document: unknown;
    try {
      document = JSON.parse(readFileSync(join(pagesDir, file), 'utf8'));
    } catch (cause) {
      results.push({
        file,
        errors: [
          {
            type: 'SCHEMA_ERROR',
            path: '/',
            message: `不是合法 JSON:${String(cause)}`
          }
        ]
      });
      continue;
    }

    const errors = validate(document);
    if (errors.length > 0) {
      results.push({ file, errors });
      continue;
    }

    const page = document as Page;
    errors.push(...fileNameErrors(file, page));
    if (errors.length === 0) pagesById.set(page.id, page);
    results.push({ file, errors, ...(errors.length === 0 ? { page } : {}) });
  }

  let failed = 0;
  for (const result of results) {
    if (result.page) {
      result.errors.push(
        ...navigateErrors(result.page, knownPageIds, pagesById)
      );
    }
    if (result.errors.length === 0) {
      console.log(`✓ ${result.file}`);
      continue;
    }
    failed++;
    report(result.file, result.errors);
  }

  console.log(
    `\n共 ${files.length} 个页面文档,${files.length - failed} 通过,${failed} 失败`
  );
  return failed > 0 ? 1 : 0;
}

function report(file: string, errors: TypedError[]): void {
  console.error(`✗ ${file}`);
  for (const error of errors) {
    console.error(`  [${error.type}] ${error.path} ${error.message}`);
  }
}

process.exitCode = main(process.argv.slice(2));
