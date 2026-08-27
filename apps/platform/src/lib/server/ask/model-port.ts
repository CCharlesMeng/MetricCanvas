import type { DomainSemanticSurface, ToolDefinition } from '@metriccanvas/mcp';
import type { ModelProvider } from '../agent/types';
import { ANALYSIS_INTENTS } from '../session/step-event';
import type {
  AskDataRequestUnitState,
  AskDomainRoutingDecision,
  AskDomainRoutingInput,
  AskIntentDecision,
  AskIntentInput,
  AskModelPort,
  AskUnitFormingDecision,
  AskUnitFormingInput,
  AskUnitGapAspect,
  AskUnitMetric,
  AskUnitOperation,
  AskUnitPatch
} from './ports';

/**
 * 模型端口的 ModelProvider 适配:把三个编排阶段的结构化决策各映射为一次
 * 非流式模型调用(deepseek.server.ts 或确定性 scripted 提供方)。
 *
 * 上下文裁剪在这里落地:域路由只注入域清单;口径成形只注入命中域的语义面
 * 投影与 top-N 候选卡;意图判定只注入取数单元摘要。每次调用要求模型以
 * 工具参数提交结构化结果,输出不可解析按单次失败抛出,由编排层的
 * 每阶段一次重试纪律兜底。
 */

export class AskModelOutputError extends Error {}

export function createModelBackedAskModel(provider: ModelProvider): AskModelPort {
  return {
    async routeDomains(input) {
      const response = await provider.complete({
        messages: [
          { role: 'system', content: routingPrompt(input) },
          { role: 'user', content: input.question }
        ],
        tools: [ROUTE_TOOL],
        ...(input.signal ? { signal: input.signal } : {})
      });
      return parseRouting(structuredOutput(response.toolCalls, ROUTE_TOOL.name, response.content));
    },

    async formUnit(input) {
      const response = await provider.complete({
        messages: [
          { role: 'system', content: unitPrompt(input) },
          { role: 'user', content: input.question }
        ],
        tools: [UNIT_TOOL],
        ...(input.signal ? { signal: input.signal } : {})
      });
      return parseUnitDecision(
        structuredOutput(response.toolCalls, UNIT_TOOL.name, response.content),
        input.previousUnits.length > 0
      );
    },

    async decideIntent(input) {
      const response = await provider.complete({
        messages: [
          { role: 'system', content: intentPrompt(input) },
          { role: 'user', content: input.question }
        ],
        tools: [INTENT_TOOL],
        ...(input.signal ? { signal: input.signal } : {})
      });
      return parseIntent(structuredOutput(response.toolCalls, INTENT_TOOL.name, response.content));
    }
  };
}

/* ---------- 提示词(注入内容 = 上下文裁剪后的检索结果) ---------- */

function routingPrompt(input: AskDomainRoutingInput): string {
  const inventory = input.domains
    .map((domain) => `- ${domain.name}:${domain.description}`)
    .join('\n');
  return [
    '你是 MetricCanvas(指标画布)的业务域路由器。把用户的一句业务问题归入最相关的一到两个业务域。',
    '',
    '## 业务域清单(只能从这里选择)',
    inventory,
    '',
    '规则:必须调用工具 route_business_domains 提交结果;businessDomains 取业务域名原文,至多两个;无法判断时给出最可能的候选域,不要留空。'
  ].join('\n');
}

function unitPrompt(input: AskUnitFormingInput): string {
  const sections = [
    '你是 MetricCanvas(指标画布)的取数单元编排器。把用户的业务问题在语义面闭集内填成结构化取数单元:业务域、指标、分组维度、筛选条件、时间范围与粒度。',
    '',
    '## 语义面闭集(以下清单之外的指标、维度、取值、粒度一律不存在)',
    renderSurfaces(input.surfaces),
    '',
    '## 检索候选卡(确定性检索的排序结果)',
    input.candidates.length === 0
      ? '(没有命中任何指标条目)'
      : input.candidates
          .map(
            (candidate) =>
              `- ${candidate.businessDomain}·${candidate.metricName}(命中词「${candidate.matchedTerm}」):${candidate.definition}`
          )
          .join('\n'),
    '',
    input.selectedMetrics.length > 0
      ? `## 已确定选中的指标(消歧已完成,不得替换)\n${input.selectedMetrics
          .map((metric) => `- ${metric.businessDomain}·${metric.metricName}`)
          .join('\n')}`
      : '## 注意:候选存在近义歧义或未命中时,不要自行挑选指标;歧义候选一律不写入 metrics,由用户在取数核对上确认。',
    '',
    '## 规则',
    '1. 指标名、维度名、维度取值、时间粒度必须逐字取自语义面;别名用于理解,输出一律用规范名。',
    '2. 一个取数单元只属于一个业务域;跨域组合不可满足时 outcome=out_of_scope 并说明原因。',
    '3. 找不到指标但可用既有指标以 formula 组合出口径时,写入 kind=formula 的指标项,并显式声明 label 与 unit;完全无法回答时 outcome=out_of_scope,不得编造。',
    '4. 问题里只有一部分能回答时:能答的部分照常写入取数单元,答不了的部分写入 gaps(aspect=缺失口径的业务描述,reason=原因);绝不把答不了的部分混进取数单元。',
    '5. time.providedBy:问题原文明确给出时间范围时为 user;由你补全默认时间时为 model;不需要时间过滤时 time=null。',
    '6. 需要按时间展开(趋势、每月、每天)时,把该域的时间维度写入 groupBy。',
    '7. 必须调用工具 submit_data_request_unit 提交结果,不要用普通文本回答。'
  ];
  if (input.previousUnits.length > 0) {
    sections.push(
      '',
      '## 定向单元操作(追问轮)',
      '当前生效的取数单元集合(每个单元对应页面上的一个组件):',
      ...input.previousUnits.map(
        (binding) => `- ${binding.dataSourceId}:${JSON.stringify(binding.unit)}`
      ),
      input.targetDataSourceId !== null
        ? `用户当前选中了单元 ${input.targetDataSourceId} 对应的组件:「这个」「它」等指代默认指向该单元。`
        : '',
      'outcome=operations,operations 是定向单元操作数组,一轮可含多个操作:',
      '- {op:"add", unit:完整取数单元}:用户要求增加一个新的展示(「再加一个」「增加流失客户的走势」),不要把新指标塞进既有单元;',
      '- {op:"modify", dataSourceId, patch}:对指定单元做定向修改,patch 只包含要改变的字段(可同时改指标、筛选、时间等多层);',
      '- {op:"replace", dataSourceId, unit}:指定单元的口径整体重来(「换成完全不同的指标」);',
      '- {op:"remove", dataSourceId}:删除指定单元。',
      '「分别展示 A 和 B」「拆成两个」= 拆分:modify 原单元只保留一个指标 + add 一个承载另一个指标的新单元。',
      '「合并成一个」「放到一张图里」= 合并:remove 被并入的单元 + modify 保留单元把两边的指标并齐;合并是结构操作,必须输出这两个操作,不要返回空数组。',
      '未被用户提及的单元与字段绝对不要出现在 operations 里(未提及的显式设置保持不变);只换展示形态、不改口径时返回空数组 []。'
    );
  } else {
    sections.push(
      '',
      '## 首轮:视角数量决定单元数量',
      '一个取数单元对应页面上的一个组件。问题只问一个视角时 outcome=unit,给出完整取数单元。',
      '问题一次问了多个指标或多个视角(「A、B、C 分别是多少」「总览」「大盘」「同时看」)时,' +
        'outcome=operations,每个视角一个 {op:"add", unit:完整取数单元}。',
      '一个单元只承载一个指标——问对比是这样,问趋势也是这样,' +
        '只有问题明确要求把若干指标放进同一个视角(「放在一张图里」「叠在一起看」)才合并;' +
        '单位不同的指标(Token 与 次、家 与 %)一律不得合并,同一张图叠不同单位会误导。',
      '拆成多个单元时必须口径一致,否则组件之间无法横向对照:',
      '- 全部单元同一业务域、同一 groupBy、同一 time(起止与粒度逐字相同),' +
        '除非问题明确要求不同的维度或周期;',
      '- 每个单元的 title 是该视角的业务标题(含指标名),彼此不重复;',
      '- 单元只覆盖问题实际问到的指标,至多 6 个;不要为了铺满页面自行添加问题没问的指标。'
    );
  }
  if (input.violationFeedback !== undefined && input.violationFeedback.length > 0) {
    sections.push(
      '',
      '## 清单校验违规反馈(修复后重新提交)',
      input.violationFeedback.map((entry) => `- ${entry}`).join('\n')
    );
  }
  return sections.join('\n');
}

function intentPrompt(input: AskIntentInput): string {
  return [
    '你是 MetricCanvas(指标画布)的分析意图判定器。根据用户问题与取数单元,从闭集中选择一个分析意图。',
    '',
    `意图闭集:${ANALYSIS_INTENTS.join('、')}(comparison=对比,trend=趋势,composition=构成,ranking=排名,detail=明细,single_value=单值)。`,
    `取数单元:${JSON.stringify({
      metrics: input.unit.metrics,
      groupBy: input.unit.groupBy,
      time: input.unit.time
    })}`,
    input.previousIntent !== null
      ? `上一轮意图为 ${input.previousIntent};本轮问题未提及展示变化时保持不变。`
      : '',
    '必须调用工具 submit_analysis_intent 提交结果。'
  ].join('\n');
}

function renderSurfaces(surfaces: readonly DomainSemanticSurface[]): string {
  return surfaces
    .map((surface) => {
      const dimensions = surface.dimensions
        .map(
          (dimension) =>
            `  - ${dimension.name}(别名:${dimension.aliases.join('、') || '无'}):${dimension.description}` +
            (dimension.values !== undefined
              ? `;取值域 [${dimension.values.join('、')}]`
              : dimension.sensitive
                ? ';敏感字段,取值域不可见,不得对其做取值筛选'
                : '')
        )
        .join('\n');
      const metrics = surface.metrics
        .map(
          (metric) =>
            `  - ${metric.name}(别名:${metric.aliases.join('、') || '无'}):${metric.description}` +
            (metric.unit !== undefined ? `;单位 ${metric.unit}` : '')
        )
        .join('\n');
      const timeDimensions = surface.timeDimensions
        .map(
          (dimension) =>
            `  - ${dimension.name}(别名:${dimension.aliases.join('、') || '无'});支持粒度:${dimension.granularities.join('、')}`
        )
        .join('\n');
      return [
        `### 业务域「${surface.businessDomain}」:${surface.description}`,
        '- 时间维度:',
        timeDimensions || '  (无)',
        '- 维度:',
        dimensions || '  (无)',
        '- 指标:',
        metrics || '  (无)'
      ].join('\n');
    })
    .join('\n\n');
}

/* ---------- 工具契约与结构化输出解析 ---------- */

const ROUTE_TOOL: ToolDefinition = {
  name: 'route_business_domains',
  description: '提交问题所属的一到两个业务域。',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      businessDomains: {
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
        maxItems: 2,
        description: '业务域名原文,取自域清单'
      }
    },
    required: ['businessDomains']
  }
};

const METRIC_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    kind: { type: 'string', enum: ['metric', 'formula'] },
    name: { type: 'string', description: 'kind=metric 时的指标规范名' },
    expression: { type: 'string', description: 'kind=formula 时的表达式' },
    label: { type: 'string', description: 'kind=formula 时的输出字段名/标签' },
    unit: { type: 'string' },
    description: { type: 'string' }
  },
  required: ['kind']
} as const;

const UNIT_FIELDS_SCHEMA = {
  metrics: { type: 'array', items: METRIC_ITEM_SCHEMA },
  groupBy: { type: 'array', items: { type: 'string' } },
  filters: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        dimension: { type: 'string' },
        values: { type: 'array', items: { type: 'string' } }
      },
      required: ['dimension', 'values']
    }
  },
  time: {
    type: ['object', 'null'],
    properties: {
      granularity: { type: 'string' },
      start: { type: 'string' },
      end: { type: 'string' },
      providedBy: { type: 'string', enum: ['user', 'model'] }
    },
    required: ['granularity', 'start', 'end', 'providedBy']
  },
  title: { type: 'string' }
} as const;

const UNIT_SCHEMA = {
  type: 'object',
  properties: {
    businessDomain: { type: 'string' },
    ...UNIT_FIELDS_SCHEMA
  },
  required: ['businessDomain', 'metrics', 'groupBy', 'filters', 'time']
} as const;

const UNIT_TOOL: ToolDefinition = {
  name: 'submit_data_request_unit',
  description:
    '提交口径成形结果:outcome=unit 给出完整取数单元(首轮);outcome=operations 给出定向单元操作数组(追问轮);outcome=out_of_scope 说明语义面无法回答的原因。',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      outcome: { type: 'string', enum: ['unit', 'patch', 'operations', 'out_of_scope'] },
      unit: UNIT_SCHEMA,
      patch: {
        type: 'object',
        description: '只包含要改变的字段',
        properties: UNIT_FIELDS_SCHEMA
      },
      operations: {
        type: 'array',
        description:
          '定向单元操作数组:add 新增单元(不指定 dataSourceId)、modify 定向修改、replace 整单元重写、remove 删除;未提及的单元不出现',
        items: {
          type: 'object',
          properties: {
            op: { type: 'string', enum: ['add', 'modify', 'replace', 'remove'] },
            dataSourceId: {
              type: 'string',
              description: 'modify / replace / remove 的目标单元(取自当前单元集合)'
            },
            unit: UNIT_SCHEMA,
            patch: {
              type: 'object',
              description: 'modify 时只包含要改变的字段',
              properties: UNIT_FIELDS_SCHEMA
            }
          },
          required: ['op']
        }
      },
      gaps: {
        type: 'array',
        description: '问题里语义面无法回答的部分;能答的部分仍以 unit/patch 给出',
        items: {
          type: 'object',
          properties: {
            aspect: { type: 'string', description: '缺失口径的业务描述' },
            reason: { type: 'string' }
          },
          required: ['aspect', 'reason']
        }
      },
      reason: { type: 'string' }
    },
    required: ['outcome']
  }
};

const INTENT_TOOL: ToolDefinition = {
  name: 'submit_analysis_intent',
  description: '提交分析意图。',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      intent: { type: 'string', enum: [...ANALYSIS_INTENTS] }
    },
    required: ['intent']
  }
};

function structuredOutput(
  toolCalls: ReadonlyArray<{ name: string; input: unknown }>,
  toolName: string,
  content: string
): unknown {
  const call = toolCalls.find((entry) => entry.name === toolName);
  if (call) return call.input;
  // 容错:模型未走工具时尝试从正文解析 JSON(与探针一致的兜底)。
  const trimmed = content.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/u.exec(trimmed);
  const candidate = (fenced ? fenced[1]! : trimmed).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  for (const attempt of [candidate, start >= 0 && end > start ? candidate.slice(start, end + 1) : '']) {
    if (attempt === '') continue;
    try {
      return JSON.parse(attempt);
    } catch {
      // 尝试下一个片段
    }
  }
  throw new AskModelOutputError(`模型未产出 ${toolName} 的结构化结果`);
}

function parseRouting(value: unknown): AskDomainRoutingDecision {
  if (!isRecord(value) || !Array.isArray(value.businessDomains)) {
    throw new AskModelOutputError('域路由输出缺少 businessDomains 数组');
  }
  const businessDomains = value.businessDomains.filter(
    (entry): entry is string => typeof entry === 'string' && entry.trim() !== ''
  );
  if (businessDomains.length === 0) {
    throw new AskModelOutputError('域路由输出为空');
  }
  return { businessDomains };
}

function parseUnitDecision(value: unknown, hasPrevious: boolean): AskUnitFormingDecision {
  if (!isRecord(value)) throw new AskModelOutputError('口径成形输出不是对象');
  switch (value.outcome) {
    case 'out_of_scope':
      return {
        outcome: 'out_of_scope',
        reason: typeof value.reason === 'string' ? value.reason : '语义面内没有可回答的口径'
      };
    case 'patch': {
      if (!hasPrevious) throw new AskModelOutputError('首轮不接受 patch,必须给出完整取数单元');
      const gaps = parseGapAspects(value.gaps);
      return {
        outcome: 'patch',
        patch: parsePatch(value.patch),
        ...(gaps.length === 0 ? {} : { gaps })
      };
    }
    case 'operations': {
      const operations = parseOperations(value.operations);
      if (!hasPrevious && !operations.every((operation) => operation.op === 'add')) {
        throw new AskModelOutputError('首轮只接受新增单元操作,必须给出完整取数单元');
      }
      const gaps = parseGapAspects(value.gaps);
      return { outcome: 'operations', operations, ...(gaps.length === 0 ? {} : { gaps }) };
    }
    case 'unit': {
      const unit = parseUnit(value.unit);
      const gaps = parseGapAspects(value.gaps);
      return { outcome: 'unit', unit, ...(gaps.length === 0 ? {} : { gaps }) };
    }
    default:
      throw new AskModelOutputError('口径成形输出缺少合法 outcome');
  }
}

function parseOperations(value: unknown): AskUnitOperation[] {
  if (!Array.isArray(value)) {
    throw new AskModelOutputError('outcome=operations 必须携带 operations 数组');
  }
  return value.map((entry): AskUnitOperation => {
    if (!isRecord(entry)) throw new AskModelOutputError('单元操作不是对象');
    switch (entry.op) {
      case 'add':
        return { op: 'add', unit: parseUnit(entry.unit) };
      case 'replace':
        return {
          op: 'replace',
          dataSourceId: operationTargetOf(entry),
          unit: parseUnit(entry.unit)
        };
      case 'modify':
        return {
          op: 'modify',
          dataSourceId: operationTargetOf(entry),
          patch: parsePatch(entry.patch)
        };
      case 'remove':
        return { op: 'remove', dataSourceId: operationTargetOf(entry) };
      default:
        throw new AskModelOutputError('单元操作缺少合法 op');
    }
  });
}

function operationTargetOf(entry: Record<string, unknown>): string {
  if (typeof entry.dataSourceId !== 'string' || entry.dataSourceId === '') {
    throw new AskModelOutputError(`单元操作 ${String(entry.op)} 缺少目标 dataSourceId`);
  }
  return entry.dataSourceId;
}

function parseGapAspects(value: unknown): AskUnitGapAspect[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) =>
    isRecord(entry) && typeof entry.aspect === 'string' && typeof entry.reason === 'string'
      ? [{ aspect: entry.aspect, reason: entry.reason }]
      : []
  );
}

function parseUnit(value: unknown): AskDataRequestUnitState {
  if (!isRecord(value) || typeof value.businessDomain !== 'string') {
    throw new AskModelOutputError('取数单元缺少 businessDomain');
  }
  const patch = parsePatch(value);
  return {
    businessDomain: value.businessDomain,
    metrics: patch.metrics ?? [],
    groupBy: patch.groupBy ?? [],
    filters: patch.filters ?? [],
    time: patch.time ?? null,
    ...(patch.title === undefined ? {} : { title: patch.title })
  };
}

function parsePatch(value: unknown): AskUnitPatch {
  if (!isRecord(value)) return {};
  const patch: AskUnitPatch = {};
  if (Array.isArray(value.metrics)) {
    patch.metrics = value.metrics.flatMap((entry): AskUnitMetric[] => {
      if (!isRecord(entry)) return [];
      if (entry.kind === 'metric' && typeof entry.name === 'string') {
        return [{ kind: 'metric', name: entry.name }];
      }
      if (
        entry.kind === 'formula' &&
        typeof entry.expression === 'string' &&
        typeof entry.label === 'string'
      ) {
        return [
          {
            kind: 'formula',
            expression: entry.expression,
            label: entry.label,
            ...(typeof entry.unit === 'string' ? { unit: entry.unit } : {}),
            ...(typeof entry.description === 'string' ? { description: entry.description } : {})
          }
        ];
      }
      return [];
    });
  }
  if (Array.isArray(value.groupBy)) {
    patch.groupBy = value.groupBy.filter((entry): entry is string => typeof entry === 'string');
  }
  if (Array.isArray(value.filters)) {
    patch.filters = value.filters.flatMap((entry) => {
      if (!isRecord(entry) || typeof entry.dimension !== 'string' || !Array.isArray(entry.values)) {
        return [];
      }
      return [
        {
          dimension: entry.dimension,
          values: entry.values.map((item) => String(item))
        }
      ];
    });
  }
  if ('time' in value) {
    if (value.time === null) {
      patch.time = null;
    } else if (isRecord(value.time)) {
      const time = value.time;
      if (
        typeof time.granularity === 'string' &&
        typeof time.start === 'string' &&
        typeof time.end === 'string'
      ) {
        patch.time = {
          granularity: time.granularity,
          start: time.start,
          end: time.end,
          providedBy: time.providedBy === 'user' ? 'user' : 'model'
        };
      }
    }
  }
  if (typeof value.title === 'string') patch.title = value.title;
  return patch;
}

function parseIntent(value: unknown): AskIntentDecision {
  if (
    isRecord(value) &&
    typeof value.intent === 'string' &&
    (ANALYSIS_INTENTS as readonly string[]).includes(value.intent)
  ) {
    return { intent: value.intent as AskIntentDecision['intent'] };
  }
  throw new AskModelOutputError('分析意图输出不在闭集内');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
