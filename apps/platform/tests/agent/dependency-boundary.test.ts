import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * 依赖边界自证(ADR-0009、#32):Agent Runner 只能调用模型提供方接口与
 * MCP 客户端接口。agent-runner 解散进平台后,这条约束由模块边界承载;
 * 本测试按文件白名单静态检查 agent/ 目录的全部 import,越界立即失败。
 *
 * 新增文件必须在 ALLOWED_IMPORTS 声明自己的依赖面,否则测试失败——
 * 这是有意的:依赖面的每次扩张都应当是一次显式决定。
 */

const AGENT_DIR = fileURLToPath(new URL('../../src/lib/server/agent/', import.meta.url));

const ALLOWED_IMPORTS: Record<string, readonly string[]> = {
  // 核心循环:只有模型提供方接口(./types 的 ModelProvider)与 MCP 客户端
  // 接口(@metriccanvas/mcp 的类型),外加信号组合工具。
  'runner.ts': ['@metriccanvas/mcp', './abort', './types'],
  // 事件类型:MCP 协议边界 + 步骤事件契约(问数编排经 step 事件进通道,#66)。
  'types.ts': ['@metriccanvas/mcp', '../session/step-event'],
  'abort.ts': [],
  // 模型提供方 adapter:只依赖协议类型与信号判别。
  'deepseek.server.ts': ['./abort', './types'],
  'openai-compatible.server.ts': ['./abort', './types'],
  // 错误归一化:唯一分类声明,消费四段分类契约与模型/运行错误来源。
  'errors.ts': [
    '../session/step-event',
    './deepseek.server',
    './openai-compatible.server',
    './runner'
  ],
  // 按 run 的 MCP 接线与查询执行:平台侧组合根的一部分。
  'run-mcp.ts': [
    '@metriccanvas/mcp',
    '@metriccanvas/page',
    '@metriccanvas/page-lifecycle',
    '@metriccanvas/runtime',
    '@metriccanvas/template-library',
    './types'
  ],
  'run-registry.ts': ['@metriccanvas/page-lifecycle'],
  // 推送通道:翻译 + 落库契约 + 错误归一化。
  'stream.ts': [
    '../agent-events.server',
    '../session/step-event',
    './errors',
    './runner',
    './types'
  ],
  // 推送端点:HTTP/SSE 传输层;取数核对确认类型来自问数编排(#66),
  // 终态还会提取结构化问数状态并经页面复验写会话检查点(ADR-0058)。
  'stream-endpoint.ts': [
    '@metriccanvas/page-lifecycle',
    '../../ask/conversation',
    '../ask/orchestrator',
    '../session/checkpoint-document',
    '../session/store',
    './abort',
    './run-registry',
    './stream',
    './types',
    './workbench-request'
  ],
  // 请求契约:确认种类含取数核对与业务域改写,问数会话状态消息原样保留(#66);
  // 会话状态契约是双端共享模块($lib/ask,#68),不在 server/ 内。
  'workbench-request.ts': [
    '@metriccanvas/mcp',
    '../../ask/conversation',
    '../ask/orchestrator',
    './types'
  ]
};

function importsOf(source: string): string[] {
  const specifiers: string[] = [];
  const pattern = /(?:^|\n)\s*(?:import|export)[^;]*?from\s+['"]([^'"]+)['"]/gu;
  for (const match of source.matchAll(pattern)) {
    specifiers.push(match[1]);
  }
  const bare = /(?:^|\n)\s*import\s+['"]([^'"]+)['"]/gu;
  for (const match of source.matchAll(bare)) {
    specifiers.push(match[1]);
  }
  return [...new Set(specifiers)].sort();
}

describe('Agent 模块依赖边界', () => {
  const files = readdirSync(AGENT_DIR).filter((file) => file.endsWith('.ts'));

  it('agent/ 目录的每个文件都声明了依赖白名单', () => {
    expect(files.sort()).toEqual(Object.keys(ALLOWED_IMPORTS).sort());
  });

  it.each(files.map((file) => ({ file })))('$file 只使用白名单内依赖', ({ file }) => {
    const allowed = ALLOWED_IMPORTS[file];
    expect(allowed, `请为 ${file} 声明依赖白名单`).toBeDefined();
    const actual = importsOf(readFileSync(`${AGENT_DIR}${file}`, 'utf8'));
    expect(actual).toEqual([...allowed].sort());
  });

  it('Agent Runner 对 MCP 的依赖是纯类型依赖:不触碰传输与 server 实现', () => {
    const source = readFileSync(`${AGENT_DIR}runner.ts`, 'utf8');
    const mcpImports = [...source.matchAll(/import\s+([^;]*?)from\s+'@metriccanvas\/mcp'/gu)];
    expect(mcpImports.length).toBeGreaterThan(0);
    for (const [, clause] of mcpImports) {
      expect(clause.trimStart().startsWith('type ')).toBe(true);
    }
  });

  it('Agent Runner 不感知平台服务、会话存储、HTTP 与环境变量', () => {
    const source = readFileSync(`${AGENT_DIR}runner.ts`, 'utf8');
    for (const forbidden of [
      '$env',
      '$app',
      '$lib',
      'services.server',
      'session/',
      'data-gateway',
      '@sveltejs',
      'node:'
    ]) {
      expect(source.includes(forbidden), `runner.ts 不应引用 ${forbidden}`).toBe(false);
    }
  });
});
