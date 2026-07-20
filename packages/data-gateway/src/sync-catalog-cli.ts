import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { syncCatalog } from './sync-catalog';

/**
 * sync-catalog CLI:从数据服务拼装元数据快照并写入仓库(默认 catalog/snapshot.json)。
 * 用法:tsx sync-catalog-cli.ts --base-url https://... [--out catalog/snapshot.json]
 * 鉴权请求头与 isTest 语义在切片2(#3)联调后补;当前需可匿名访问的环境。
 */
async function main(argv: string[]): Promise<number> {
  const baseUrl = flagValue(argv, '--base-url');
  if (!baseUrl) {
    console.error('缺少 --base-url(数据服务地址);离线开发请直接使用已入库的快照');
    return 2;
  }
  const out = resolve(flagValue(argv, '--out') ?? 'catalog/snapshot.json');

  const snapshot = await syncCatalog({ baseUrl });
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(snapshot, null, 2) + '\n');
  console.log(
    `已写入 ${out}:${snapshot.metrics.length} 个指标,${snapshot.dimensions.length} 个维度(syncedAt ${snapshot.syncedAt})`
  );
  return 0;
}

function flagValue(argv: string[], flag: string): string | undefined {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (cause) => {
    console.error(`sync-catalog 失败:${cause instanceof Error ? cause.message : String(cause)}`);
    process.exitCode = 1;
  }
);
