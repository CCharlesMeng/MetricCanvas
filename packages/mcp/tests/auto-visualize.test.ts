import { describe, expect, it } from 'vitest';
import { componentCatalog, componentCatalogEntry } from '@metriccanvas/page';
import {
  recommendComponents,
  type ComponentCandidate,
  type ResultShape
} from '../src';

/** 常用结果形状基线：一个维度 + 一个度量的多行结果。 */
function shapeOf(partial: Partial<ResultShape> = {}): ResultShape {
  return {
    dimensionCount: 1,
    measureCount: 1,
    rowCount: 10,
    hasTimeDimension: false,
    ...partial
  };
}

function candidateOf(
  candidates: ComponentCandidate[],
  type: ComponentCandidate['type']
): ComponentCandidate {
  const found = candidates.find((candidate) => candidate.type === type);
  if (!found) throw new Error(`候选缺少组件:${type}`);
  return found;
}

describe('自动可视化:候选集与组件能力目录同面', () => {
  it('候选集恒等于 componentCatalog 全集,能力事实取自目录', () => {
    const candidates = recommendComponents(shapeOf());
    expect(candidates).toHaveLength(componentCatalog.length);
    expect(new Set(candidates.map((candidate) => candidate.type))).toEqual(
      new Set(componentCatalog.map((entry) => entry.type))
    );
    for (const candidate of candidates) {
      const entry = componentCatalogEntry(candidate.type);
      expect(candidate.label).toBe(entry.label);
      expect(candidate.defaultSpan).toBe(entry.defaultSpan);
    }
  });

  it('当前目录每个条目都有数据形状机器判读(守卫:目录新增组件必须补判读)', () => {
    const candidates = recommendComponents(shapeOf());
    for (const candidate of candidates) {
      expect(candidate.reasons.join('')).not.toContain('缺少数据形状机器判读');
    }
  });

  it('ok 为 true 时原因为空,ok 为 false 时必须给出原因且不得被推荐', () => {
    const candidates = recommendComponents(shapeOf({ measureCount: 2 }));
    for (const candidate of candidates) {
      if (candidate.ok) {
        expect(candidate.reasons).toEqual([]);
      } else {
        expect(candidate.reasons.length).toBeGreaterThan(0);
        expect(candidate.recommended).toBe(false);
      }
    }
  });
});

describe('自动可视化:硬闸拒绝(表驱动)', () => {
  const rejections: Array<{
    name: string;
    shape: ResultShape;
    type: ComponentCandidate['type'];
    reason: string;
  }> = [
    {
      name: '柱状图要求恰好一个维度字段,零维度被拒',
      shape: shapeOf({ dimensionCount: 0, measureCount: 2, rowCount: 1 }),
      type: 'barChart',
      reason: '0 个维度字段'
    },
    {
      name: '柱状图不接受多维度结果',
      shape: shapeOf({ dimensionCount: 3, measureCount: 2, rowCount: 100 }),
      type: 'barChart',
      reason: '3 个维度字段'
    },
    {
      name: '折线图要求恰好一个横轴维度',
      shape: shapeOf({ dimensionCount: 2, hasTimeDimension: true }),
      type: 'lineChart',
      reason: '2 个维度字段'
    },
    {
      name: '折线图没有度量字段被拒',
      shape: shapeOf({ measureCount: 0 }),
      type: 'lineChart',
      reason: '0 个度量字段'
    },
    {
      name: '饼图不接受多个度量',
      shape: shapeOf({ measureCount: 2 }),
      type: 'pieChart',
      reason: '2 个度量字段'
    },
    {
      name: '排行卡不接受多个度量',
      shape: shapeOf({ measureCount: 3 }),
      type: 'rankingCard',
      reason: '3 个度量字段'
    },
    {
      name: '详细排行卡机器判读只承诺名称加数值',
      shape: shapeOf({ dimensionCount: 4, measureCount: 2 }),
      type: 'rankingDetailCard',
      reason: '4 个维度字段'
    },
    {
      name: '指标卡不接受维度分组结果',
      shape: shapeOf({ dimensionCount: 1, measureCount: 1, rowCount: 1 }),
      type: 'metricCard',
      reason: '1 个维度字段'
    },
    {
      name: '指标卡行数超出「单行或少量行」判读上限',
      shape: shapeOf({ dimensionCount: 0, measureCount: 1, rowCount: 12 }),
      type: 'metricCard',
      reason: '12 行'
    },
    {
      name: '行数未经真实执行证明时指标卡失败关闭',
      shape: { dimensionCount: 0, measureCount: 1, hasTimeDimension: false },
      type: 'metricCard',
      reason: '行数未经真实执行证明'
    },
    {
      name: '地图的地域名称语义无法由结果形状证明',
      shape: shapeOf(),
      type: 'mapChart',
      reason: '不得从样例值推断'
    },
    {
      name: '地图必填 props map 无法自动补齐',
      shape: shapeOf(),
      type: 'mapChart',
      reason: '必填 props「map」'
    },
    {
      name: '明细表没有任何标量字段被拒',
      shape: shapeOf({ dimensionCount: 0, measureCount: 0 }),
      type: 'table',
      reason: '不含任何 dimension/measure'
    },
    {
      name: '报告页头不消费页面数据源',
      shape: shapeOf(),
      type: 'reportHeader',
      reason: '不消费页面数据源'
    },
    {
      name: '文本不消费页面数据源',
      shape: shapeOf(),
      type: 'text',
      reason: '不消费页面数据源'
    },
    {
      name: 'AI 总结不消费页面数据源',
      shape: shapeOf(),
      type: 'aiSummary',
      reason: '不消费页面数据源'
    }
  ];

  it.each(rejections)('$name', ({ shape, type, reason }) => {
    const candidate = candidateOf(recommendComponents(shape), type);
    expect(candidate.ok).toBe(false);
    expect(candidate.recommended).toBe(false);
    expect(candidate.reasons.join('；')).toContain(reason);
  });

  it('结果形状全空时所有组件被硬闸拒绝,没有推荐', () => {
    const candidates = recommendComponents(
      shapeOf({ dimensionCount: 0, measureCount: 0 })
    );
    expect(candidates.every((candidate) => !candidate.ok)).toBe(true);
    expect(candidates.every((candidate) => !candidate.recommended)).toBe(true);
  });
});

describe('自动可视化:允许范围内按分析意图排序', () => {
  const trendShape = shapeOf({ hasTimeDimension: true, rowCount: 6 });

  it('趋势意图把折线图排到推荐首位', () => {
    const [first] = recommendComponents(trendShape, { intent: 'trend' });
    expect(first).toMatchObject({ type: 'lineChart', ok: true, recommended: true });
  });

  it('对比意图把柱状图排到推荐首位', () => {
    const [first] = recommendComponents(trendShape, { intent: 'comparison' });
    expect(first).toMatchObject({ type: 'barChart', ok: true, recommended: true });
  });

  it('无意图时时间维度亲和折线图', () => {
    const [first] = recommendComponents(trendShape);
    expect(first).toMatchObject({ type: 'lineChart', recommended: true });
  });

  it('排行意图推荐排行卡', () => {
    const [first] = recommendComponents(shapeOf(), { intent: 'ranking' });
    expect(first).toMatchObject({ type: 'rankingCard', ok: true, recommended: true });
  });

  it('总结意图推荐指标卡', () => {
    const [first] = recommendComponents(
      shapeOf({ dimensionCount: 0, measureCount: 2, rowCount: 1 }),
      { intent: 'summary' }
    );
    expect(first).toMatchObject({ type: 'metricCard', ok: true, recommended: true });
  });

  it('意图不放宽硬闸:占比意图不能把被拒的饼图捞回', () => {
    const candidates = recommendComponents(shapeOf({ measureCount: 2 }), {
      intent: 'proportion'
    });
    expect(candidateOf(candidates, 'pieChart')).toMatchObject({
      ok: false,
      recommended: false
    });
    const recommended = candidates.find((candidate) => candidate.recommended);
    expect(recommended?.ok).toBe(true);
    expect(recommended?.type).not.toBe('pieChart');
  });
});

describe('自动可视化:钉住组件不被自动改写', () => {
  const trendShape = shapeOf({ hasTimeDimension: true, rowCount: 6 });

  it('钉住组件通过硬闸时不被意图排序改写', () => {
    const candidates = recommendComponents(trendShape, {
      intent: 'trend',
      pinned: 'barChart'
    });
    expect(candidates[0]).toMatchObject({
      type: 'barChart',
      pinned: true,
      ok: true,
      recommended: true
    });
    expect(candidateOf(candidates, 'lineChart').recommended).toBe(false);
  });

  it('钉住组件被硬闸拒绝时不把推荐让给其他组件', () => {
    const candidates = recommendComponents(trendShape, { pinned: 'mapChart' });
    expect(candidateOf(candidates, 'mapChart')).toMatchObject({
      ok: false,
      pinned: true,
      recommended: false
    });
    expect(candidates.every((candidate) => !candidate.recommended)).toBe(true);
  });

  it('钉住目录外的组件类型失败关闭', () => {
    expect(() =>
      recommendComponents(trendShape, { pinned: 'sparkline' as never })
    ).toThrow('未知组件类型');
  });
});
