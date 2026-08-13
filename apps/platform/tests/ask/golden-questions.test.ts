import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  findDimension,
  findMetric,
  semanticSurface,
  type BusinessDomain
} from '../../../../tools/dqe-sim/src/semantic-surface';

/**
 * 黄金问题集守卫(#69,ADR-0037):三组机械可查的断言,全部进 CI。
 *
 * 1. 混用防护:few-shot 提示词示例与评测样本(黄金问题集 + 种子样本)
 *    物理分离,两边问题原文的交集必须为空——同一批样本既当示例又当
 *    考题时,准确率数字没有意义。
 * 2. 真元归一:评测样本 expected 中的域/指标/维度/取值/粒度必须逐字
 *    命中语义面唯一真源(tools/dqe-sim/src/semantic-surface.ts)的规范名,
 *    不允许手抄第二份指标清单,也不允许把别名当期望值。
 * 3. 结构与配额:字段齐全(问题原文、期望域/指标/维度、期望时间口径、
 *    可接受替代答案、难度标签),四类覆盖且配额符合 ADR-0037 的
 *    60/20/10/10。
 */

type Category = 'direct' | 'clarify' | 'no_metric' | 'cross_domain';

interface EvalSample {
  id: string;
  category: Category;
  difficulty?: 'easy' | 'medium' | 'hard';
  question: string;
  note: string;
  expected: {
    status: 'answer' | 'clarify' | 'reject';
    altStatuses?: string[];
    domain?: string;
    metrics?: string[];
    groupBy?: string[];
    altGroupBy?: string[][];
    filters?: Array<{ dimension: string; values: string[] }>;
    granularity?: string;
    timeScope?: string;
    clarifyCandidateDomains?: string[];
  };
}

function loadJson<T>(relativePath: string): T {
  const path = fileURLToPath(new URL(relativePath, import.meta.url));
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

const golden = loadJson<{ version?: string; samples: EvalSample[] }>(
  '../../scripts/fixtures/golden-questions.json'
);
const seeds = loadJson<{ samples: EvalSample[] }>(
  '../../scripts/fixtures/seed-questions.json'
);
const fewShot = loadJson<{ examples: Array<{ question: string }> }>(
  '../../scripts/fixtures/few-shot-examples.json'
);

const domainByName = new Map<string, BusinessDomain>(
  semanticSurface.map((domain) => [domain.name, domain])
);

function mustDomain(name: string | undefined, sampleId: string): BusinessDomain {
  const domain = name === undefined ? undefined : domainByName.get(name);
  if (!domain) {
    throw new Error(`样本 ${sampleId} 的期望业务域「${name}」不在语义面内`);
  }
  return domain;
}

/** 期望分组维度必须是规范维度名或该域时间维度的规范名。 */
function assertGroupByCanonical(
  domain: BusinessDomain,
  groupBy: readonly string[],
  sampleId: string
): void {
  for (const name of groupBy) {
    const canonical =
      name === domain.timeDimension.name || findDimension(domain, name) !== undefined;
    expect
      .soft(canonical, `样本 ${sampleId} 的期望分组「${name}」不是「${domain.name}」域的规范维度名`)
      .toBe(true);
  }
}

describe('黄金问题集守卫:few-shot 与评测样本物理分离(混用防护)', () => {
  it('few-shot 示例问题与黄金问题集/种子样本的交集为空', () => {
    const evalQuestions = new Set(
      [...golden.samples, ...seeds.samples].map((sample) => sample.question.trim())
    );
    const overlap = fewShot.examples
      .map((example) => example.question.trim())
      .filter((question) => evalQuestions.has(question));
    expect(overlap).toEqual([]);
  });

  it('评测样本自身不重复:黄金问题集与种子样本内部及相互间问题唯一', () => {
    const questions = [...golden.samples, ...seeds.samples].map((sample) =>
      sample.question.trim()
    );
    expect(new Set(questions).size).toBe(questions.length);
  });
});

describe('黄金问题集守卫:期望值与语义面同面(真元归一)', () => {
  const directSamples = [...golden.samples, ...seeds.samples].filter(
    (sample) => sample.expected.status === 'answer'
  );

  it.each(directSamples.map((sample) => ({ id: sample.id, sample })))(
    '$id:期望域/指标/维度/取值/粒度逐字命中语义面规范名',
    ({ sample }) => {
      const domain = mustDomain(sample.expected.domain, sample.id);
      for (const metricName of sample.expected.metrics ?? []) {
        const metric = findMetric(domain, metricName);
        expect
          .soft(metric?.name, `样本 ${sample.id} 的期望指标「${metricName}」不是规范名`)
          .toBe(metricName);
      }
      for (const groupBy of [
        sample.expected.groupBy ?? [],
        ...(sample.expected.altGroupBy ?? [])
      ]) {
        assertGroupByCanonical(domain, groupBy, sample.id);
      }
      for (const filter of sample.expected.filters ?? []) {
        const dimension = findDimension(domain, filter.dimension);
        expect
          .soft(
            dimension?.name,
            `样本 ${sample.id} 的筛选维度「${filter.dimension}」不是规范名`
          )
          .toBe(filter.dimension);
        for (const value of filter.values) {
          expect
            .soft(
              dimension?.values.includes(value),
              `样本 ${sample.id} 的筛选取值「${value}」不在维度「${filter.dimension}」取值域内`
            )
            .toBe(true);
        }
      }
      expect(
        domain.granularities as readonly string[],
        `样本 ${sample.id} 的期望粒度不被「${domain.name}」域支持`
      ).toContain(sample.expected.granularity);
    }
  );

  const clarifySamples = [...golden.samples, ...seeds.samples].filter(
    (sample) => sample.expected.status === 'clarify'
  );

  it.each(clarifySamples.map((sample) => ({ id: sample.id, sample })))(
    '$id:澄清候选域存在且确有跨域同名指标歧义',
    ({ sample }) => {
      const candidateDomains = (sample.expected.clarifyCandidateDomains ?? []).map(
        (name) => mustDomain(name, sample.id)
      );
      expect(candidateDomains.length).toBeGreaterThanOrEqual(2);
      const [first, ...rest] = candidateDomains;
      const shared = first!.metrics
        .map((metric) => metric.name)
        .filter((name) => rest.every((domain) => findMetric(domain, name) !== undefined));
      expect(
        shared.length,
        `样本 ${sample.id} 声称需澄清,但候选域之间没有同名指标歧义`
      ).toBeGreaterThan(0);
    }
  );
});

describe('黄金问题集守卫:结构与四类配额(ADR-0037)', () => {
  it('评测资产带版本号,样本 id 唯一', () => {
    expect(golden.version).toBeTruthy();
    const ids = golden.samples.map((sample) => sample.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('四类全覆盖且配额为 60/20/10/10(V0 共 10 条)', () => {
    const count = (category: Category) =>
      golden.samples.filter((sample) => sample.category === category).length;
    expect(golden.samples).toHaveLength(10);
    expect(count('direct')).toBe(6);
    expect(count('clarify')).toBe(2);
    expect(count('no_metric')).toBe(1);
    expect(count('cross_domain')).toBe(1);
  });

  it.each(golden.samples.map((sample) => ({ id: sample.id, sample })))(
    '$id:字段齐全,类别与期望状态一致',
    ({ sample }) => {
      expect(sample.question.trim()).not.toBe('');
      expect(sample.note.trim()).not.toBe('');
      expect(['easy', 'medium', 'hard']).toContain(sample.difficulty);
      const statusByCategory: Record<Category, string> = {
        direct: 'answer',
        clarify: 'clarify',
        no_metric: 'reject',
        cross_domain: 'reject'
      };
      expect(sample.expected.status).toBe(statusByCategory[sample.category]);
      for (const alt of sample.expected.altStatuses ?? []) {
        expect(['answer', 'clarify', 'reject']).toContain(alt);
        expect(alt).not.toBe(sample.expected.status);
      }
      if (sample.category === 'direct') {
        expect(sample.expected.domain).toBeTruthy();
        expect(sample.expected.metrics?.length).toBeGreaterThan(0);
        expect(sample.expected.groupBy).toBeDefined();
        expect(sample.expected.filters).toBeDefined();
        expect(sample.expected.granularity).toBeTruthy();
        // 期望时间口径:黄金问题集每条直答样本必须显式声明(#69)。
        expect(sample.expected.timeScope).toBeTruthy();
      }
      if (sample.category === 'clarify') {
        expect(sample.expected.clarifyCandidateDomains?.length).toBeGreaterThanOrEqual(2);
      }
      // 降级路径可测:拒答类样本不得携带可执行的取数期望,防止误当直答评。
      if (sample.expected.status === 'reject') {
        expect(sample.expected.metrics).toBeUndefined();
        expect(sample.expected.groupBy).toBeUndefined();
      }
    }
  );
});
