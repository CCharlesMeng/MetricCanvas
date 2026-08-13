import { describe, expect, it } from 'vitest';
import type { McpClient } from '@metriccanvas/mcp';
import { createDeepSeekModelProvider } from '../../src/lib/server/agent/deepseek.server';
import { createAgentRunner } from '../../src/lib/server/agent/runner';
import type { AgentEvent } from '../../src/lib/server/agent/types';
import { WORKBENCH_PROMPT } from '../../src/lib/server/agent/workbench-request';

/**
 * 真实模型按需评测(#32):固定任务集跑真实 DeepSeek,只断言结构性行为
 * (安全终止、工具协议、无凭据泄漏),不做随机文本逐字匹配。
 *
 * 主 CI 无 DEEPSEEK_API_KEY,整组自动跳过,不阻塞;本地按需运行:
 *   DEEPSEEK_API_KEY=... [DEEPSEEK_MODEL=...] pnpm vitest run apps/platform/tests/agent/real-model-eval.test.ts
 */

const apiKey = process.env.DEEPSEEK_API_KEY?.trim() ?? '';
const describeEval = apiKey ? describe : describe.skip;

/** 固定任务集:直答生成、需澄清、动态取数三类,覆盖工具调用与纯文本收尾。 */
const FIXED_TASKS = [
  {
    id: 'static-metric-card',
    question: '创建一个展示本月成交总额 128600 元的静态单指标卡页面,页面 id 用 gmv-overview'
  },
  {
    id: 'clarification-prone',
    question: '给我做个看板'
  },
  {
    id: 'dynamic-dqe',
    question: '创建一个按区域展示 Tokens 消耗量的动态看板,需要实时查询'
  }
] as const;

function evalMcp(): { mcp: McpClient; calledTools: string[] } {
  const calledTools: string[] = [];
  const mcp: McpClient = {
    async listTools() {
      return [
        {
          name: 'search_data_context',
          description: '检索数据上下文',
          inputSchema: {
            type: 'object',
            properties: { query: { type: 'string' }, limit: { type: 'integer' } },
            required: ['query']
          }
        },
        {
          name: 'validate_page',
          description: '校验页面文档',
          inputSchema: {
            type: 'object',
            properties: { document: { type: 'object' } },
            required: ['document']
          }
        }
      ];
    },
    async callTool({ name }) {
      calledTools.push(name);
      if (name === 'search_data_context') {
        return {
          structuredContent: {
            ok: true,
            dataContextVersion: 'eval-v1',
            matches: [{
              kind: 'verifiedQuery',
              query: {
                id: 'tokens-by-region',
                question: '按区域查看 Tokens 消耗量',
                description: '区域 Tokens 消耗汇总',
                language: 'dqe',
                body: {
                  dsl_list: [{
                    output_dims: ['区域'],
                    output_metrics: ['Tokens消耗量'],
                    filter: { dims: [], metrics: [] },
                    order: {}
                  }]
                },
                resultFields: [
                  { name: '区域', type: 'string', role: 'dimension', nullable: false },
                  { name: 'Tokens消耗量', type: 'number', role: 'measure', unit: 'Token', nullable: false }
                ]
              }
            }]
          },
          isError: false
        };
      }
      return { structuredContent: { ok: true, valid: true, errors: [] }, isError: false };
    }
  };
  return { mcp, calledTools };
}

describeEval('真实模型固定任务集评测(按需,不进主 CI)', () => {
  it.each(FIXED_TASKS.map((task) => ({ ...task })))(
    '$id:安全终止、遵守工具协议、不泄漏凭据',
    { timeout: 180_000 },
    async ({ question }) => {
      const model = createDeepSeekModelProvider({
        apiKey,
        ...(process.env.DEEPSEEK_MODEL ? { model: process.env.DEEPSEEK_MODEL } : {}),
        ...(process.env.DEEPSEEK_BASE_URL ? { baseUrl: process.env.DEEPSEEK_BASE_URL } : {})
      });
      const { mcp, calledTools } = evalMcp();
      const runner = createAgentRunner({
        model,
        mcp,
        maxModelTurns: 8,
        timeoutMs: 150_000,
        maxTotalTokens: 120_000,
        toolCallLimits: { search_data_context: 4, validate_page: 4 }
      });

      const events: AgentEvent[] = [];
      for await (const event of runner.run({
        messages: [
          { role: 'system', content: WORKBENCH_PROMPT },
          { role: 'user', content: question }
        ]
      })) {
        events.push(event);
      }

      // 结构性断言:以 completed 收尾(限额停机会抛出,交给测试失败暴露)。
      expect(events.at(-1)).toMatchObject({ type: 'completed' });
      // 工具协议:只调用了暴露给它的工具。
      for (const tool of calledTools) {
        expect(['search_data_context', 'validate_page']).toContain(tool);
      }
      // 凭据红线:事件与消息里不得出现 API Key。
      expect(JSON.stringify(events)).not.toContain(apiKey);
    }
  );
});
