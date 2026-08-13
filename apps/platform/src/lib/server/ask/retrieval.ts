import {
  semanticSurfaceOf,
  type DataContextSnapshot,
  type DomainSemanticSurface
} from '@metriccanvas/mcp';
import type { AskRetrievalPort, RankedMetricCandidate } from './ports';

/**
 * 数据上下文快照之上的确定性检索实现(ADR-0031 发现面的问数投影)。
 *
 * 业务域 = 快照中的 schema(CONTEXT.md:业务域是路由标签);语义面投影与
 * 敏感字段标注由 @metriccanvas/mcp 的 semanticSurfaceOf 唯一声明(#80),
 * 这里只做域收窄与候选排序,不产出第二份投影。
 *
 * 候选排序是确定性代码,不经过模型:按指标名/别名在问题原文中的字面命中
 * 打分,规范名命中优先于别名命中,更长的命中词优先。同一命中词在多个指标
 * 条目上得分相同(近义指标、跨域重名)即为消歧不确定,交由编排层阻塞转
 * 人工确认,检索不替用户选。
 */

const DEFAULT_CANDIDATE_LIMIT = 5;

/** 规范名命中的基础分;别名命中减半,命中词长度做同类内的次级排序。 */
const NAME_HIT_SCORE = 100;
const ALIAS_HIT_SCORE = 50;

export function createSnapshotAskRetrieval(dataContext: {
  current(): Promise<DataContextSnapshot>;
}): AskRetrievalPort {
  const surfaces = async (): Promise<DomainSemanticSurface[]> =>
    semanticSurfaceOf(await dataContext.current());

  return {
    async domainInventory() {
      return (await surfaces()).map((surface) => ({
        name: surface.businessDomain,
        description: surface.description
      }));
    },

    async domainSurfaces(businessDomains) {
      const all = await surfaces();
      return all.filter((surface) => businessDomains.includes(surface.businessDomain));
    },

    async searchMetricCandidates({ question, businessDomains, limit = DEFAULT_CANDIDATE_LIMIT }) {
      const all = await surfaces();
      const candidates: RankedMetricCandidate[] = [];
      for (const surface of all) {
        if (!businessDomains.includes(surface.businessDomain)) continue;
        for (const metric of surface.metrics) {
          const hit = bestHit(question, metric.name, metric.aliases);
          if (!hit) continue;
          candidates.push({
            metricName: metric.name,
            businessDomain: surface.businessDomain,
            definition: metric.description,
            ...(metric.unit === undefined ? {} : { unit: metric.unit }),
            matchedTerm: hit.term,
            score: hit.score
          });
        }
      }
      return candidates
        .sort(
          (left, right) =>
            right.score - left.score ||
            left.businessDomain.localeCompare(right.businessDomain) ||
            left.metricName.localeCompare(right.metricName)
        )
        .slice(0, limit);
    }
  };
}

function bestHit(
  question: string,
  name: string,
  aliases: readonly string[]
): { term: string; score: number } | null {
  if (question.includes(name)) {
    return { term: name, score: NAME_HIT_SCORE + name.length };
  }
  const matched = aliases
    .filter((alias) => question.includes(alias))
    .sort((left, right) => right.length - left.length)[0];
  if (matched !== undefined) {
    return { term: matched, score: ALIAS_HIT_SCORE + matched.length };
  }
  return null;
}

/**
 * 确定性消歧(ADR-0037、用户拍板的架构决策 4):按命中词分组,组内最高分
 * 唯一者胜出;并列最高分即为「近义指标/跨域易混」,该命中词歧义未决。
 * 返回各命中词的唯一胜出候选与歧义命中词清单;模型与系统都不得代选。
 */
export interface MetricDisambiguation {
  selected: RankedMetricCandidate[];
  ambiguousTerms: string[];
}

export function disambiguateCandidates(
  candidates: readonly RankedMetricCandidate[]
): MetricDisambiguation {
  const byTerm = new Map<string, RankedMetricCandidate[]>();
  for (const candidate of candidates) {
    const group = byTerm.get(candidate.matchedTerm) ?? [];
    group.push(candidate);
    byTerm.set(candidate.matchedTerm, group);
  }
  const selected: RankedMetricCandidate[] = [];
  const ambiguousTerms: string[] = [];
  for (const [term, group] of byTerm) {
    const top = group.reduce((best, entry) => (entry.score > best.score ? entry : best));
    const tied = group.filter((entry) => entry.score === top.score);
    if (tied.length > 1) {
      ambiguousTerms.push(term);
    } else {
      selected.push(top);
    }
  }
  return { selected, ambiguousTerms };
}
