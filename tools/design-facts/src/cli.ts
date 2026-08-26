/**
 * 设计稿字面量抽取 CLI。
 *
 *   pnpm design:facts            # 重新生成 docs/design-facts/*.json
 *   pnpm design:facts:check      # 只校验已入库产物是否与设计稿一致(不写盘)
 *   pnpm design:facts <a.html>   # 指定源文件
 *
 * 设计稿缺席时(`参考/` 被 gitignore,clone 下来没有)校验跳过并说明原因,不算失败。
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { ARTIFACT_VERSION, stripVolatile, type DesignFactArtifact } from './extract';
import {
  DEFAULT_SOURCES,
  OUTPUT_DIR,
  REPO_ROOT,
  buildArtifact,
  outputPathFor,
  readCommitted,
  serialize,
  sourceExists
} from './artifact-io';

/** 区分三种过期原因,否则"哈希一致但内容不一致"会打出一条自相矛盾的消息 */
function staleReason(committed: DesignFactArtifact | null, fresh: DesignFactArtifact): string {
  if (committed === null) return '产物缺失';
  if (committed.source.sha256 !== fresh.source.sha256) {
    return (
      `设计稿已变更(产物记录的源哈希 ${committed.source.sha256.slice(0, 12)}… ` +
      `vs 现稿 ${fresh.source.sha256.slice(0, 12)}…)`
    );
  }
  if (committed.artifactVersion !== fresh.artifactVersion) {
    return `抽取器结构版本已升到 ${fresh.artifactVersion}(产物仍是 ${committed.artifactVersion})`;
  }
  return '源哈希一致但产物内容与重新抽取的结果不同(产物被手工改过,或抽取语义变了而版本号没升)';
}

const argv = process.argv.slice(2);
const checkOnly = argv.includes('--check');
const overrides = argv.filter((arg) => !arg.startsWith('--'));
const targets =
  overrides.length > 0 ? overrides.map((arg) => relative(REPO_ROOT, resolve(arg))) : DEFAULT_SOURCES;

let failures = 0;
let skipped = 0;
if (!checkOnly) mkdirSync(OUTPUT_DIR, { recursive: true });

for (const sourcePath of targets) {
  const shown = relative(REPO_ROOT, outputPathFor(sourcePath));
  const committed = readCommitted(sourcePath);

  if (!sourceExists(sourcePath)) {
    if (committed === null) {
      console.error(`FAIL ${sourcePath}:设计稿与已入库产物都不存在`);
      failures += 1;
      continue;
    }
    skipped += 1;
    console.log(
      `SKIP ${shown}:设计稿 ${sourcePath} 不在本机(参考/ 已 gitignore),无法比对内容哈希;` +
        `已入库产物记录的源哈希为 ${committed.source.sha256.slice(0, 12)}…`
    );
    continue;
  }

  const fresh = buildArtifact(sourcePath, committed?.generator.generatedAt ?? new Date().toISOString());
  const unchanged =
    committed !== null && JSON.stringify(stripVolatile(committed)) === JSON.stringify(stripVolatile(fresh));

  if (checkOnly) {
    if (unchanged) {
      console.log(`OK   ${shown}(${fresh.stats.nodes} 节点 / ${fresh.stats.literals} 字面量)`);
    } else {
      failures += 1;
      console.error(`FAIL ${shown}:${staleReason(committed, fresh)},跑 pnpm design:facts 重新生成`);
    }
    continue;
  }

  if (unchanged) {
    console.log(`==   ${shown} 无变化`);
    continue;
  }
  // 只在设计稿或抽取语义确有变化时更新时间戳,避免空 diff
  const stamped = { ...fresh, generator: { ...fresh.generator, generatedAt: new Date().toISOString() } };
  writeFileSync(outputPathFor(sourcePath), serialize(stamped));
  console.log(
    `写入 ${shown}:${fresh.stats.nodes} 节点 / ${fresh.stats.literals} 字面量` +
      `(其中 ${fresh.stats.fontMeasured} 处是文本盒)/ ${fresh.stats.computed} 个计算层 token`
  );
}

if (skipped > 0 && failures === 0) {
  console.log(`\n跳过 ${skipped} 份:设计稿不在本机。产物结构版本 ${ARTIFACT_VERSION}。`);
}
if (failures > 0) process.exit(1);
