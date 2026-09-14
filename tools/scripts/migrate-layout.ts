/** 离线追加输出：不修改原始修订，不调用保存服务。 */
import { readFile, writeFile, link, unlink } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { normalizePageDocument } from '../../packages/page/src/index';

export async function migrateLayoutFile(inputPath: string, outputPath: string): Promise<void> {
  if (resolve(inputPath) === resolve(outputPath)) throw new Error('输入与输出必须是不同文件');
  const input = JSON.parse(await readFile(inputPath, 'utf8'));
  const result = normalizePageDocument(input);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  const output = resolve(outputPath);
  const temporary = join(dirname(output), `.${basename(output)}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, JSON.stringify(result.document, null, 2) + '\n', { flag: 'wx' });
    // 同目录硬链接原子创建目标：目标存在即失败，不覆盖，也不暴露半写文件。
    await link(temporary, output);
  } finally {
    await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [input, output, ...extra] = process.argv.slice(2);
  if (!input || !output || extra.length) throw new Error('用法: node --import tsx tools/scripts/migrate-layout.ts <旧页面.json> <新页面.json>');
  await migrateLayoutFile(input, output);
}
