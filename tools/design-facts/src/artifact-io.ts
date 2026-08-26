/** 产物的路径约定与读写:CLI 与测试共用,两边看到的是同一套路径和同一套序列化 */

import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractDesignFacts, type DesignFactArtifact } from './extract';
import { formatJson } from './format-json';

export const PACKAGE_NAME = '@metriccanvas/design-facts';
export const GENERATE_COMMAND = 'pnpm design:facts';
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
export const OUTPUT_DIR = join(REPO_ROOT, 'docs/design-facts');

/**
 * 两份在用稿。第三份 `archive-not-a-source/opportunity-lits.html` 已于 2026-08-25
 * 退出事实源、禁止再引,因此不在此列——要加回来先改 sdd baseline 的 `STYLE-7`。
 */
export const DEFAULT_SOURCES = [
  '参考/项目地图/设计稿/project-overview.html',
  '参考/项目地图/设计稿/porject-detail.html'
];

export function outputPathFor(sourcePath: string): string {
  return join(OUTPUT_DIR, `${basename(sourcePath).replace(/\.html?$/i, '')}.json`);
}

export function sourceExists(sourcePath: string): boolean {
  return existsSync(join(REPO_ROOT, sourcePath));
}

export function buildArtifact(sourcePath: string, generatedAt: string): DesignFactArtifact {
  const bytes = readFileSync(join(REPO_ROOT, sourcePath));
  return extractDesignFacts({
    sourcePath,
    html: bytes.toString('utf8'),
    bytes,
    generatedAt,
    command: GENERATE_COMMAND,
    packageName: PACKAGE_NAME
  });
}

export function readCommitted(sourcePath: string): DesignFactArtifact | null {
  const outputPath = outputPathFor(sourcePath);
  if (!existsSync(outputPath)) return null;
  return JSON.parse(readFileSync(outputPath, 'utf8')) as DesignFactArtifact;
}

export function serialize(artifact: DesignFactArtifact): string {
  return formatJson(artifact);
}
