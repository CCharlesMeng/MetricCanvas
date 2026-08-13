import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  assembleTransientPage,
  createDataRequestUnitVerification,
  parseDataContextSnapshot,
  type DataContextSnapshot,
  type ExecuteDataRequestUnitQuery
} from '@metriccanvas/mcp';
import type { AgentEvent, AgentMessage } from '../../../src/lib/server/agent/types';
import type { AnalysisStepEvent } from '../../../src/lib/server/session/step-event';
import { createSnapshotAskRetrieval } from '../../../src/lib/server/ask/retrieval';
import type {
  AskDomainRoutingDecision,
  AskDomainRoutingInput,
  AskIntentDecision,
  AskIntentInput,
  AskModelPort,
  AskOrchestrationPorts,
  AskUnitFormingDecision,
  AskUnitFormingInput
} from '../../../src/lib/server/ask/ports';

/**
 * 问数编排测试基座:真实语义面(docs/examples/schema-metadata.example.json)
 * + 脚本化模型决策 + 注入的假执行端口。验真、装配与检索全部使用生产实现,
 * 不启动 SvelteKit、浏览器与真实模型。
 */

const examplePath = fileURLToPath(
  new URL('../../../../../docs/examples/schema-metadata.example.json', import.meta.url)
);

export function exampleSnapshot(): DataContextSnapshot {
  const parsed = parseDataContextSnapshot(JSON.parse(readFileSync(examplePath, 'utf8')));
  if (!parsed.ok) throw new Error('示例快照必须可解析');
  return parsed.snapshot;
}

export interface ScriptedAskModel {
  model: AskModelPort;
  calls: {
    route: AskDomainRoutingInput[];
    unit: AskUnitFormingInput[];
    intent: AskIntentInput[];
  };
}

/** 脚本化模型端口:按调用顺序回放结构化决策;脚本耗尽即抛错(证明阶段被跳过)。 */
export function scriptedAskModel(script: {
  route?: AskDomainRoutingDecision[];
  unit?: AskUnitFormingDecision[];
  intent?: AskIntentDecision[];
}): ScriptedAskModel {
  const queues = {
    route: [...(script.route ?? [])],
    unit: [...(script.unit ?? [])],
    intent: [...(script.intent ?? [])]
  };
  const calls: ScriptedAskModel['calls'] = { route: [], unit: [], intent: [] };
  const take = <T>(queue: T[], stage: string): T => {
    const next = queue.shift();
    if (next === undefined) throw new Error(`scripted ask model:${stage} 决策脚本已耗尽`);
    return next;
  };
  return {
    calls,
    model: {
      async routeDomains(input) {
        calls.route.push(input);
        return take(queues.route, 'routeDomains');
      },
      async formUnit(input) {
        calls.unit.push(input);
        return take(queues.unit, 'formUnit');
      },
      async decideIntent(input) {
        calls.intent.push(input);
        return take(queues.intent, 'decideIntent');
      }
    }
  };
}

/** 假执行端口:按结果字段契约合成确定性数据行(不查任何真实端点)。 */
export function syntheticExecutor(options: {
  rowCount?: number;
  onExecute?: (callIndex: number) => void | Promise<void>;
} = {}): { execute: ExecuteDataRequestUnitQuery; executions: () => number } {
  let executions = 0;
  const rowCount = options.rowCount ?? 3;
  return {
    executions: () => executions,
    async execute(query) {
      executions += 1;
      await options.onExecute?.(executions);
      const rows = Array.from({ length: rowCount }, (_, index) => {
        const row: Record<string, string | number> = {};
        for (const definition of Object.values(query.fieldMappings)) {
          if (definition.role === 'detail') continue;
          if (definition.role === 'measure') {
            row[definition.queryField] = (index + 1) * 10;
          } else if (definition.type === 'date') {
            row[definition.queryField] = `2026-06-0${index + 1}`;
          } else if (definition.type === 'datetime') {
            row[definition.queryField] = `2026-06-0${index + 1}T00:00:00Z`;
          } else {
            row[definition.queryField] = `${definition.queryField}-${index + 1}`;
          }
        }
        return row;
      });
      return { rows, totalCount: rowCount };
    }
  };
}

export interface AskTestPorts {
  ports: AskOrchestrationPorts;
  scripted: ScriptedAskModel;
  executions: () => number;
}

/** 组装一套端口:脚本化模型 + 快照检索 + 真实验真(假执行)+ 真实装配。 */
export function buildAskPorts(input: {
  script: Parameters<typeof scriptedAskModel>[0];
  snapshot?: DataContextSnapshot;
  executor?: { execute: ExecuteDataRequestUnitQuery; executions: () => number };
}): AskTestPorts {
  const snapshot = input.snapshot ?? exampleSnapshot();
  const dataContext = { current: async () => snapshot };
  const scripted = scriptedAskModel(input.script);
  const executor = input.executor ?? syntheticExecutor();
  return {
    scripted,
    executions: executor.executions,
    ports: {
      model: scripted.model,
      retrieval: createSnapshotAskRetrieval(dataContext),
      verifyUnit: createDataRequestUnitVerification({
        dataContext,
        executeDataRequestUnitQuery: executor.execute
      }),
      assemblePage: assembleTransientPage,
      clock: () => new Date('2026-08-13T08:00:00.000Z')
    }
  };
}

export async function collect(events: AsyncIterable<AgentEvent>): Promise<AgentEvent[]> {
  const collected: AgentEvent[] = [];
  for await (const event of events) collected.push(event);
  return collected;
}

export function stepEvents(events: readonly AgentEvent[]): AnalysisStepEvent[] {
  return events.flatMap((event) => (event.type === 'step' ? [event.event] : []));
}

export function stepTypes(events: readonly AgentEvent[]): string[] {
  return stepEvents(events).map((event) => event.type);
}

export function completedOf(events: readonly AgentEvent[]): {
  messages: AgentMessage[];
  document: Record<string, unknown> | null;
} {
  const completed = [...events].reverse().find((event) => event.type === 'completed');
  if (!completed || completed.type !== 'completed') {
    throw new Error('编排未以 completed 收尾');
  }
  return { messages: completed.messages, document: completed.document ?? null };
}

export function interactionOf(events: readonly AgentEvent[]): {
  interaction: { id: string; kind: string; payload: Record<string, unknown> };
  messages: AgentMessage[];
} {
  const event = [...events].reverse().find((entry) => entry.type === 'interaction_required');
  if (!event || event.type !== 'interaction_required') {
    throw new Error('编排未停在人工交互');
  }
  return { interaction: event.interaction, messages: event.messages };
}

export function userTurn(question: string, baseline: AgentMessage[] = []): AgentMessage[] {
  return [...baseline, { role: 'user', content: question }];
}
