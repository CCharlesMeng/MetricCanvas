import { describe, expect, it } from 'vitest';
import type { ComputeOperator, DataRow, RatioScale } from '@metriccanvas/page';
import { applyComputation } from '../src/compute';

describe('ratio:分母为零的语义必须显式声明', () => {
  const rows: DataRow[] = [
    { done: 100, plan: 150 },
    { done: 3, plan: 0 },
    { done: 5, plan: null },
    { done: null, plan: 10 }
  ];

  it('onZeroDenominator=null 时分母为零或缺失取空', () => {
    const operator: ComputeOperator = {
      op: 'ratio',
      numerator: 'done',
      denominator: 'plan',
      output: 'rate',
      onZeroDenominator: 'null'
    };

    expect(applyComputation([operator], rows).map((row) => row.rate)).toEqual([
      100 / 150,
      null,
      null,
      null
    ]);
  });

  it('onZeroDenominator=zero 时分母为零或缺失取零，分子缺失仍取空', () => {
    const operator: ComputeOperator = {
      op: 'ratio',
      numerator: 'done',
      denominator: 'plan',
      output: 'rate',
      onZeroDenominator: 'zero'
    };

    expect(applyComputation([operator], rows).map((row) => row.rate)).toEqual([
      100 / 150,
      0,
      0,
      null
    ]);
  });
});

describe('ratio.scale:输出刻度只作用于算出来的商', () => {
  const rows: DataRow[] = [
    { done: 100, plan: 150 },
    { done: 3, plan: 0 },
    { done: 5, plan: null },
    { done: null, plan: 10 }
  ];

  /** 未声明刻度时 `scale` 真的不在文档里,不是显式的 undefined。 */
  const ratioOp = (
    onZeroDenominator: 'null' | 'zero',
    scale?: RatioScale
  ): ComputeOperator =>
    scale === undefined
      ? { op: 'ratio', numerator: 'done', denominator: 'plan', output: 'rate', onZeroDenominator }
      : {
          op: 'ratio',
          numerator: 'done',
          denominator: 'plan',
          output: 'rate',
          onZeroDenominator,
          scale
        };

  const rates = (operator: ComputeOperator) =>
    applyComputation([operator], rows).map((row) => row.rate);

  it('声明 scale: 100 时逐值是未声明时的 100 倍', () => {
    for (const onZeroDenominator of ['null', 'zero'] as const) {
      const unscaled = rates(ratioOp(onZeroDenominator));
      expect(rates(ratioOp(onZeroDenominator, 100))).toEqual(
        unscaled.map((value) => (typeof value === 'number' ? value * 100 : value))
      );
    }

    expect(rates(ratioOp('null', 100))[0]).toBe((100 / 150) * 100);
  });

  it('未声明 scale 时逐值与引入该参数前一致', () => {
    expect(rates(ratioOp('null'))).toEqual([100 / 150, null, null, null]);
    expect(rates(ratioOp('zero'))).toEqual([100 / 150, 0, 0, null]);
  });

  it('分母为零或缺失的两种语义在声明刻度后仍分别取空与取零', () => {
    expect(rates(ratioOp('null', 100)).slice(1, 3)).toEqual([null, null]);
    expect(rates(ratioOp('zero', 100)).slice(1, 3)).toEqual([0, 0]);
  });

  it('分子缺失一律取空,与刻度无关', () => {
    expect(rates(ratioOp('null', 100))[3]).toBeNull();
    expect(rates(ratioOp('zero', 100))[3]).toBeNull();
    expect(rates(ratioOp('null'))[3]).toBeNull();
    expect(rates(ratioOp('zero'))[3]).toBeNull();
  });
});

describe('delta', () => {
  it('两个字段引用的差；任一为空取空', () => {
    const operator: ComputeOperator = {
      op: 'delta',
      minuend: 'current',
      subtrahend: 'last',
      output: 'mom'
    };

    expect(
      applyComputation(
        [operator],
        [
          { current: 350, last: 320 },
          { current: 350, last: null },
          { current: null, last: 320 }
        ]
      ).map((row) => row.mom)
    ).toEqual([30, null, null]);
  });
});

describe('groupSubtotal', () => {
  const rows: DataRow[] = [
    { type: '类型A', sub: '子类1', jan: 100, feb: null },
    { type: '类型B', sub: '子类3', jan: 5, feb: 5 },
    { type: '类型A', sub: '子类2', jan: 200, feb: 50 }
  ];
  const operator: ComputeOperator = {
    op: 'groupSubtotal',
    groupBy: 'type',
    measures: ['jan', 'feb'],
    rowKind: { field: 'kind', value: 'subtotal' },
    labelSuffix: '合计'
  };

  it('每组明细原序保留，其后追加一行小计', () => {
    const result = applyComputation([operator], rows);

    expect(result.map((row) => [row.type, row.sub, row.kind])).toEqual([
      ['类型A', '子类1', null],
      ['类型A', '子类2', null],
      ['类型A合计', null, 'subtotal'],
      ['类型B', '子类3', null],
      ['类型B合计', null, 'subtotal']
    ]);
  });

  it('空值视为 0 参与累加；整组无数值时取空', () => {
    const result = applyComputation([operator], rows);
    expect(result[2]).toMatchObject({ jan: 300, feb: 50 });
    expect(
      applyComputation([operator], [{ type: 'A', sub: null, jan: null, feb: null }])[1]
    ).toMatchObject({ jan: null, feb: null });
  });

  it('空行集不产出小计行', () => {
    expect(applyComputation([operator], [])).toEqual([]);
  });
});

describe('grandTotal', () => {
  const subtotal: ComputeOperator = {
    op: 'groupSubtotal',
    groupBy: 'type',
    measures: ['jan'],
    rowKind: { field: 'kind', value: 'subtotal' },
    labelSuffix: '合计'
  };
  const total: ComputeOperator = {
    op: 'grandTotal',
    measures: ['jan'],
    rowKind: { field: 'kind', value: 'total' },
    label: { field: 'type', value: '合计' }
  };

  it('只累加明细行，不把小计行计第二遍', () => {
    const result = applyComputation(
      [subtotal, total],
      [
        { type: '类型A', jan: 100 },
        { type: '类型A', jan: 200 },
        { type: '类型B', jan: 50 }
      ]
    );

    expect(result.map((row) => [row.type, row.jan, row.kind])).toEqual([
      ['类型A', 100, null],
      ['类型A', 200, null],
      ['类型A合计', 300, 'subtotal'],
      ['类型B', 50, null],
      ['类型B合计', 50, 'subtotal'],
      ['合计', 350, 'total']
    ]);
  });

  it('空行集不产出合计行', () => {
    expect(applyComputation([total], [])).toEqual([]);
  });
});

describe('pivot', () => {
  const operator: ComputeOperator = {
    op: 'pivot',
    categoryField: 'activity',
    valueField: 'count',
    columns: [
      { output: 'high-level-visit', categories: ['高层拜访'] },
      { output: 'workshop-exchange', categories: ['专题交流', '技术交流'] },
      { output: 'summit-meeting', categories: ['高层峰会'] }
    ]
  };

  it('缺省把整个行集折成一行，未命中的目标列取空', () => {
    expect(
      applyComputation(
        [operator],
        [
          { activity: '高层拜访', count: 5 },
          { activity: '技术交流', count: 2 }
        ]
      )
    ).toEqual([
      { 'high-level-visit': 5, 'workshop-exchange': 2, 'summit-meeting': null }
    ]);
  });

  it('有序类别取第一个命中的：专题交流优先于技术交流', () => {
    expect(
      applyComputation(
        [operator],
        [
          { activity: '技术交流', count: 2 },
          { activity: '专题交流', count: 9 }
        ]
      )[0]
    ).toMatchObject({ 'workshop-exchange': 9 });
  });

  it('声明分组键时按键分组，产出行只含分组键与目标列', () => {
    const keyed: ComputeOperator = { ...operator, keyFields: ['party'] };
    expect(
      applyComputation(
        [keyed],
        [
          { party: 'P1', activity: '高层拜访', count: 5 },
          { party: 'P2', activity: '高层峰会', count: 1 }
        ]
      )
    ).toEqual([
      { party: 'P1', 'high-level-visit': 5, 'workshop-exchange': null, 'summit-meeting': null },
      { party: 'P2', 'high-level-visit': null, 'workshop-exchange': null, 'summit-meeting': 1 }
    ]);
  });

  it('空行集原样返回', () => {
    expect(applyComputation([operator], [])).toEqual([]);
  });
});

describe('算子按声明顺序作用', () => {
  it('后一个算子看到前一个算子的产出', () => {
    const result = applyComputation(
      [
        { op: 'delta', minuend: 'current', subtrahend: 'last', output: 'gap' },
        { op: 'ratio', numerator: 'gap', denominator: 'last', output: 'rate', onZeroDenominator: 'null' }
      ],
      [{ current: 120, last: 100 }]
    );

    expect(result[0]).toMatchObject({ gap: 20, rate: 0.2 });
  });

  it('不修改输入行集', () => {
    const rows: DataRow[] = [{ current: 120, last: 100 }];
    applyComputation(
      [{ op: 'delta', minuend: 'current', subtrahend: 'last', output: 'gap' }],
      rows
    );
    expect(rows[0]).toEqual({ current: 120, last: 100 });
  });
});
