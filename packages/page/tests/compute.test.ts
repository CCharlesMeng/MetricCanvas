import { describe, expect, it } from 'vitest';
import { computeOutputFields, isFoldingOperator } from '../src/compute';
import { validate } from '../src/validate';

const page = (dataSource: Record<string, unknown>) => ({
  schemaVersion: '5.1',
  id: 'forecast',
  dataSources: { forecast: dataSource },
  sections: [
    {
      id: 'body',
      components: [
        {
          id: 'grid',
          type: 'table',
          layout: { span: 12 },
          data: { main: 'forecast' },
          props: { columns: [{ field: 'business-type' }] }
        }
      ]
    }
  ]
});

const forecastFields = {
  'business-type': { type: 'string', role: 'dimension' },
  'row-kind': { type: 'string', role: 'dimension' },
  jan: { type: 'number', role: 'measure', collapsible: true, nullable: true }
} as const;

const foldingSource = (overrides: Record<string, unknown> = {}) => ({
  fields: forecastFields,
  compute: [
    {
      op: 'groupSubtotal',
      groupBy: 'business-type',
      measures: ['jan'],
      rowKind: { field: 'row-kind', value: 'subtotal' },
      labelSuffix: '合计'
    }
  ],
  source: {
    type: 'inline',
    rows: [{ 'business-type': '类型A', jan: 100 }]
  },
  ...overrides
});

describe('computeOutputFields', () => {
  it('去重，且把多个折叠算子共用的行类别字段只算一次', () => {
    expect(
      computeOutputFields([
        {
          op: 'groupSubtotal',
          groupBy: 'type',
          measures: ['jan'],
          rowKind: { field: 'kind', value: 'subtotal' }
        },
        {
          op: 'grandTotal',
          measures: ['jan'],
          rowKind: { field: 'kind', value: 'total' },
          label: { field: 'type', value: '合计' }
        },
        { op: 'delta', minuend: 'a', subtrahend: 'b', output: 'gap' }
      ])
    ).toEqual(['kind', 'gap']);
  });

  it('折叠算子可判定', () => {
    expect(
      isFoldingOperator({
        op: 'grandTotal',
        measures: [],
        rowKind: { field: 'kind', value: 'total' },
        label: { field: 'type', value: '合计' }
      })
    ).toBe(true);
    expect(
      isFoldingOperator({ op: 'delta', minuend: 'a', subtrahend: 'b', output: 'gap' })
    ).toBe(false);
  });
});

describe('计算阶段校验', () => {
  it('折叠 + 行类别字段的数据源通过校验', () => {
    expect(validate(page(foldingSource()))).toEqual([]);
  });

  it('被折叠的度量必须显式声明 collapsible', () => {
    const errors = validate(
      page(
        foldingSource({
          fields: {
            ...forecastFields,
            jan: { type: 'number', role: 'measure', nullable: true }
          }
        })
      )
    );

    expect(errors.map((error) => error.message)).toContain(
      '折叠算子只能作用于显式声明 collapsible 的度量字段:jan'
    );
  });

  it('算子引用未声明字段被拒绝', () => {
    const errors = validate(
      page(
        foldingSource({
          compute: [
            {
              op: 'groupSubtotal',
              groupBy: 'typo',
              measures: ['jan'],
              rowKind: { field: 'row-kind', value: 'subtotal' }
            }
          ]
        })
      )
    );

    expect(errors.map((error) => error.message)).toContain('算子引用了未声明的字段:typo');
  });

  it('行类别字段必须是可空的 string 维度', () => {
    const errors = validate(
      page(
        foldingSource({
          fields: {
            ...forecastFields,
            'row-kind': { type: 'number', role: 'measure', nullable: false }
          }
        })
      )
    );

    expect(errors.map((error) => error.message)).toEqual(
      expect.arrayContaining([
        '字段 row-kind 的 role 为 measure，此处要求 dimension',
        '行类别字段 row-kind 必须是 string 类型',
        '行类别字段 row-kind 在明细行上没有取值，必须允许为空'
      ])
    );
  });

  it('产出字段不得出现在数据行中', () => {
    const errors = validate(
      page(
        foldingSource({
          source: {
            type: 'inline',
            rows: [{ 'business-type': '类型A', jan: 100, 'row-kind': null }]
          }
        })
      )
    );

    expect(errors.map((error) => error.message)).toContain(
      '算子产出字段 row-kind 不得出现在数据行中，它由计算阶段产出'
    );
  });

  it('产出字段缺席结果字段契约被拒绝', () => {
    const { 'row-kind': _omitted, ...withoutRowKind } = forecastFields;
    const errors = validate(page(foldingSource({ fields: withoutRowKind })));

    expect(errors.map((error) => error.message)).toContain(
      '算子引用了未声明的字段:row-kind'
    );
  });

  it('ratio/delta 的输入必须是数值度量，产出不得重名', () => {
    const errors = validate(
      page({
        fields: {
          'business-type': { type: 'string', role: 'dimension' },
          done: { type: 'number', role: 'measure' },
          plan: { type: 'number', role: 'measure' },
          rate: { type: 'number', role: 'measure', nullable: true }
        },
        compute: [
          {
            op: 'ratio',
            numerator: 'done',
            denominator: 'plan',
            output: 'rate',
            onZeroDenominator: 'null'
          },
          {
            op: 'ratio',
            numerator: 'done',
            denominator: 'business-type',
            output: 'rate',
            onZeroDenominator: 'zero'
          }
        ],
        source: { type: 'inline', rows: [{ 'business-type': 'A', done: 1, plan: 2 }] }
      })
    );

    expect(errors.map((error) => error.message)).toEqual(
      expect.arrayContaining([
        '字段 business-type 的 role 为 dimension，此处要求 measure',
        '字段 business-type 的类型 string 不能参与数值算子',
        '算子产出字段重复:rate'
      ])
    );
  });

  it('pivot 的同一类别取值不得映射到两个目标列', () => {
    const errors = validate(
      page({
        fields: {
          activity: { type: 'string', role: 'dimension' },
          count: { type: 'number', role: 'measure' },
          a: { type: 'number', role: 'measure', nullable: true },
          b: { type: 'number', role: 'measure', nullable: true }
        },
        compute: [
          {
            op: 'pivot',
            categoryField: 'activity',
            valueField: 'count',
            columns: [
              { output: 'a', categories: ['专题交流'] },
              { output: 'b', categories: ['专题交流'] }
            ]
          }
        ],
        source: { type: 'inline', rows: [{ activity: '专题交流', count: 2 }] }
      })
    );

    expect(errors.map((error) => error.message)).toContain(
      '类别取值已映射到其它目标列:专题交流'
    );
  });

  it('声明 5.0 却使用计算阶段被能力下限拒绝', () => {
    const errors = validate({ ...page(foldingSource()), schemaVersion: '5.0' });

    expect(errors.map((error) => error.path)).toEqual(
      expect.arrayContaining([
        '/dataSources/forecast/compute',
        '/dataSources/forecast/fields/jan/collapsible'
      ])
    );
  });
});
