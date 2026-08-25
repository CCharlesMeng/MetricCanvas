import { describe, expect, it } from 'vitest';
import { validate } from '../src/validate';

const forecastSource = (overrides: Record<string, unknown> = {}) => ({
  fields: {
    'business-type': { type: 'string', role: 'dimension' },
    'row-kind': { type: 'string', role: 'dimension', nullable: true },
    jan: { type: 'number', role: 'measure', collapsible: true, nullable: true }
  },
  compute: [
    {
      op: 'groupSubtotal',
      groupBy: 'business-type',
      measures: ['jan'],
      rowKind: { field: 'row-kind', value: 'subtotal' },
      labelSuffix: '合计'
    }
  ],
  source: { type: 'inline', rows: [{ 'business-type': '类型A', jan: 100 }] },
  ...overrides
});

const page = (tableProps: Record<string, unknown>, source = forecastSource()) => ({
  schemaVersion: '5.1',
  id: 'forecast',
  dataSources: { forecast: source },
  sections: [
    {
      id: 'body',
      components: [
        {
          id: 'grid',
          type: 'table',
          layout: { span: 12 },
          data: { main: 'forecast' },
          props: { columns: [{ field: 'business-type' }, { field: 'jan' }], ...tableProps }
        }
      ]
    }
  ]
});

describe('表格呈现能力', () => {
  it('行类别字段 + 首列合并的表格通过校验', () => {
    expect(
      validate(page({ rowKindField: 'row-kind', mergeBy: 'business-type' }))
    ).toEqual([]);
  });

  it('行类别字段必须确由折叠算子写入：跨层契约两侧同时校验', () => {
    const errors = validate(
      page({ rowKindField: 'business-type' })
    );

    expect(errors.map((error) => error.message)).toContain(
      '行类别字段 business-type 没有任何折叠算子写入；小计与合计由计算阶段产出，表格只识别不计算'
    );
  });

  it('行类别字段不在数据源中被拒绝', () => {
    const errors = validate(page({ rowKindField: 'typo' }));
    expect(errors.map((error) => error.message)).toContain(
      '行类别字段 typo 不在数据源 forecast 中'
    );
  });

  it('mergeBy 必须是表格已声明的列字段', () => {
    const errors = validate(page({ mergeBy: 'row-kind' }));
    expect(errors.map((error) => error.message)).toContain(
      'mergeBy 必须是表格已声明的列字段:row-kind'
    );
  });

  it('声明 5.0 却使用呈现属性被能力下限拒绝', () => {
    const document = page({ rowKindField: 'row-kind', mergeBy: 'business-type' });
    const errors = validate({ ...document, schemaVersion: '5.0' });

    expect(errors.map((error) => error.path)).toEqual(
      expect.arrayContaining([
        '/sections/0/components/0/props/rowKindField',
        '/sections/0/components/0/props/mergeBy'
      ])
    );
  });
});

describe('信息面板与字段长文本', () => {
  const infoPage = (components: unknown[]) => ({
    schemaVersion: '5.1',
    id: 'detail',
    dataSources: {
      info: {
        fields: {
          owner: { type: 'string', role: 'dimension' },
          background: { type: 'string', role: 'dimension', nullable: true },
          notes: { type: 'recordList', role: 'detail', items: { fields: { a: { type: 'string', role: 'dimension' } } } }
        },
        source: { type: 'inline', rows: [{ owner: '张三', background: '项目背景…', notes: [] }] }
      }
    },
    sections: [{ id: 'body', components }]
  });

  it('两个组件都通过校验', () => {
    expect(
      validate(
        infoPage([
          {
            id: 'panel',
            type: 'keyValuePanel',
            layout: { span: 12 },
            data: { main: 'info' },
            props: { title: '项目基本信息', columns: 3, items: [{ label: 'Owner', field: 'owner' }] }
          },
          {
            id: 'background',
            type: 'fieldText',
            layout: { span: 12 },
            data: { main: 'info' },
            props: { title: '项目背景', field: 'background' }
          }
        ])
      )
    ).toEqual([]);
  });

  it('信息面板不得绑定嵌套明细字段', () => {
    const errors = validate(
      infoPage([
        {
          id: 'panel',
          type: 'keyValuePanel',
          layout: { span: 12 },
          data: { main: 'info' },
          props: { items: [{ label: '备注', field: 'notes' }] }
        }
      ])
    );

    expect(errors.map((error) => error.path)).toContain(
      '/sections/0/components/0/props/items/0/field'
    );
  });

  it('长文本引用未知字段被拒绝', () => {
    const errors = validate(
      infoPage([
        {
          id: 'background',
          type: 'fieldText',
          layout: { span: 12 },
          data: { main: 'info' },
          props: { field: 'typo' }
        }
      ])
    );

    expect(errors.map((error) => error.message)).toContain(
      '字段 typo 不在数据槽 main 的数据源 info 中'
    );
  });

  it('声明 5.0 却使用新组件被能力下限拒绝', () => {
    const document = infoPage([
      {
        id: 'panel',
        type: 'keyValuePanel',
        layout: { span: 12 },
        data: { main: 'info' },
        props: { items: [{ label: 'Owner', field: 'owner' }] }
      }
    ]);
    const errors = validate({ ...document, schemaVersion: '5.0' });

    expect(errors.map((error) => error.path)).toContain('/sections/0/components/0');
  });
});
