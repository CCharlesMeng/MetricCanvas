import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { validate } from '@metriccanvas/page';
import {
  assembleTransientPage,
  createDataRequestUnitVerification,
  type ExecuteDataRequestUnitQuery
} from '@metriccanvas/mcp';
import { createDqeSimServer, DQE_EXECUTE_PATH } from '../../../../tools/dqe-sim/src/server';
import { SUGGESTED_QUESTIONS } from '../../src/lib/ask/suggested-questions';
import { createDeepSeekModelProvider } from '../../src/lib/server/agent/deepseek.server';
import { createServerDataGateway } from '../../src/lib/server/data-gateway.server';
import { createRunAwareUnitQueryExecutor } from '../../src/lib/server/agent/run-mcp';
import { createModelBackedAskModel } from '../../src/lib/server/ask/model-port';
import { createSnapshotAskRetrieval } from '../../src/lib/server/ask/retrieval';
import { createAskOrchestrationRunner } from '../../src/lib/server/ask/orchestrator';
import { parseAskConversation } from '../../src/lib/ask/conversation';
import type { AgentEvent } from '../../src/lib/server/agent/types';
import { collect, completedOf, exampleSnapshot, stepEvents, userTurn } from './support/ask-harness';

/**
 * 建议问题的按需验证:真实 DeepSeek 模型 + 进程内 DQE 仿真跑完整链路,
 * 断言工作台空态上的每条建议问题「点一下就出页面」。
 *
 * 与 golden-end-to-end.test.ts 的分工:那边用 scripted 决策做确定性 CI 验收;
 * 这里衡量的正是模型行为——首轮能否按问题里的视角数铺开多个取数单元,
 * 因此必须用真实模型,不进主 CI。检索、验真、真实执行与装配全部是生产实现。
 *
 * 两类问题共走一条断言路径,判据按 `splitBy` 分流:
 * - **单口径问题**(无 splitBy):全部单元共用同一分组维度与时间窗口,组件之间
 *   可以横向对照,因此判据是「口径一致」;
 * - **跨口径问题**(有 splitBy):判据不是口径一致而是「口径差异说清了」——问题
 *   点到的每个切分视角各自成一个内容分区、分区标题写出该组按什么切分、助手回复
 *   明说跨组不能横向对照(ADR-0055),并且组件形态确实随之分化。
 *
 * 主 CI 无 DEEPSEEK_API_KEY,整组自动跳过;本地按需运行:
 *   DEEPSEEK_API_KEY=... [DEEPSEEK_MODEL=...] \
 *     pnpm vitest run apps/platform/tests/ask/suggested-questions.real-model.test.ts
 */

const apiKey = process.env.DEEPSEEK_API_KEY?.trim() ?? '';
const describeEval = apiKey ? describe : describe.skip;

let closeSim: () => Promise<void>;
let dqeEndpoint: string;

beforeAll(async () => {
  const server = createDqeSimServer({ logger: false });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  dqeEndpoint = `http://127.0.0.1:${port}${DQE_EXECUTE_PATH}`;
  closeSim = () =>
    new Promise<void>((resolve, reject) =>
      server.close((cause) => (cause ? reject(cause) : resolve()))
    );
});

afterAll(async () => {
  await closeSim();
});

/** 真实执行端口:生产适配器 → 生产数据网关 → 进程内 DQE 仿真。 */
function simExecutor(): ExecuteDataRequestUnitQuery {
  const environment = { DQE_ENDPOINT: dqeEndpoint };
  const execute = createRunAwareUnitQueryExecutor({
    environment,
    fallbackGateway: createServerDataGateway({ environment, diagnosticsSink: () => {} })
  });
  return (query) => execute(query, undefined);
}

async function runQuestion(question: string, runId: string): Promise<AgentEvent[]> {
  const snapshot = exampleSnapshot();
  const dataContext = { current: async () => snapshot };
  const runner = createAskOrchestrationRunner(
    {
      model: createModelBackedAskModel(
        createDeepSeekModelProvider({
          apiKey,
          ...(process.env.DEEPSEEK_MODEL ? { model: process.env.DEEPSEEK_MODEL } : {}),
          ...(process.env.DEEPSEEK_BASE_URL ? { baseUrl: process.env.DEEPSEEK_BASE_URL } : {})
        })
      ),
      retrieval: createSnapshotAskRetrieval(dataContext),
      verifyUnit: createDataRequestUnitVerification({
        dataContext,
        executeDataRequestUnitQuery: simExecutor()
      }),
      assemblePage: assembleTransientPage
    },
    { runId, timeoutMs: 180_000 }
  );
  return collect(runner.run({ messages: userTurn(question) }));
}

describeEval('建议问题按需验证:真实模型 + 真实取数', () => {
  it.each(SUGGESTED_QUESTIONS.map((entry, index) => ({ ...entry, index })))(
    '$question:铺开 ≥$minComponents 个组件,每个组件都有真实数据行',
    { timeout: 300_000 },
    async ({ question, minComponents, splitBy, minComponentTypes, index }) => {
      const events = await runQuestion(question, `suggested-${index + 1}`);

      // 不阻塞:建议问题点一下就该出页面,不该停在取数核对或缺口确认。
      const blocked = events.find((event) => event.type === 'interaction_required');
      expect(
        blocked === undefined,
        `问题停在人工交互 ${blocked?.type === 'interaction_required' ? blocked.interaction.kind : ''}`
      ).toBe(true);
      const failed = stepEvents(events).find((step) => step.type === 'step_failed');
      expect(
        failed,
        failed?.type === 'step_failed' ? `${failed.code}:${failed.message}` : ''
      ).toBeUndefined();

      const { document, messages } = completedOf(events);
      expect(document).not.toBeNull();
      expect(validate(document!)).toEqual([]);

      const sections = document!.sections as Array<{
        id: string;
        title?: string;
        components: Array<{
          type: string;
          layout: { span: number };
          data?: { main: string };
        }>;
      }>;
      // 承载取数单元的组件;页面级页头不绑数据源,不参与单元与取数断言。
      const components = sections.flatMap((section) =>
        section.components.flatMap((component) =>
          component.data === undefined
            ? []
            : [{ ...component, data: component.data }]
        )
      );
      const dataSources = document!.dataSources as Record<
        string,
        { source: { initial?: { rows: unknown[] } } }
      >;
      const units = parseAskConversation(messages).state.units;
      const unitOf = (dataSourceId: string) =>
        units.find((entry) => entry.dataSourceId === dataSourceId)!;

      // 模型每次输出都不同,失败时必须从报告本身读出这一轮长成什么样:控制台
      // 输出在非交互终端会被吞掉,所以同一份结构也进断言消息。
      const structure =
        `[建议问题 ${index + 1}] ${question}\n` +
        sections
          .map((section) => {
            const rows: string[][] = [];
            let filled = 0;
            for (const component of section.components) {
              if (rows.length === 0 || filled + component.layout.span > 12) {
                rows.push([]);
                filled = 0;
              }
              filled += component.layout.span;
              const label = `${component.type}(${component.layout.span})`;
              rows[rows.length - 1]!.push(
                component.data === undefined
                  ? label
                  : `${label} ← ${unitOf(component.data.main)
                      .unit.metrics.map((metric) =>
                        metric.kind === 'metric' ? metric.name : metric.label
                      )
                      .join('、')} × [${
                      unitOf(component.data.main).unit.groupBy.join('、') || '无维度'
                    }]`
              );
            }
            return (
              `  分区 ${section.id}「${section.title ?? ''}」\n` +
              rows.map((row) => `      行(共 12):${row.join(' | ')}`).join('\n')
            );
          })
          .join('\n');
      console.info(structure);

      // 每个组件都有真实数据行:多单元时每个单元都真的走了一次取数。
      for (const component of components) {
        const rows = dataSources[component.data.main]?.source.initial?.rows ?? [];
        expect(rows.length, `${component.data.main} 没有数据行\n${structure}`).toBeGreaterThan(0);
      }

      // 视角数:一个取数单元一个组件。
      expect(components.length).toBe(units.length);
      expect(components.length, structure).toBeGreaterThanOrEqual(minComponents);

      const scopeOf = (dataSourceId: string): string =>
        JSON.stringify([
          unitOf(dataSourceId).unit.businessDomain,
          [...unitOf(dataSourceId).unit.groupBy].sort(),
          unitOf(dataSourceId).unit.time,
          unitOf(dataSourceId).unit.filters
        ]);

      if (splitBy === undefined) {
        // 单口径问题:多单元必须共用同一业务域、同一分组维度与同一时间窗口,
        // 否则组件之间无法按相同的维度与周期横向对照。
        if (units.length > 1) {
          expect(new Set(components.map((c) => scopeOf(c.data.main))).size, structure).toBe(1);
          // 每个单元承载各自的指标,组件标题彼此可区分。
          expect(new Set(units.map((entry) => entry.unit.title)).size).toBe(units.length);
        }
        return;
      }

      // 跨口径问题:一个口径组一个分区,同分区内口径逐字相同,分区之间必不相同。
      // 页面级页头不承载取数单元,不参与口径分区的断言。
      const scopeSections = sections.filter((section) =>
        section.components.some((component) => component.data !== undefined)
      );
      const sectionScopes = scopeSections.map((section) => {
        const keys = new Set(
          section.components.flatMap((c) =>
            c.data === undefined ? [] : [scopeOf(c.data.main)]
          )
        );
        expect(keys.size, `分区 ${section.id} 混了多组口径\n${structure}`).toBe(1);
        return [...keys][0]!;
      });
      expect(new Set(sectionScopes).size, structure).toBe(scopeSections.length);

      // 分区标题写出该组按什么切分:这是页面自己携带的口径差异。
      const sectionGroupBys = scopeSections.map((section) => {
        const groupBy = unitOf(section.components[0]!.data!.main).unit.groupBy;
        expect(section.title, `分区 ${section.id} 没有标题\n${structure}`).toBeTruthy();
        if (groupBy.length === 0) {
          expect(section.title).toContain('总量');
        } else {
          for (const dimension of groupBy) expect(section.title).toContain(dimension);
        }
        return [...groupBy].sort().join('\u0000');
      });

      // 问题点到的每个切分视角都自成一个分区。
      for (const combination of splitBy) {
        const key = [...combination].sort().join('\u0000');
        expect(
          sectionGroupBys.filter((groupBy) => groupBy === key).length,
          `没有恰好一个按「${combination.join('、')}」切分的分区\n${structure}`
        ).toBe(1);
      }

      // 组件形态随口径分化:这是跨口径问题作为工作台入口的价值所在——
      // 同一口径的多指标问题只会重复同一种组件。
      if (minComponentTypes !== undefined) {
        expect(
          new Set(components.map((component) => component.type)).size,
          structure
        ).toBeGreaterThanOrEqual(minComponentTypes);
      }

      // 助手回复按口径组汇总,并明说跨组不能横向对照。
      const reply = events
        .flatMap((event) => (event.type === 'assistant_message' ? [event.message.content] : []))
        .join('\n');
      expect(reply).toContain(`分属 ${scopeSections.length} 组口径`);
      expect(reply).toContain('跨组不能');
    }
  );
});
