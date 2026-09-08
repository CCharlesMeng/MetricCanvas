import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validate, versionPolicy } from '@metriccanvas/page';
import { MCP_IMPLEMENTATION_VERSION, PAGE_BUILDING_PROMPT } from '../src';

/**
 * 版本文案守护(#77):Prompt 与示例的版本认知 ≡ versionPolicy.current,
 * MCP 实现版本 ≡ package.json;版本升级时任一处漏改都在这里报警。
 */

function exampleFromPrompt(marker: string): Record<string, unknown> {
  const line = PAGE_BUILDING_PROMPT.split('\n').find((entry) => entry.startsWith(marker));
  expect(line, `Prompt 缺少 ${marker}`).toBeDefined();
  return JSON.parse(line!.slice(marker.length)) as Record<string, unknown>;
}

describe('Prompt ≡ versionPolicy 守护', () => {
  it('Prompt 内出现的所有 schemaVersion 字面量都等于 versionPolicy.current', () => {
    const versions = [...PAGE_BUILDING_PROMPT.matchAll(/"schemaVersion":"([^"]+)"/gu)].map(
      (match) => match[1]
    );
    expect(versions.length).toBeGreaterThanOrEqual(2);
    for (const version of versions) {
      expect(version).toBe(versionPolicy.current);
    }
  });

  it('Prompt 不残留具体版本代号文案', () => {
    expect(PAGE_BUILDING_PROMPT).not.toMatch(/\bv\d+\b/u);
    expect(PAGE_BUILDING_PROMPT).not.toMatch(/'\d\.\d'/u);
  });

  it.each([
    { label: 'inline 示例', marker: 'inline 最小示例:' },
    { label: 'DQE 示例', marker: 'DQE 最小示例:' }
  ])('$label 的版本 ≡ versionPolicy.current 且通过 validate()', ({ marker }) => {
    const example = exampleFromPrompt(marker);
    expect(example.schemaVersion).toBe(versionPolicy.current);
    expect(validate(example)).toEqual([]);
  });
});

describe('MCP 实现版本单点', () => {
  it('MCP_IMPLEMENTATION_VERSION ≡ package.json 的 version', () => {
    const manifest = JSON.parse(
      readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8')
    ) as { version: string };
    expect(MCP_IMPLEMENTATION_VERSION).toBe(manifest.version);
  });
});
