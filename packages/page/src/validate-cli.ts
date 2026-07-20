import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { validate } from './validate';
import { fileNameErrors } from './file-name';
import type { CatalogSnapshot } from './catalog';
import type { TypedError } from './errors';

/**
 * validate CLI:对页面目录全量两级校验(结构 + 对元数据快照的语义)+ 文件名一致性。
 * 本地 / pre-commit / CI 同一套逻辑(#10 的 CI 流水线直接调用)。
 * 用法:tsx validate-cli.ts [页面目录=pages] [--catalog 快照路径=catalog/snapshot.json]
 * 退出码:0 全部通过;1 存在校验错误;2 目录/快照本身不可用。
 */
function main(argv: string[]): number {
  const args = argv.filter((a) => !a.startsWith('--'));
  const pagesDir = resolve(args[0] ?? 'pages');
  const catalogFlag = argv.indexOf('--catalog');
  const catalogPath = resolve(catalogFlag >= 0 ? argv[catalogFlag + 1] : 'catalog/snapshot.json');

  if (!existsSync(pagesDir)) {
    console.error(`页面目录不存在:${pagesDir}`);
    return 2;
  }
  let catalog: CatalogSnapshot | undefined;
  if (existsSync(catalogPath)) {
    catalog = JSON.parse(readFileSync(catalogPath, 'utf8')) as CatalogSnapshot;
  } else {
    console.warn(`警告:元数据快照不存在(${catalogPath}),跳过语义校验;先跑 pnpm sync-catalog`);
  }

  const files = readdirSync(pagesDir).filter((f) => f.endsWith('.json'));
  let failed = 0;
  for (const file of files) {
    const raw = readFileSync(join(pagesDir, file), 'utf8');
    let document: unknown;
    try {
      document = JSON.parse(raw);
    } catch (cause) {
      report(file, [{ type: 'SCHEMA_ERROR', path: '/', message: `不是合法 JSON:${String(cause)}` }]);
      failed++;
      continue;
    }
    const errors = [...validate(document, catalog), ...fileNameErrors(file, document)];
    if (errors.length > 0) {
      report(file, errors);
      failed++;
    } else {
      console.log(`✓ ${file}`);
    }
  }

  console.log(`\n共 ${files.length} 个页面文档,${files.length - failed} 通过,${failed} 失败`);
  return failed > 0 ? 1 : 0;
}

function report(file: string, errors: TypedError[]): void {
  console.error(`✗ ${file}`);
  for (const error of errors) {
    console.error(`  [${error.type}] ${error.path} ${error.message}`);
    if (error.type === 'METRIC_GAP') {
      console.error('  ↳ 这是需求信号而非 bug:请按 metric-gap 模板开 issue,同步数据服务团队');
    }
  }
}

process.exitCode = main(process.argv.slice(2));
