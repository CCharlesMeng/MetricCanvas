import { describe, expect, it } from 'vitest';
import {
  createSnapshotAskRetrieval,
  disambiguateCandidates
} from '../../src/lib/server/ask/retrieval';
import { exampleSnapshot } from './support/ask-harness';

/**
 * 确定性检索与消歧(#66/#69):真实语义面快照上的字面命中排序。
 * 最长命中词优先规则由黄金问题集暴露的误消歧(「新增客户数」触发
 * 跨域「客户数」歧义)驱动加入,在此固定为回归。
 */

const retrieval = createSnapshotAskRetrieval({
  current: async () => exampleSnapshot()
});

const BOTH_DOMAINS = ['运营分析', '客户经营'];

describe('确定性检索:最长命中词优先', () => {
  it('「新增客户数」不再把子串「客户数」当作独立概念触发跨域歧义', async () => {
    const candidates = await retrieval.searchMetricCandidates({
      question: '各模型的新增客户数是多少?',
      businessDomains: BOTH_DOMAINS
    });
    expect(candidates.map((candidate) => candidate.metricName)).toEqual(['新增客户数']);
    const { selected, ambiguousTerms } = disambiguateCandidates(candidates);
    expect(ambiguousTerms).toEqual([]);
    expect(selected.map((candidate) => candidate.metricName)).toEqual(['新增客户数']);
  });

  it('真正的近义歧义保留:只含「客户数」的问题仍两域并列待人工消歧', async () => {
    const candidates = await retrieval.searchMetricCandidates({
      question: '6月份的客户数是多少?',
      businessDomains: BOTH_DOMAINS
    });
    expect(new Set(candidates.map((candidate) => candidate.businessDomain))).toEqual(
      new Set(BOTH_DOMAINS)
    );
    const { ambiguousTerms } = disambiguateCandidates(candidates);
    expect(ambiguousTerms).toEqual(['客户数']);
  });

  it('别名长命中同样遮蔽子串:「在用客户数」直指运营分析口径,不过度澄清', async () => {
    const candidates = await retrieval.searchMetricCandidates({
      question: '上个月各区域的在用客户数是多少?',
      businessDomains: BOTH_DOMAINS
    });
    const { selected, ambiguousTerms } = disambiguateCandidates(candidates);
    expect(ambiguousTerms).toEqual([]);
    expect(selected.map((candidate) => `${candidate.businessDomain}·${candidate.metricName}`)).toEqual([
      '运营分析·客户数'
    ]);
  });
});
