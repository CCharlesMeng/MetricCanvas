import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { migrateDocument } from './migrate';

/**
 * migrate CLI:把页面目录中落后版本的文档批量升至当前版本,幂等(已是当前版本的跳过)。
 * 升版直接写回文件(2 空格缩进),可评审 diff 即 git diff;控制台输出逐文件摘要。
 * 用法:tsx migrate-cli.ts [页面目录=pages]
 * 退出码:0 完成(含"全部已是当前版本");1 存在无迁移路径的文档;2 页面目录不可用。
 */
function main(argv: string[]): number {
  const pagesDir = resolve(argv[0] ?? 'pages');
  if (!existsSync(pagesDir)) {
    console.error(`页面目录不存在:${pagesDir}`);
    return 2;
  }

  let migrated = 0;
  let failed = 0;
  const files = readdirSync(pagesDir).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    const path = join(pagesDir, file);
    let document: Record<string, unknown>;
    try {
      document = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
    } catch (cause) {
      console.error(`✗ ${file} 不是合法 JSON,跳过:${String(cause)}`);
      failed++;
      continue;
    }

    const result = migrateDocument(document);
    if (result.outcome === 'current') {
      console.log(`· ${file} 已是当前版本,跳过`);
    } else if (result.outcome === 'migrated') {
      writeFileSync(path, JSON.stringify(result.document, null, 2) + '\n');
      console.log(`✓ ${file} 已升版:${result.steps.join(',')}`);
      migrated++;
    } else {
      console.error(`✗ ${file} 版本 ${result.from} 无迁移路径(注册表见 packages/page/src/migrate.ts)`);
      failed++;
    }
  }

  console.log(`\n共 ${files.length} 个页面文档:升版 ${migrated},失败 ${failed},其余已是当前版本`);
  if (migrated > 0) console.log('请用 git diff 评审升版改动后提交');
  return failed > 0 ? 1 : 0;
}

process.exitCode = main(process.argv.slice(2));
