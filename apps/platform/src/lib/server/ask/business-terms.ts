import type { DomainSemanticSurface } from '@metriccanvas/mcp';
import type { AnalysisIntent } from '../session/step-event';
import type { AskUnitTime } from './ports';

export type DeterministicBusinessTermKind =
  | 'dimension'
  | 'dimension_value'
  | 'relative_time'
  | 'analysis_intent'
  | 'structure_operation';

export type StructureOperation = 'add' | 'remove' | 'replace' | 'split' | 'merge';

export interface DeterministicBusinessTermMatch {
  kind: DeterministicBusinessTermKind;
  matchedTerm: string;
  canonicalName: string;
  businessDomain: string | null;
  source:
    | 'canonical_name'
    | 'alias'
    | 'value_domain'
    | 'relative_time_lexicon'
    | 'analysis_intent_lexicon'
    | 'structure_operation_lexicon';
  score: number;
  definition?: string;
  start: number;
  end: number;
}

export interface DeterministicBusinessTermResolution {
  formatVersion: '1.0';
  question: string;
  matches: DeterministicBusinessTermMatch[];
  ambiguities: Array<{
    matchedTerm: string;
    candidates: Array<{
      kind: DeterministicBusinessTermKind;
      canonicalName: string;
      businessDomain: string | null;
      score: number;
      definition?: string;
    }>;
  }>;
}

export interface ResolvedBusinessTerms {
  resolution: DeterministicBusinessTermResolution;
  time: AskUnitTime | null;
  intent: AnalysisIntent | null;
  structureOperation: StructureOperation | null;
}

const NAME_SCORE = 100;
const VALUE_SCORE = 80;
const ALIAS_SCORE = 50;
const LEXICON_SCORE = 30;

/**
 * Deterministic business-term parser used by the lexical fallback and exported
 * as a TypeScript→Python conformance baseline. The governed Data Context is the
 * dictionary; this deliberately does not expose model-tokenizer boundaries.
 */
export function resolveBusinessTerms(input: {
  question: string;
  surfaces: readonly DomainSemanticSurface[];
  clock?: () => Date;
}): ResolvedBusinessTerms {
  const clock = input.clock ?? (() => new Date());
  const matches: DeterministicBusinessTermMatch[] = [];
  for (const surface of input.surfaces) {
    for (const dimension of [...surface.dimensions, ...surface.timeDimensions]) {
      const hit = bestNamedHit(input.question, dimension.name, dimension.aliases);
      if (hit !== null) {
        matches.push({
          kind: 'dimension',
          matchedTerm: hit.term,
          canonicalName: dimension.name,
          businessDomain: surface.businessDomain,
          source: hit.source,
          score: hit.score,
          definition: dimension.description,
          start: hit.start,
          end: hit.end
        });
      }
      if (!('values' in dimension)) continue;
      for (const value of dimension.values ?? []) {
        const start = input.question.indexOf(value);
        if (start < 0) continue;
        matches.push({
          kind: 'dimension_value',
          matchedTerm: value,
          canonicalName: value,
          businessDomain: surface.businessDomain,
          source: 'value_domain',
          score: VALUE_SCORE + value.length,
          definition: dimension.name,
          start,
          end: start + value.length
        });
      }
    }
  }

  const relativeTime = resolveRelativeTime(
    input.question,
    input.surfaces.some((surface) =>
      (surface.timeDimensions[0]?.granularities ?? []).includes('month')
    ),
    clock
  );
  if (relativeTime !== null) matches.push(relativeTime.match);

  const analysisIntent = resolveAnalysisIntentKeyword(input.question);
  if (analysisIntent !== null) matches.push(analysisIntent.match);

  const structureOperation = resolveStructureOperation(input.question);
  if (structureOperation !== null) matches.push(structureOperation.match);

  matches.sort(
    (left, right) =>
      left.start - right.start ||
      right.matchedTerm.length - left.matchedTerm.length ||
      right.score - left.score ||
      (left.businessDomain ?? '').localeCompare(right.businessDomain ?? '') ||
      left.canonicalName.localeCompare(right.canonicalName)
  );
  const { selected, ambiguities } = disambiguate(matches);
  return {
    resolution: {
      formatVersion: '1.0',
      question: input.question,
      matches: selected,
      ambiguities
    },
    time: relativeTime?.time ?? null,
    intent: analysisIntent?.intent ?? null,
    structureOperation: structureOperation?.operation ?? null
  };
}

function bestNamedHit(
  question: string,
  name: string,
  aliases: readonly string[]
): {
  term: string;
  source: 'canonical_name' | 'alias';
  score: number;
  start: number;
  end: number;
} | null {
  const hits = [
    ...(question.includes(name)
      ? [{ term: name, source: 'canonical_name' as const, base: NAME_SCORE }]
      : []),
    ...aliases
      .filter((alias) => question.includes(alias))
      .map((term) => ({ term, source: 'alias' as const, base: ALIAS_SCORE }))
  ].sort((left, right) => right.term.length - left.term.length || right.base - left.base);
  const hit = hits[0];
  if (hit === undefined) return null;
  const start = question.indexOf(hit.term);
  return {
    term: hit.term,
    source: hit.source,
    score: hit.base + hit.term.length,
    start,
    end: start + hit.term.length
  };
}

function resolveRelativeTime(
  question: string,
  supportsMonth: boolean,
  clock: () => Date
): { match: DeterministicBusinessTermMatch; time: AskUnitTime } | null {
  if (!supportsMonth) return null;
  const now = clock();
  const month = (offset: number): string => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  };
  const result = (
    matchedTerm: string,
    canonicalName: string,
    start: number,
    time: AskUnitTime
  ) => ({
    match: {
      kind: 'relative_time' as const,
      matchedTerm,
      canonicalName,
      businessDomain: null,
      source: 'relative_time_lexicon' as const,
      score: LEXICON_SCORE + matchedTerm.length,
      start,
      end: start + matchedTerm.length
    },
    time
  });

  const previousMonth = question.indexOf('上个月');
  if (previousMonth >= 0) {
    return result('上个月', 'previous_month', previousMonth, {
      granularity: 'month',
      start: month(-1),
      end: month(-1),
      providedBy: 'user'
    });
  }
  const halfYear = /(?:(\d{4})\s*年)?(上|下)半年/u.exec(question);
  if (halfYear?.index !== undefined) {
    const year = halfYear[1] === undefined ? now.getUTCFullYear() : Number(halfYear[1]);
    return result(
      halfYear[0],
      halfYear[2] === '上' ? 'first_half_year' : 'second_half_year',
      halfYear.index,
      halfYear[2] === '上'
        ? { granularity: 'month', start: `${year}-01`, end: `${year}-06`, providedBy: 'user' }
        : { granularity: 'month', start: `${year}-07`, end: `${year}-12`, providedBy: 'user' }
    );
  }
  const recent = /最近\s*(\d+)\s*个月|近\s*(\d+)\s*个月/u.exec(question);
  if (recent?.index !== undefined) {
    const count = Number(recent[1] ?? recent[2]);
    if (Number.isFinite(count) && count > 0) {
      return result(recent[0], 'recent_months', recent.index, {
        granularity: 'month',
        start: month(-(count - 1)),
        end: month(0),
        providedBy: 'user'
      });
    }
  }
  const currentYear = /今年以来|今年/u.exec(question);
  if (currentYear?.index !== undefined) {
    return result(currentYear[0], 'current_year', currentYear.index, {
      granularity: 'month',
      start: `${now.getUTCFullYear()}-01`,
      end: month(0),
      providedBy: 'user'
    });
  }
  return null;
}

export function resolveAnalysisIntentKeyword(
  question: string
): { match: DeterministicBusinessTermMatch; intent: AnalysisIntent } | null {
  const definitions: Array<{ expression: RegExp; intent: AnalysisIntent }> = [
    { expression: /趋势|走势|变化/u, intent: 'trend' },
    { expression: /排名|排行|top|前十|前 ?\d+/iu, intent: 'ranking' },
    { expression: /占比|构成|分布/u, intent: 'composition' },
    { expression: /明细|清单|列表/u, intent: 'detail' }
  ];
  for (const definition of definitions) {
    const hit = definition.expression.exec(question);
    if (hit?.index === undefined) continue;
    return {
      intent: definition.intent,
      match: {
        kind: 'analysis_intent',
        matchedTerm: hit[0],
        canonicalName: definition.intent,
        businessDomain: null,
        source: 'analysis_intent_lexicon',
        score: LEXICON_SCORE + hit[0].length,
        start: hit.index,
        end: hit.index + hit[0].length
      }
    };
  }
  return null;
}

export function resolveStructureOperation(
  question: string
): { match: DeterministicBusinessTermMatch; operation: StructureOperation } | null {
  const definitions: Array<{ expression: RegExp; operation: StructureOperation }> = [
    { expression: /新增一个|增加|再加|添加|加一个/u, operation: 'add' },
    { expression: /删除|移除/u, operation: 'remove' },
    { expression: /替换|换成/u, operation: 'replace' },
    { expression: /拆成|分别展示/u, operation: 'split' },
    { expression: /合并|放到一张图/u, operation: 'merge' }
  ];
  for (const definition of definitions) {
    const hit = definition.expression.exec(question);
    if (hit?.index === undefined) continue;
    return {
      operation: definition.operation,
      match: {
        kind: 'structure_operation',
        matchedTerm: hit[0],
        canonicalName: definition.operation,
        businessDomain: null,
        source: 'structure_operation_lexicon',
        score: LEXICON_SCORE + hit[0].length,
        start: hit.index,
        end: hit.index + hit[0].length
      }
    };
  }
  return null;
}

function disambiguate(matches: readonly DeterministicBusinessTermMatch[]): {
  selected: DeterministicBusinessTermMatch[];
  ambiguities: DeterministicBusinessTermResolution['ambiguities'];
} {
  const groups = new Map<string, DeterministicBusinessTermMatch[]>();
  for (const match of matches) {
    const key = `${match.kind}\u0000${match.matchedTerm}`;
    groups.set(key, [...(groups.get(key) ?? []), match]);
  }
  const selected: DeterministicBusinessTermMatch[] = [];
  const ambiguities: DeterministicBusinessTermResolution['ambiguities'] = [];
  for (const group of groups.values()) {
    const topScore = Math.max(...group.map((match) => match.score));
    const tied = group.filter((match) => match.score === topScore);
    if (tied.length === 1) {
      selected.push(tied[0]!);
      continue;
    }
    ambiguities.push({
      matchedTerm: tied[0]!.matchedTerm,
      candidates: tied.map((match) => ({
        kind: match.kind,
        canonicalName: match.canonicalName,
        businessDomain: match.businessDomain,
        score: match.score,
        ...(match.definition === undefined ? {} : { definition: match.definition })
      }))
    });
  }
  selected.sort(
    (left, right) =>
      left.start - right.start ||
      right.matchedTerm.length - left.matchedTerm.length ||
      right.score - left.score ||
      (left.businessDomain ?? '').localeCompare(right.businessDomain ?? '') ||
      left.canonicalName.localeCompare(right.canonicalName)
  );
  return { selected, ambiguities };
}
