/**
 * 轨道 E ｜ 真实模型探针:一句话 → 取数单元。
 *
 * 单次模型调用(不走多轮工具循环、不碰 agent/runner.ts),验证模型能否在
 * 语义面闭集内把一句话自然语言问题填成结构化取数单元(CONTEXT.md、ADR-0032)。
 * 闭集提示词从 tools/dqe-sim/src/semantic-surface.ts 程序化渲染(真元归一);
 * few-shot 示例从 fixtures/few-shot-examples.json 渲染,与评测样本物理分开
 * (混用防护由 tests/ask/golden-questions.test.ts 的守卫断言承担)。
 *
 * 运行(按需,不进 pnpm test / CI):
 *   pnpm exec tsx --env-file=apps/platform/.env apps/platform/scripts/probe-nl-to-unit.ts
 *   # 黄金问题集评测(#69):同一脚本换评测 fixture
 *   pnpm exec tsx --env-file=apps/platform/.env apps/platform/scripts/probe-nl-to-unit.ts --fixture golden-questions.json
 *
 * 输出:逐条判定 + 命中率汇总打印,JSON 报告写入仓库根 .learnings/(未被 git 跟踪)。
 * 无 Key 时优雅跳过(退出码 0)。报告与日志不得出现 DEEPSEEK_API_KEY 的值,
 * 写报告前有防泄漏断言。
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ToolDefinition } from '@metriccanvas/mcp';
import {
  semanticSurface,
  type BusinessDomain,
  type TimeGranularity
} from '../../../tools/dqe-sim/src/semantic-surface';
import { createDeepSeekModelProvider } from '../src/lib/server/agent/deepseek.server';
import type { ModelProvider } from '../src/lib/server/agent/types';
import { resolveAgentModelConfig } from '../src/lib/server/agent-model-config.server';

// ---------- 模型输出与种子样本的形状 ----------

type ProbeStatus = 'answer' | 'clarify' | 'reject';

interface ProbeFilter {
  dimension: string;
  values: string[];
}

interface ProbeUnit {
  domain: string;
  metrics: string[];
  groupBy: string[];
  filters: ProbeFilter[];
  time: { granularity: string; range: string };
}

interface ProbeOutput {
  status: ProbeStatus;
  unit?: ProbeUnit;
  clarify?: {
    question: string;
    candidates: Array<{ domain: string; metric: string; reason?: string }>;
  };
  reject?: { reason: string };
}

type SeedCategory = 'direct' | 'clarify' | 'no_metric' | 'cross_domain';

interface SeedExpectation {
  status: ProbeStatus;
  /** 可接受的替代状态(如跨域样本 reject 之外也接受 clarify)。 */
  altStatuses?: ProbeStatus[];
  domain?: string;
  metrics?: string[];
  groupBy?: string[];
  /** 可接受的替代分组(多数问题有多个正确解,ADR-0037)。 */
  altGroupBy?: string[][];
  filters?: ProbeFilter[];
  granularity?: TimeGranularity;
  /** 期望时间口径的业务语言表述(黄金问题集,#69);探针不判定具体日期。 */
  timeScope?: string;
  clarifyCandidateDomains?: string[];
}

interface SeedSample {
  id: string;
  category: SeedCategory;
  /** 难度标签(黄金问题集,#69);种子样本可缺省。 */
  difficulty?: 'easy' | 'medium' | 'hard';
  question: string;
  note: string;
  expected: SeedExpectation;
}

interface SampleJudgment {
  id: string;
  category: SeedCategory;
  question: string;
  note: string;
  expected: SeedExpectation;
  parseSource: 'tool_call' | 'content_json' | 'failed';
  actualStatus: ProbeStatus | null;
  statusHit: boolean;
  /** 以下 null 表示不适用(如期望非直答的样本不判域/指标/维度)。 */
  domainHit: boolean | null;
  metricHit: boolean | null;
  dimensionHit: boolean | null;
  filtersHit: boolean | null;
  granularityHit: boolean | null;
  withinClosedSet: boolean | null;
  fabricatedWhenShouldReject: boolean | null;
  clarifyCandidatesCoverExpectedDomains: boolean | null;
  closedSetViolations: string[];
  notes: string[];
  modelOutput: ProbeOutput | null;
  rawFallback?: string;
}

// ---------- 闭集提示词:从语义面程序化渲染 ----------

const allGranularities = [
  ...new Set(semanticSurface.flatMap((domain) => domain.granularities))
];

function renderClosedSet(): string {
  return semanticSurface
    .map((domain) => {
      const dimensions = domain.dimensions
        .map(
          (dim) =>
            `  - ${dim.name}(别名:${dim.aliases.join('、') || '无'}):${dim.description};取值域 [${dim.values.join('、')}]`
        )
        .join('\n');
      const metrics = domain.metrics
        .map(
          (metric) =>
            `  - ${metric.name}(别名:${metric.aliases.join('、') || '无'}):${metric.description};单位 ${metric.unit}`
        )
        .join('\n');
      return [
        `### 业务域「${domain.name}」:${domain.description}`,
        `- 支持的时间粒度:${domain.granularities.join('、')}`,
        `- 时间维度:${domain.timeDimension.name}(别名:${domain.timeDimension.aliases.join('、') || '无'});按时间展开分组时把它写进 groupBy`,
        '- 维度:',
        dimensions,
        '- 指标:',
        metrics
      ].join('\n');
    })
    .join('\n\n');
}

/**
 * few-shot 示例从 fixtures/few-shot-examples.json 渲染(唯一真源):
 * 提示词示例与评测样本物理分开,不得混用同一批问题。
 */
interface FewShotExample {
  question: string;
  toolArguments: Record<string, unknown>;
}

function loadFewShotExamples(): FewShotExample[] {
  const fixturePath = join(scriptDir, 'fixtures', 'few-shot-examples.json');
  const parsed = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
    examples: FewShotExample[];
  };
  return parsed.examples;
}

function renderFewShotExamples(): string {
  return loadFewShotExamples()
    .map(
      (example) =>
        `问题:「${example.question}」\n工具参数:\n${JSON.stringify(example.toolArguments)}`
    )
    .join('\n\n');
}

function buildSystemPrompt(): string {
  return `你是 MetricCanvas(指标画布)的数据分析助手。用户会用一句话提出数据问题,你需要把它解析为一个结构化的「取数单元」:业务域、指标、维度分组、筛选条件、时间范围与粒度。

## 语义面闭集(这是全部可用能力,以下清单之外的指标、维度、取值、粒度一律不存在)

${renderClosedSet()}

## 解析规则

1. 一个取数单元只属于一个业务域;指标名、维度名、维度取值、时间粒度必须逐字取自该业务域的清单。别名可以用来理解问题,但输出时一律使用规范名。
2. 不同业务域的指标与维度不能出现在同一个取数单元里。若问题要求的组合跨域(某域的指标搭配另一域的维度),该组合不可满足,status=reject 并说明原因。
3. 时间粒度必须是所选业务域支持的粒度;用户要求的粒度该域不支持时,不要擅自替换成别的粒度,应 reject(或 clarify 询问是否换粒度)。
4. 找不到能回答问题的指标时 status=reject;不要编造指标,也不要用不相干的指标凑数。
5. 多个业务域存在同名或近义指标、且问题本身无法判定属于哪个域时,status=clarify,在 candidates 里列出各域候选指标及口径差异,不要擅自替用户选择。
6. 问题里出现的维度、维度取值或指标别名可以用来判定业务域;能判定时直接回答,不要过度澄清。
7. 需要按时间展开分组(趋势、每月、每天)时,把时间维度写进 groupBy;time.range 用业务语言描述时间范围(如「最近6个月」「上个月」)。
8. 必须调用工具 submit_data_request_unit 提交结果,不要用普通文本回答。

## 输出示例(与用户问题无关,仅演示输出形状)

${renderFewShotExamples()}`;
}

const submitTool: ToolDefinition = {
  name: 'submit_data_request_unit',
  description:
    '提交对用户问题的解析结果:status=answer 时给出结构化取数单元;status=clarify 时给出澄清问题与候选;status=reject 时给出拒答原因。',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      status: {
        type: 'string',
        enum: ['answer', 'clarify', 'reject'],
        description: 'answer=可直接取数;clarify=需要用户澄清;reject=语义面无法回答'
      },
      unit: {
        type: 'object',
        description: 'status=answer 时必填:结构化取数单元',
        properties: {
          domain: { type: 'string', description: '业务域名称,取自闭集' },
          metrics: {
            type: 'array',
            items: { type: 'string' },
            description: '指标规范名列表,取自所选业务域'
          },
          groupBy: {
            type: 'array',
            items: { type: 'string' },
            description: '分组维度名列表;需要按时间展开时包含该域的时间维度'
          },
          filters: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                dimension: { type: 'string' },
                values: { type: 'array', items: { type: 'string' } }
              },
              required: ['dimension', 'values']
            },
            description: '维度筛选,取值必须来自该维度的取值域;没有则为空数组'
          },
          time: {
            type: 'object',
            properties: {
              granularity: {
                type: 'string',
                enum: allGranularities,
                description: '时间粒度,必须是所选业务域支持的粒度'
              },
              range: {
                type: 'string',
                description: '时间范围的业务描述,如「最近6个月」「上个月」'
              }
            },
            required: ['granularity', 'range']
          }
        },
        required: ['domain', 'metrics', 'groupBy', 'filters', 'time']
      },
      clarify: {
        type: 'object',
        description: 'status=clarify 时必填',
        properties: {
          question: { type: 'string', description: '向用户提出的澄清问题' },
          candidates: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                domain: { type: 'string' },
                metric: { type: 'string' },
                reason: { type: 'string', description: '该候选的口径说明' }
              },
              required: ['domain', 'metric']
            }
          }
        },
        required: ['question', 'candidates']
      },
      reject: {
        type: 'object',
        description: 'status=reject 时必填',
        properties: { reason: { type: 'string' } },
        required: ['reason']
      }
    },
    required: ['status']
  }
};

// ---------- 模型输出解析 ----------

function coerceProbeOutput(value: unknown): ProbeOutput | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const record = value as Record<string, unknown>;
  const status = record.status;
  if (status !== 'answer' && status !== 'clarify' && status !== 'reject') {
    return undefined;
  }
  const output: ProbeOutput = { status };
  if (typeof record.unit === 'object' && record.unit !== null) {
    const unit = record.unit as Record<string, unknown>;
    const time =
      typeof unit.time === 'object' && unit.time !== null
        ? (unit.time as Record<string, unknown>)
        : {};
    output.unit = {
      domain: typeof unit.domain === 'string' ? unit.domain : '',
      metrics: toStringArray(unit.metrics),
      groupBy: toStringArray(unit.groupBy),
      filters: Array.isArray(unit.filters)
        ? unit.filters.flatMap((entry): ProbeFilter[] => {
            if (typeof entry !== 'object' || entry === null) return [];
            const filter = entry as Record<string, unknown>;
            if (typeof filter.dimension !== 'string') return [];
            return [{ dimension: filter.dimension, values: toStringArray(filter.values) }];
          })
        : [],
      time: {
        granularity: typeof time.granularity === 'string' ? time.granularity : '',
        range: typeof time.range === 'string' ? time.range : ''
      }
    };
  }
  if (typeof record.clarify === 'object' && record.clarify !== null) {
    const clarify = record.clarify as Record<string, unknown>;
    output.clarify = {
      question: typeof clarify.question === 'string' ? clarify.question : '',
      candidates: Array.isArray(clarify.candidates)
        ? clarify.candidates.flatMap((entry) => {
            if (typeof entry !== 'object' || entry === null) return [];
            const candidate = entry as Record<string, unknown>;
            return [
              {
                domain: typeof candidate.domain === 'string' ? candidate.domain : '',
                metric: typeof candidate.metric === 'string' ? candidate.metric : '',
                ...(typeof candidate.reason === 'string' ? { reason: candidate.reason } : {})
              }
            ];
          })
        : []
    };
  }
  if (typeof record.reject === 'object' && record.reject !== null) {
    const reject = record.reject as Record<string, unknown>;
    output.reject = { reason: typeof reject.reason === 'string' ? reject.reason : '' };
  }
  return output;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function parseContentJson(content: string): ProbeOutput | undefined {
  const trimmed = content.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(trimmed);
  const candidate = (fenced ? fenced[1] : trimmed).trim();
  const attempts = [candidate];
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start >= 0 && end > start) {
    attempts.push(candidate.slice(start, end + 1));
  }
  for (const attempt of attempts) {
    try {
      const parsed = coerceProbeOutput(JSON.parse(attempt));
      if (parsed) return parsed;
    } catch {
      // 尝试下一个候选片段
    }
  }
  return undefined;
}

// ---------- 闭集解析与判定 ----------

function resolveDomain(name: string | undefined): BusinessDomain | undefined {
  if (!name) return undefined;
  const trimmed = name.trim();
  return semanticSurface.find((domain) => domain.name === trimmed || domain.id === trimmed);
}

/** 指标名/别名 → 规范名;解析不到返回 undefined(即闭集外)。 */
function canonicalMetric(domain: BusinessDomain, name: string): string | undefined {
  const trimmed = name.trim();
  const metric = domain.metrics.find(
    (entry) => entry.name === trimmed || entry.aliases.includes(trimmed)
  );
  return metric?.name;
}

/** 维度名/别名(含时间维度)→ 规范名。 */
function canonicalDimension(domain: BusinessDomain, name: string): string | undefined {
  const trimmed = name.trim();
  if (domain.timeDimension.name === trimmed || domain.timeDimension.aliases.includes(trimmed)) {
    return domain.timeDimension.name;
  }
  const dimension = domain.dimensions.find(
    (entry) => entry.name === trimmed || entry.aliases.includes(trimmed)
  );
  return dimension?.name;
}

function sameSet(actual: string[], expected: string[]): boolean {
  const a = new Set(actual);
  const b = new Set(expected);
  return a.size === b.size && [...a].every((item) => b.has(item));
}

/** 检查取数单元是否整体落在闭集内,返回违规描述列表(空即闭集内)。 */
function collectClosedSetViolations(unit: ProbeUnit): string[] {
  const violations: string[] = [];
  const domain = resolveDomain(unit.domain);
  if (!domain) {
    violations.push(`业务域「${unit.domain}」不在语义面内`);
    return violations;
  }
  for (const metric of unit.metrics) {
    if (!canonicalMetric(domain, metric)) {
      violations.push(`指标「${metric}」不在「${domain.name}」域内`);
    }
  }
  for (const dim of unit.groupBy) {
    if (!canonicalDimension(domain, dim)) {
      violations.push(`分组维度「${dim}」不在「${domain.name}」域内`);
    }
  }
  for (const filter of unit.filters) {
    const canonical = canonicalDimension(domain, filter.dimension);
    if (!canonical) {
      violations.push(`筛选维度「${filter.dimension}」不在「${domain.name}」域内`);
      continue;
    }
    const declared = domain.dimensions.find((entry) => entry.name === canonical);
    if (!declared) {
      violations.push(`筛选维度「${filter.dimension}」是时间维度,不接受取值筛选`);
      continue;
    }
    for (const value of filter.values) {
      if (!declared.values.includes(value)) {
        violations.push(`筛选取值「${value}」不在维度「${canonical}」的取值域内`);
      }
    }
  }
  if (!domain.granularities.includes(unit.time.granularity as TimeGranularity)) {
    violations.push(`时间粒度「${unit.time.granularity}」不被「${domain.name}」域支持`);
  }
  return violations;
}

function normalizeFilter(domain: BusinessDomain | undefined, filter: ProbeFilter): string {
  const dimension = domain ? (canonicalDimension(domain, filter.dimension) ?? filter.dimension) : filter.dimension;
  return `${dimension}=${[...filter.values].sort().join('|')}`;
}

function judgeSample(sample: SeedSample, output: ProbeOutput | null, parseSource: SampleJudgment['parseSource'], rawFallback?: string): SampleJudgment {
  const expected = sample.expected;
  const judgment: SampleJudgment = {
    id: sample.id,
    category: sample.category,
    question: sample.question,
    note: sample.note,
    expected,
    parseSource,
    actualStatus: output?.status ?? null,
    statusHit: false,
    domainHit: null,
    metricHit: null,
    dimensionHit: null,
    filtersHit: null,
    granularityHit: null,
    withinClosedSet: null,
    fabricatedWhenShouldReject: null,
    clarifyCandidatesCoverExpectedDomains: null,
    closedSetViolations: [],
    notes: [],
    modelOutput: output,
    ...(rawFallback !== undefined ? { rawFallback } : {})
  };

  if (!output) {
    judgment.notes.push('模型输出不可解析,全部判定按未命中计');
    if (expected.status === 'answer') {
      judgment.domainHit = false;
      judgment.metricHit = false;
      judgment.dimensionHit = false;
      judgment.filtersHit = false;
      judgment.granularityHit = false;
    }
    if (expected.status === 'reject') {
      judgment.fabricatedWhenShouldReject = false;
    }
    return judgment;
  }

  const acceptable = [expected.status, ...(expected.altStatuses ?? [])];
  judgment.statusHit = acceptable.includes(output.status);
  if (judgment.statusHit && output.status !== expected.status) {
    judgment.notes.push(`以可接受的替代状态命中:期望 ${expected.status},实际 ${output.status}`);
  }

  if (expected.status === 'reject') {
    judgment.fabricatedWhenShouldReject = output.status === 'answer';
    if (judgment.fabricatedWhenShouldReject) {
      judgment.notes.push('该拒答未拒答:模型直接给出了取数单元');
    }
  }

  if (expected.status === 'clarify') {
    if (output.status === 'clarify') {
      const candidateDomains = new Set(
        (output.clarify?.candidates ?? []).map(
          (candidate) => resolveDomain(candidate.domain)?.name ?? candidate.domain
        )
      );
      const required = expected.clarifyCandidateDomains ?? [];
      judgment.clarifyCandidatesCoverExpectedDomains = required.every((domain) =>
        candidateDomains.has(domain)
      );
      if (!judgment.clarifyCandidatesCoverExpectedDomains) {
        judgment.notes.push(
          `澄清候选未覆盖期望域:期望 [${required.join('、')}],实际 [${[...candidateDomains].join('、')}]`
        );
      }
    } else if (output.status === 'answer') {
      judgment.notes.push('近义指标未澄清:模型擅自选择了一个口径直接回答');
    }
  }

  // 只要模型给出了取数单元(无论是否应给),都检查闭集。
  if (output.status === 'answer' && output.unit) {
    judgment.closedSetViolations = collectClosedSetViolations(output.unit);
    judgment.withinClosedSet = judgment.closedSetViolations.length === 0;
  }

  if (expected.status === 'answer') {
    if (output.status !== 'answer' || !output.unit) {
      judgment.domainHit = false;
      judgment.metricHit = false;
      judgment.dimensionHit = false;
      judgment.filtersHit = false;
      judgment.granularityHit = false;
      judgment.notes.push(`可答未答:期望直答,实际 ${output.status}`);
      return judgment;
    }
    const unit = output.unit;
    const actualDomain = resolveDomain(unit.domain);
    judgment.domainHit = actualDomain?.name === expected.domain;
    if (!judgment.domainHit) {
      // 指标/维度名是域内概念,域错时按未命中计,避免同名不同义误判命中。
      judgment.metricHit = false;
      judgment.dimensionHit = false;
      judgment.filtersHit = false;
      judgment.granularityHit = false;
      judgment.notes.push(`域路由错误:期望「${expected.domain}」,实际「${unit.domain}」`);
      return judgment;
    }
    const domain = actualDomain as BusinessDomain;
    const actualMetrics = unit.metrics.map((name) => canonicalMetric(domain, name) ?? name);
    judgment.metricHit = sameSet(actualMetrics, expected.metrics ?? []);
    if (!judgment.metricHit) {
      judgment.notes.push(
        `指标偏差:期望 [${(expected.metrics ?? []).join('、')}],实际 [${unit.metrics.join('、')}]`
      );
    }
    const actualGroupBy = unit.groupBy.map((name) => canonicalDimension(domain, name) ?? name);
    const acceptableGroupBys = [expected.groupBy ?? [], ...(expected.altGroupBy ?? [])];
    judgment.dimensionHit = acceptableGroupBys.some((groupBy) =>
      sameSet(actualGroupBy, groupBy)
    );
    if (!judgment.dimensionHit) {
      judgment.notes.push(
        `维度分组偏差:期望 [${(expected.groupBy ?? []).join('、')}]` +
          (expected.altGroupBy !== undefined && expected.altGroupBy.length > 0
            ? `(替代 ${expected.altGroupBy.map((alt) => `[${alt.join('、')}]`).join(' / ')})`
            : '') +
          `,实际 [${unit.groupBy.join('、')}]`
      );
    } else if (!sameSet(actualGroupBy, expected.groupBy ?? [])) {
      judgment.notes.push('以可接受的替代分组命中');
    }
    judgment.filtersHit = sameSet(
      unit.filters.map((filter) => normalizeFilter(domain, filter)),
      (expected.filters ?? []).map((filter) => normalizeFilter(domain, filter))
    );
    if (!judgment.filtersHit) {
      judgment.notes.push('筛选条件与期望不一致');
    }
    judgment.granularityHit = unit.time.granularity === expected.granularity;
    if (!judgment.granularityHit) {
      judgment.notes.push(
        `时间粒度偏差:期望 ${expected.granularity},实际 ${unit.time.granularity || '(缺失)'}`
      );
    }
  }

  return judgment;
}

// ---------- 汇总与短板清单 ----------

interface RateEntry {
  hit: number;
  total: number;
  rate: string;
}

function rate(hit: number, total: number): RateEntry {
  return {
    hit,
    total,
    rate: total === 0 ? 'n/a' : `${((hit / total) * 100).toFixed(1)}%`
  };
}

function countHits(judgments: SampleJudgment[], pick: (j: SampleJudgment) => boolean | null): RateEntry {
  const applicable = judgments.filter((j) => pick(j) !== null);
  return rate(applicable.filter((j) => pick(j) === true).length, applicable.length);
}

function buildSummary(judgments: SampleJudgment[]) {
  const byCategory: Record<string, RateEntry> = {};
  for (const category of ['direct', 'clarify', 'no_metric', 'cross_domain'] as const) {
    const group = judgments.filter((j) => j.category === category);
    byCategory[category] = rate(group.filter((j) => j.statusHit).length, group.length);
  }
  const shouldReject = judgments.filter((j) => j.expected.status === 'reject');
  const shouldClarify = judgments.filter((j) => j.expected.status === 'clarify');
  return {
    totalSamples: judgments.length,
    parsedSamples: judgments.filter((j) => j.parseSource !== 'failed').length,
    statusHit: rate(judgments.filter((j) => j.statusHit).length, judgments.length),
    domainHit: countHits(judgments, (j) => j.domainHit),
    metricHit: countHits(judgments, (j) => j.metricHit),
    dimensionHit: countHits(judgments, (j) => j.dimensionHit),
    filtersHit: countHits(judgments, (j) => j.filtersHit),
    granularityHit: countHits(judgments, (j) => j.granularityHit),
    withinClosedSet: countHits(judgments, (j) => j.withinClosedSet),
    rejectWhenShould: rate(
      shouldReject.filter((j) => j.actualStatus === 'reject').length,
      shouldReject.length
    ),
    clarifyWhenShould: rate(
      shouldClarify.filter((j) => j.actualStatus === 'clarify').length,
      shouldClarify.length
    ),
    fabricatedWhenShouldReject: shouldReject.filter((j) => j.fabricatedWhenShouldReject === true)
      .length,
    statusHitByCategory: byCategory
  };
}

interface WeaknessEntry {
  kind: string;
  count: number;
  sampleIds: string[];
  detail: string;
}

/** 模型短板清单:按失败类别聚合,作为明天 Agent 架构讨论的输入。 */
function collectWeaknesses(judgments: SampleJudgment[]): WeaknessEntry[] {
  const define: Array<{
    kind: string;
    detail: string;
    match: (j: SampleJudgment) => boolean;
  }> = [
    {
      kind: '近义指标未澄清',
      detail: '需澄清样本被模型擅自选择口径直接回答',
      match: (j) => j.category === 'clarify' && j.actualStatus === 'answer'
    },
    {
      kind: '该拒答未拒答',
      detail: '语义面无法回答的问题被模型编造了取数单元',
      match: (j) => j.fabricatedWhenShouldReject === true
    },
    {
      kind: '跨域组合处理不当',
      detail: '跨域易混样本的状态判断错误(该拒未拒/该答未答/误澄清)',
      match: (j) => j.category === 'cross_domain' && !j.statusHit
    },
    {
      kind: '闭集越界',
      detail: '输出的指标/维度/取值/粒度不在语义面闭集内',
      match: (j) => j.closedSetViolations.length > 0
    },
    {
      kind: '域路由错误',
      detail: '直答时选错业务域',
      match: (j) => j.expected.status === 'answer' && j.actualStatus === 'answer' && j.domainHit === false
    },
    {
      kind: '指标选择偏差',
      detail: '域正确但指标集合与期望不一致',
      match: (j) => j.domainHit === true && j.metricHit === false
    },
    {
      kind: '维度分组偏差',
      detail: '域正确但分组维度与期望不一致',
      match: (j) => j.domainHit === true && j.dimensionHit === false
    },
    {
      kind: '时间粒度偏差',
      detail: '域正确但时间粒度与期望不一致',
      match: (j) => j.domainHit === true && j.granularityHit === false
    },
    {
      kind: '过度拒答或过度澄清',
      detail: '可直答的问题被拒答或澄清',
      match: (j) => j.expected.status === 'answer' && j.actualStatus !== 'answer'
    },
    {
      kind: '澄清候选不完整',
      detail: '澄清了但候选未覆盖全部歧义域',
      match: (j) => j.clarifyCandidatesCoverExpectedDomains === false
    },
    {
      kind: '输出不可解析',
      detail: '模型既未调用工具也未给出可解析 JSON',
      match: (j) => j.parseSource === 'failed'
    }
  ];
  return define
    .map(({ kind, detail, match }) => {
      const matched = judgments.filter(match);
      return {
        kind,
        count: matched.length,
        sampleIds: matched.map((j) => j.id),
        detail
      };
    })
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count);
}

// ---------- 主流程 ----------

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, '..', '..', '..');

/** 评测 fixture 按文件名选择(默认种子样本;黄金问题集传 golden-questions.json)。 */
function resolveFixtureName(argv: string[]): string {
  const flagIndex = argv.indexOf('--fixture');
  if (flagIndex === -1) return 'seed-questions.json';
  const name = argv[flagIndex + 1];
  if (name === undefined || name.startsWith('--')) {
    throw new Error('用法:probe-nl-to-unit.ts [--fixture <fixtures 下的评测样本文件名>]');
  }
  return name;
}

function loadSamples(fixtureName: string): { samples: SeedSample[]; version: string | null } {
  const fixturePath = join(scriptDir, 'fixtures', fixtureName);
  const parsed = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
    samples: SeedSample[];
    version?: string;
  };
  return { samples: parsed.samples, version: parsed.version ?? null };
}

async function callModel(provider: ModelProvider, systemPrompt: string, question: string) {
  const maxAttempts = 2;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await provider.complete({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question }
        ],
        tools: [submitTool]
      });
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }
  }
  throw lastError;
}

function mark(value: boolean | null): string {
  if (value === null) return '-';
  return value ? '✓' : '✗';
}

async function main(): Promise<void> {
  const config = (() => {
    try {
      return resolveAgentModelConfig(process.env);
    } catch (error) {
      console.log(`[probe] 模型配置不可用:${error instanceof Error ? error.message : String(error)}`);
      return undefined;
    }
  })();
  if (!config || config.provider !== 'deepseek') {
    console.log('[probe] 未配置可用的 DeepSeek 模型(需 AGENT_MODEL_PROVIDER=deepseek 且 DEEPSEEK_API_KEY 非空),优雅跳过。');
    console.log('[probe] 运行方式:pnpm exec tsx --env-file=apps/platform/.env apps/platform/scripts/probe-nl-to-unit.ts');
    process.exit(0);
  }

  const provider = createDeepSeekModelProvider({
    apiKey: config.apiKey,
    model: config.model,
    baseUrl: config.baseUrl
  });
  const systemPrompt = buildSystemPrompt();
  const fixtureName = resolveFixtureName(process.argv.slice(2));
  const { samples: seeds, version: fixtureVersion } = loadSamples(fixtureName);
  console.log(
    `[probe] 模型:deepseek / ${config.model};评测 fixture:${fixtureName}` +
      `${fixtureVersion === null ? '' : `(${fixtureVersion})`},样本 ${seeds.length} 条`
  );

  const judgments: SampleJudgment[] = [];
  for (const [index, sample] of seeds.entries()) {
    console.log(
      `\n[${index + 1}/${seeds.length}] ${sample.id}(${sample.category}` +
        `${sample.difficulty === undefined ? '' : `/${sample.difficulty}`})「${sample.question}」`
    );
    let judgment: SampleJudgment;
    try {
      const response = await callModel(provider, systemPrompt, sample.question);
      const toolCall = response.toolCalls.find((call) => call.name === submitTool.name);
      const fromTool = toolCall ? coerceProbeOutput(toolCall.input) : undefined;
      const fromContent = fromTool ? undefined : parseContentJson(response.content);
      const output = fromTool ?? fromContent ?? null;
      const parseSource = fromTool ? 'tool_call' : fromContent ? 'content_json' : 'failed';
      judgment = judgeSample(
        sample,
        output,
        parseSource,
        output ? undefined : response.content.slice(0, 2000)
      );
    } catch (error) {
      console.log(`  模型调用失败:${error instanceof Error ? error.message : String(error)}`);
      judgment = judgeSample(sample, null, 'failed', '(模型调用失败,无输出)');
    }
    judgments.push(judgment);

    const output = judgment.modelOutput;
    if (output?.status === 'answer' && output.unit) {
      console.log(
        `  → answer 域=${output.unit.domain} 指标=[${output.unit.metrics.join('、')}] 分组=[${output.unit.groupBy.join('、')}] 粒度=${output.unit.time.granularity} 范围=${output.unit.time.range}`
      );
    } else if (output?.status === 'clarify') {
      const candidates = (output.clarify?.candidates ?? [])
        .map((candidate) => `${candidate.domain}·${candidate.metric}`)
        .join(' / ');
      console.log(`  → clarify 候选:${candidates || '(无候选)'}`);
    } else if (output?.status === 'reject') {
      console.log(`  → reject:${output.reject?.reason ?? '(无原因)'}`);
    } else {
      console.log('  → 输出不可解析');
    }
    console.log(
      `  判定:状态${mark(judgment.statusHit)} 域${mark(judgment.domainHit)} 指标${mark(judgment.metricHit)} 维度${mark(judgment.dimensionHit)} 筛选${mark(judgment.filtersHit)} 粒度${mark(judgment.granularityHit)} 闭集${mark(judgment.withinClosedSet)}`
    );
    for (const note of judgment.notes) {
      console.log(`  · ${note}`);
    }
  }

  const summary = buildSummary(judgments);
  const weaknesses = collectWeaknesses(judgments);

  console.log('\n========== 命中率汇总 ==========');
  console.log(`状态判断:${summary.statusHit.hit}/${summary.statusHit.total}(${summary.statusHit.rate})`);
  console.log(`域命中:${summary.domainHit.hit}/${summary.domainHit.total}(${summary.domainHit.rate})`);
  console.log(`指标命中:${summary.metricHit.hit}/${summary.metricHit.total}(${summary.metricHit.rate})`);
  console.log(`维度命中:${summary.dimensionHit.hit}/${summary.dimensionHit.total}(${summary.dimensionHit.rate})`);
  console.log(`筛选命中:${summary.filtersHit.hit}/${summary.filtersHit.total}(${summary.filtersHit.rate})`);
  console.log(`粒度命中:${summary.granularityHit.hit}/${summary.granularityHit.total}(${summary.granularityHit.rate})`);
  console.log(`闭集内:${summary.withinClosedSet.hit}/${summary.withinClosedSet.total}(${summary.withinClosedSet.rate},分母为给出取数单元的样本)`);
  console.log(`该拒答且拒答:${summary.rejectWhenShould.hit}/${summary.rejectWhenShould.total}(${summary.rejectWhenShould.rate});其中编造回答 ${summary.fabricatedWhenShouldReject} 条`);
  console.log(`该澄清且澄清:${summary.clarifyWhenShould.hit}/${summary.clarifyWhenShould.total}(${summary.clarifyWhenShould.rate})`);
  console.log('按类别状态命中:');
  for (const [category, entry] of Object.entries(summary.statusHitByCategory)) {
    console.log(`  ${category}:${entry.hit}/${entry.total}(${entry.rate})`);
  }

  console.log('\n========== 模型短板清单 ==========');
  if (weaknesses.length === 0) {
    console.log('本次运行未发现明显短板(样本量小,勿过度解读)');
  }
  for (const weakness of weaknesses) {
    console.log(`- ${weakness.kind} × ${weakness.count}(${weakness.sampleIds.join('、')}):${weakness.detail}`);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    script: 'apps/platform/scripts/probe-nl-to-unit.ts',
    // 评测资产版本随报告落盘,准确率历史才可比较(ADR-0037)。
    fixture: { name: fixtureName, version: fixtureVersion },
    model: { provider: config.provider, model: config.model, baseUrl: config.baseUrl },
    semanticSurfaceDomains: semanticSurface.map((domain) => domain.name),
    summary,
    weaknesses,
    samples: judgments
  };
  const serialized = JSON.stringify(report, null, 2);
  // 防泄漏断言:报告内容不得包含 API Key。
  if (config.apiKey.length > 0 && serialized.includes(config.apiKey)) {
    throw new Error('防泄漏断言失败:报告内容包含 API Key,已中止写入');
  }
  const learningsDir = join(repoRoot, '.learnings');
  mkdirSync(learningsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = join(learningsDir, `probe-nl-to-unit-${stamp}.json`);
  writeFileSync(reportPath, serialized, 'utf8');
  console.log(`\n[probe] JSON 报告已写入:${reportPath}`);
}

main().catch((error) => {
  console.error(`[probe] 运行失败:${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
