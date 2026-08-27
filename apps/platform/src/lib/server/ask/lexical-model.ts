import type { DomainSemanticSurface } from '@metriccanvas/mcp';
import type {
  AskDataRequestUnitState,
  AskModelPort,
  AskUnitFilter,
  AskUnitMetric,
  AskUnitTime
} from './ports';

/**
 * 无外部模型时的确定性回退(与 scripted-model.server.ts 同一定位):
 * 按字面命中在注入的语义面内填取数单元。只回答能从问题原文字面解析的
 * 组合,解析不出指标时如实 out_of_scope——回退实现绝不编造(ADR-0036)。
 *
 * 它同时是编排端口形状的一个最小真实实现:域路由按域内名称/别名命中计分,
 * 意图判定按关键词,时间范围支持少量常用说法(注入时钟保证可测)。
 */

export interface LexicalAskModelOptions {
  /** 相对时间说法(上个月、最近N个月)的求值时钟;测试注入固定时钟。 */
  clock?: () => Date;
}

export function createLexicalAskModel(options: LexicalAskModelOptions = {}): AskModelPort {
  const clock = options.clock ?? (() => new Date());
  return {
    async routeDomains({ question, domains }) {
      // 域清单阶段只有名称与描述:按问题二元词组在名称+描述中的覆盖度计分,
      // 全部落空时保留全部候选(检索与消歧在后续阶段用语义面裁决)。
      const grams = bigramsOf(question);
      const scored = domains
        .map((domain) => {
          const haystack = domain.name + domain.description;
          return {
            name: domain.name,
            score:
              (question.includes(domain.name) ? 10 : 0) +
              grams.filter((gram) => haystack.includes(gram)).length
          };
        })
        .sort((left, right) => right.score - left.score);
      const positive = scored.filter((entry) => entry.score > 0);
      const chosen = (positive.length > 0 ? positive : scored).slice(0, 2);
      return { businessDomains: chosen.map((entry) => entry.name) };
    },

    async formUnit({ question, surfaces, selectedMetrics, previousUnits, targetDataSourceId }) {
      // 追问轮的定向增量:回退实现支持「增加/新增」字面的新增单元与
      // 时间/筛选的字面替换,其余追问按目标单元重新成形(仍在语义面内)。
      const baseline =
        previousUnits.find((binding) => binding.dataSourceId === targetDataSourceId) ??
        previousUnits[0];
      const metrics: AskUnitMetric[] = [];
      let domain: DomainSemanticSurface | undefined;
      for (const selection of selectedMetrics) {
        metrics.push({ kind: 'metric', name: selection.metricName });
        domain ??= surfaces.find(
          (surface) => surface.businessDomain === selection.businessDomain
        );
      }
      if (domain === undefined) {
        domain = surfaces.find((surface) =>
          surface.metrics.some((metric) => hitTerm(question, metric.name, metric.aliases))
        );
      }
      if (domain === undefined) {
        if (baseline !== undefined) {
          // 无新指标线索的追问:沿用目标单元的域,仅尝试时间/筛选补丁。
          const previousDomain = surfaces.find(
            (surface) => surface.businessDomain === baseline.unit.businessDomain
          );
          if (previousDomain !== undefined) {
            return {
              outcome: 'patch',
              patch: {
                ...timePatch(question, previousDomain, clock),
                ...filterPatch(question, previousDomain)
              }
            };
          }
        }
        return {
          outcome: 'out_of_scope',
          reason: '问题未命中语义面内的任何指标名或别名,确定性回退不做推测'
        };
      }
      if (metrics.length === 0) {
        for (const metric of domain.metrics) {
          if (hitTerm(question, metric.name, metric.aliases)) {
            metrics.push({ kind: 'metric', name: metric.name });
          }
        }
      }

      const groupBy: string[] = [];
      for (const dimension of domain.dimensions) {
        if (hitTerm(question, dimension.name, dimension.aliases)) {
          const filtered = dimension.values?.some((value) => question.includes(value)) ?? false;
          if (!filtered) groupBy.push(dimension.name);
        }
      }
      const timeDimension = domain.timeDimensions[0];
      if (timeDimension && /趋势|走势|每月|每天|每日|按月|按日/u.test(question)) {
        groupBy.push(timeDimension.name);
      }

      const unit: AskDataRequestUnitState = {
        businessDomain: domain.businessDomain,
        metrics,
        groupBy,
        filters: filterPatch(question, domain).filters ?? [],
        time: timePatch(question, domain, clock).time ?? null,
        title: question
      };
      if (previousUnits.length === 0 && metrics.length > 1) {
        // 首轮命中多个指标即多个视角:一个指标一个单元,口径(分组、筛选、
        // 时间)逐字共用,组件之间才能横向对照。
        return {
          outcome: 'operations',
          operations: metrics.map((metric) => ({
            op: 'add',
            unit: {
              ...unit,
              metrics: [metric],
              title: metric.kind === 'metric' ? metric.name : metric.label
            }
          }))
        };
      }
      if (previousUnits.length > 0 && /增加|新增一个|再加|添加|加一个/u.test(question)) {
        // 「增加一个……」的字面即新增单元:不把新指标塞进既有单元。
        // 问题没给分组/时间时沿用基线单元的口径(同轴对照是常见诉求)。
        const inherited: AskDataRequestUnitState = {
          ...unit,
          groupBy: unit.groupBy.length > 0 ? unit.groupBy : [...(baseline?.unit.groupBy ?? [])],
          time: unit.time ?? baseline?.unit.time ?? null
        };
        return { outcome: 'operations', operations: [{ op: 'add', unit: inherited }] };
      }
      // 命中新指标线索时按完整单元重新成形(追问轮定向到目标单元)。
      return { outcome: 'unit', unit };
    },

    async decideIntent({ question, unit, previousIntent }) {
      if (/趋势|走势|变化/u.test(question)) return { intent: 'trend' };
      if (/排名|排行|top|前十|前 ?\d+/iu.test(question)) return { intent: 'ranking' };
      if (/占比|构成|分布/u.test(question)) return { intent: 'composition' };
      if (/明细|清单|列表/u.test(question)) return { intent: 'detail' };
      if (previousIntent !== null) return { intent: previousIntent };
      if (unit.groupBy.length === 0) return { intent: 'single_value' };
      return { intent: 'comparison' };
    }
  };
}

function hitTerm(question: string, name: string, aliases: readonly string[]): boolean {
  return question.includes(name) || aliases.some((alias) => question.includes(alias));
}

/** 问题原文的去重二元词组(仅取中日韩与字母数字字符)。 */
function bigramsOf(question: string): string[] {
  const chars = [...question].filter((char) => /[\p{Script=Han}\p{L}\p{N}]/u.test(char));
  const grams = new Set<string>();
  for (let index = 0; index < chars.length - 1; index += 1) {
    grams.add(chars[index]! + chars[index + 1]!);
  }
  return [...grams];
}

function filterPatch(
  question: string,
  domain: DomainSemanticSurface
): { filters?: AskUnitFilter[] } {
  const filters: AskUnitFilter[] = [];
  for (const dimension of domain.dimensions) {
    const values = (dimension.values ?? []).filter((value) => question.includes(value));
    if (values.length > 0) filters.push({ dimension: dimension.name, values });
  }
  return filters.length > 0 ? { filters } : {};
}

/** 少量常用相对时间说法的确定性求值;识别不出时不设时间过滤。 */
function timePatch(
  question: string,
  domain: DomainSemanticSurface,
  clock: () => Date
): { time?: AskUnitTime } {
  const granularities = domain.timeDimensions[0]?.granularities ?? [];
  if (!granularities.includes('month')) return {};
  const now = clock();
  const month = (offset: number): string => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  };
  if (question.includes('上个月')) {
    return {
      time: { granularity: 'month', start: month(-1), end: month(-1), providedBy: 'user' }
    };
  }
  const halfYear = /(?:(\d{4})\s*年)?(上|下)半年/u.exec(question);
  if (halfYear) {
    const year = halfYear[1] === undefined ? now.getUTCFullYear() : Number(halfYear[1]);
    return {
      time:
        halfYear[2] === '上'
          ? { granularity: 'month', start: `${year}-01`, end: `${year}-06`, providedBy: 'user' }
          : { granularity: 'month', start: `${year}-07`, end: `${year}-12`, providedBy: 'user' }
    };
  }
  const recent = /最近\s*(\d+)\s*个月|近\s*(\d+)\s*个月/u.exec(question);
  if (recent) {
    const count = Number(recent[1] ?? recent[2]);
    if (Number.isFinite(count) && count > 0) {
      return {
        time: {
          granularity: 'month',
          start: month(-(count - 1)),
          end: month(0),
          providedBy: 'user'
        }
      };
    }
  }
  if (/今年以来|今年/u.test(question)) {
    return {
      time: {
        granularity: 'month',
        start: `${now.getUTCFullYear()}-01`,
        end: month(0),
        providedBy: 'user'
      }
    };
  }
  return {};
}
