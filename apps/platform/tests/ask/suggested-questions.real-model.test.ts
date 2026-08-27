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
    async ({ question, minComponents, index }) => {
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

      const components = (
        document!.sections as Array<{ components: Array<{ type: string; data: { main: string } }> }>
      ).flatMap((section) => section.components);
      const dataSources = document!.dataSources as Record<
        string,
        { source: { initial?: { rows: unknown[] } } }
      >;
      const units = parseAskConversation(messages).state.units;

      // 每个组件都有真实数据行:多单元时每个单元都真的走了一次取数。
      for (const component of components) {
        const rows = dataSources[component.data.main]?.source.initial?.rows ?? [];
        expect(rows.length, `${component.data.main} 没有数据行`).toBeGreaterThan(0);
      }

      // 视角数:一个取数单元一个组件。
      expect(components.length).toBe(units.length);
      expect(components.length).toBeGreaterThanOrEqual(minComponents);

      // 口径一致性:多单元必须共用同一业务域、同一分组维度与同一时间窗口,
      // 否则组件之间无法按相同的维度与周期横向对照。
      if (units.length > 1) {
        const scopeOf = (unit: (typeof units)[number]['unit']) =>
          JSON.stringify({
            businessDomain: unit.businessDomain,
            groupBy: unit.groupBy,
            filters: unit.filters,
            time: unit.time
          });
        expect(new Set(units.map((entry) => scopeOf(entry.unit))).size).toBe(1);
        // 每个单元承载各自的指标,组件标题彼此可区分。
        expect(new Set(units.map((entry) => entry.unit.title)).size).toBe(units.length);
      }

      // 人读报告:模型每次输出都不同,失败时这行是最快的定位入口。
      console.info(
        `[建议问题 ${index + 1}] ${question}\n` +
          units
            .map(
              (entry, position) =>
                `  ${position + 1}. ${components[position]?.type} ← ` +
                `${entry.unit.metrics.map((metric) => (metric.kind === 'metric' ? metric.name : metric.label)).join('、')}` +
                ` × [${entry.unit.groupBy.join('、')}]` +
                ` @ ${entry.unit.time === null ? '不限时间' : `${entry.unit.time.start}~${entry.unit.time.end}/${entry.unit.time.granularity}`}`
            )
            .join('\n')
      );
    }
  );
});

/**
 * 报表复刻问题:一句话要一份多口径的月报。这类问题的验收点不是「口径一致」
 * 而是「口径差异说清了」——一个口径组一个内容分区、分区标题写出该组按什么
 * 切分、助手回复明说跨组不能横向对照(ADR-0055)。
 *
 * 它们不在工作台的建议问题里:形状可表达不等于内容值得当默认入口。
 */
const REPORT_REPLICATION_QUESTIONS = [
  {
    question:
      '请做一份2026年上半年的Tokens运营月报:整体的Tokens消耗量、计费Tokens量和Tokens请求量总量,每个月的Tokens消耗量走势,各区域的Tokens消耗量对比,以及各模型的Tokens消耗量占比',
    // 判据是问题点到的每个切分视角各自成一个分区,不是分区总数:模型偶尔会把
    // 「总量」也按统计周期切,那一轮就少一组,数都对。组件数同样不作判据——
    // 同一口径下的多个指标合成一张指标卡是对的。
    splitBy: ['统计周期', '区域', '模型']
  },
  {
    question:
      '复刻一份2026年上半年的客户经营月报:整体的新增客户数和流失客户数总量,每个月的新增客户数走势,各行业的新增客户数对比,各客户级别的客户留存率对比',
    splitBy: ['统计周期', '行业', '客户级别']
  }
] as const;

describeEval('报表复刻按需验证:跨口径的一整页说得清', () => {
  it.each(REPORT_REPLICATION_QUESTIONS.map((entry, index) => ({ ...entry, index })))(
    '$question:每个切分视角各占一个分区',
    { timeout: 300_000 },
    async ({ question, splitBy, index }) => {
      const events = await runQuestion(question, `report-${index + 1}`);

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
        components: Array<{ type: string; data: { main: string } }>;
      }>;
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
        `[报表复刻 ${index + 1}] ${question}\n` +
        sections
          .map(
            (section) =>
              `  分区 ${section.id}「${section.title}」:` +
              section.components
                .map(
                  (component) =>
                    `${component.type} ← ${component.data.main}` +
                    ` [${unitOf(component.data.main).unit.groupBy.join('、') || '无维度'}]`
                )
                .join(' + ')
          )
          .join('\n');
      console.info(structure);

      const components = sections.flatMap((section) => section.components);
      expect(components.length).toBe(units.length);
      for (const component of components) {
        const rows = dataSources[component.data.main]?.source.initial?.rows ?? [];
        expect(rows.length, `${component.data.main} 没有数据行`).toBeGreaterThan(0);
      }

      // 一个口径组一个分区:同分区内的单元口径逐字相同,分区之间必不相同。
      const scopeKeyOf = (dataSourceId: string): string => {
        const unit = unitOf(dataSourceId).unit;
        return JSON.stringify([
          unit.businessDomain,
          [...unit.groupBy].sort(),
          unit.time,
          unit.filters
        ]);
      };
      const sectionScopeKeys = sections.map((section) => {
        const keys = new Set(section.components.map((c) => scopeKeyOf(c.data.main)));
        expect(keys.size, `分区 ${section.id} 混了多组口径`).toBe(1);
        return [...keys][0]!;
      });
      expect(new Set(sectionScopeKeys).size).toBe(sections.length);

      // 分区标题写出该组按什么切分:这是页面自己携带的口径差异。
      const sectionGroupBys = sections.map((section) => {
        const groupBy = unitOf(section.components[0]!.data.main).unit.groupBy;
        expect(section.title, `分区 ${section.id} 没有标题`).toBeTruthy();
        if (groupBy.length === 0) {
          expect(section.title).toContain('总量');
        } else {
          for (const dimension of groupBy) expect(section.title).toContain(dimension);
        }
        return groupBy;
      });

      // 问题点到的每个切分视角都自成一个分区。
      for (const dimension of splitBy) {
        expect(
          sectionGroupBys.filter((groupBy) => groupBy.length === 1 && groupBy[0] === dimension)
            .length,
          `没有恰好一个按${dimension}切分的分区\n${structure}`
        ).toBe(1);
      }

      // 助手回复按口径组汇总,并明说跨组不能横向对照。
      const reply = events
        .flatMap((event) => (event.type === 'assistant_message' ? [event.message.content] : []))
        .join('\n');
      expect(reply).toContain(`分属 ${sections.length} 组口径`);
      expect(reply).toContain('跨组不能');
    }
  );
});
