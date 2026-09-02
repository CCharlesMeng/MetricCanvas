import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * 问数编排模块的依赖边界自证(#66 验收:框架无关):
 * ask/ 只依赖注入端口的类型来源(@metriccanvas/mcp、@metriccanvas/page、
 * page-lifecycle 的 JSON 类型)、Agent 运行设施(../agent)与步骤事件契约
 * (../session/step-event);不 import SvelteKit、$env、HTTP 与 Node 内建。
 *
 * 新增文件必须在白名单声明依赖面——依赖面的每次扩张都是显式决定。
 */

const ASK_DIR = fileURLToPath(new URL('../../src/lib/server/ask/', import.meta.url));

const ALLOWED_IMPORTS: Record<string, readonly string[]> = {
  // 端口声明:检索/验真/装配端口的类型来源 + 步骤事件契约的意图闭集。
  'ports.ts': ['@metriccanvas/mcp', '../session/step-event'],
  // 快照检索实现:语义面投影的唯一来源在 mcp(#80)。
  'retrieval.ts': ['@metriccanvas/mcp', './ports'],
  // 取数单元 → 可执行派生物:页面协议类型 + 取数核对形状。
  'unit-derivation.ts': ['@metriccanvas/page', '@metriccanvas/mcp', '../session/step-event', './ports'],
  // 编排状态机:组件目录守卫 + Agent 运行设施 + 事件契约 + 本模块各件;
  // 会话状态往返契约是双端共享模块($lib/ask/conversation,#68);
  // 缺口幂等键派生(#67)与条目形状同源于 session 侧的唯一真源。
  'orchestrator.ts': [
    '@metriccanvas/page',
    '@metriccanvas/mcp',
    '@metriccanvas/page-lifecycle',
    '../../ask/conversation',
    '../agent/abort',
    '../agent/runner',
    '../agent/types',
    '../session/metric-gap',
    '../session/step-event',
    './retrieval',
    './unit-derivation',
    './visualization-intent',
    './ports'
  ],
  // 会话分析意图 → 组件推荐意图的单一映射真源。
  'visualization-intent.ts': ['@metriccanvas/mcp', '../session/step-event'],
  // 模型端口适配:ModelProvider(deepseek/scripted)→ 结构化决策。
  'model-port.ts': ['@metriccanvas/mcp', '../agent/types', '../session/step-event', './ports'],
  // 无外部模型时的确定性回退。
  'lexical-model.ts': ['@metriccanvas/mcp', './ports']
};

function importsOf(source: string): string[] {
  const specifiers: string[] = [];
  const pattern = /(?:^|\n)\s*(?:import|export)[^;]*?from\s+['"]([^'"]+)['"]/gu;
  for (const match of source.matchAll(pattern)) {
    specifiers.push(match[1]!);
  }
  const bare = /(?:^|\n)\s*import\s+['"]([^'"]+)['"]/gu;
  for (const match of source.matchAll(bare)) {
    specifiers.push(match[1]!);
  }
  return [...new Set(specifiers)].sort();
}

describe('问数编排模块依赖边界', () => {
  const files = readdirSync(ASK_DIR).filter((file) => file.endsWith('.ts'));

  it('ask/ 目录的每个文件都声明了依赖白名单', () => {
    expect(files.sort()).toEqual(Object.keys(ALLOWED_IMPORTS).sort());
  });

  it.each(files.map((file) => ({ file })))('$file 只使用白名单内依赖', ({ file }) => {
    const allowed = ALLOWED_IMPORTS[file];
    expect(allowed, `请为 ${file} 声明依赖白名单`).toBeDefined();
    const actual = importsOf(readFileSync(`${ASK_DIR}${file}`, 'utf8'));
    expect(actual).toEqual([...allowed!].sort());
  });

  it.each(files.map((file) => ({ file })))(
    '$file 不感知 SvelteKit、HTTP、环境变量与 Node 内建',
    ({ file }) => {
      const source = readFileSync(`${ASK_DIR}${file}`, 'utf8');
      for (const forbidden of [
        '$env',
        '$app',
        '$lib',
        '@sveltejs',
        'services.server',
        'node:',
        'fetch('
      ]) {
        expect(source.includes(forbidden), `${file} 不应引用 ${forbidden}`).toBe(false);
      }
    }
  );
});
