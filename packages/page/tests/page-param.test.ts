import { describe, expect, it } from 'vitest';
import {
  collectTextValueReferences,
  formatSuitsParamType,
  isTextValueReference,
  pageParamErrors,
  textValueScope,
  type PageParamDeclaration
} from '../src/page-param';
import { resolveTextValues, validationResolution } from '../src/text-value';
import { validate } from '../src/validate';

const param = (
  id: string,
  overrides: Partial<PageParamDeclaration> = {}
): PageParamDeclaration => ({ id, type: 'string', required: true, ...overrides });

describe('文本取值引用的形状识别', () => {
  it('只认 param 与可选 format 两个键', () => {
    expect(isTextValueReference({ param: 'code' })).toBe(true);
    expect(isTextValueReference({ param: 'amount', format: 'cny-adaptive' })).toBe(true);
    expect(isTextValueReference({ param: 'code', extra: 1 })).toBe(false);
    expect(isTextValueReference({ param: 1 })).toBe(false);
    expect(isTextValueReference({ param: 'code', format: 'nope' })).toBe(false);
    expect(isTextValueReference({ field: 'code' })).toBe(false);
    expect(isTextValueReference('code')).toBe(false);
  });

  it('数据源不在文本取值作用域内：请求体与数据行不会被误判为引用', () => {
    const document = {
      params: [param('code')],
      dataSources: {
        rows: {
          source: { type: 'inline', rows: [{ param: '看起来像引用但它是数据' }] }
        }
      },
      sections: [{ id: 's', components: [{ props: { title: { param: 'code' } } }] }]
    };

    expect(textValueScope(document)).not.toHaveProperty('dataSources');
    expect(collectTextValueReferences(document).map((usage) => usage.path)).toEqual([
      '/sections/0/components/0/props/title'
    ]);
  });
});

describe('文本取值整值替换', () => {
  const document = {
    sections: [
      {
        components: [
          {
            props: {
              title: { param: 'page-title' },
              badge: { param: 'code' },
              tags: [{ param: 'a' }, '固定标签', { param: 'b' }]
            }
          }
        ]
      }
    ]
  };

  it('引用解析为参数取值，可选参数缺失时属性消失、数组项被移除', () => {
    const resolved = resolveTextValues(document, {
      values: new Map<string, string>([
        ['page-title', 'XX云迁移项目'],
        ['b', '战略客户']
      ])
    }) as typeof document;

    expect(resolved.sections[0].components[0].props).toEqual({
      title: 'XX云迁移项目',
      tags: ['固定标签', '战略客户']
    });
  });

  it('引用可携带展示格式，格式化由调用方注入', () => {
    const resolved = resolveTextValues(
      { title: { param: 'amount', format: 'cny-adaptive' } },
      {
        values: new Map([['amount', 12_800_000]]),
        format: (value, format) => `${String(value)}@${format ?? 'text'}`
      }
    );

    expect(resolved).toEqual({ title: '12800000@cny-adaptive' });
  });

  it('缺省格式化只做字面量转字符串', () => {
    expect(
      resolveTextValues(
        { title: { param: 'count' } },
        { values: new Map([['count', 42]]) }
      )
    ).toEqual({ title: '42' });
  });

  it('校验期代入：必需参数取默认值或占位符，可选参数按缺席处理', () => {
    const resolution = validationResolution([
      param('code'),
      param('title', { label: '页面标题' }),
      param('count', { type: 'number' }),
      param('mtime', { default: '202604' }),
      param('tag', { required: false })
    ]);

    expect([...resolution.values]).toEqual([
      ['code', 'code'],
      ['title', '页面标题'],
      ['count', 0],
      ['mtime', '202604']
    ]);
  });
});

describe('格式与参数类型相容', () => {
  it('数值格式只配 number，日历格式只配 string，text 通用', () => {
    expect(formatSuitsParamType('cny-adaptive', 'number')).toBe(true);
    expect(formatSuitsParamType('cny-adaptive', 'string')).toBe(false);
    expect(formatSuitsParamType('date', 'string')).toBe(true);
    expect(formatSuitsParamType('date', 'number')).toBe(false);
    expect(formatSuitsParamType('text', 'boolean')).toBe(true);
  });
});

describe('页面参数不变式', () => {
  const referencing = (paramId: string) => ({
    sections: [{ components: [{ props: { title: { param: paramId } } }] }]
  });

  it('id 重复、与筛选器同名、默认值类型不符都被拒绝', () => {
    const errors = pageParamErrors(
      [param('code'), param('code'), param('region'), param('count', { type: 'number', default: 'x' })],
      new Set(['region']),
      {
        sections: [
          {
            components: [
              { props: { title: { param: 'code' } } },
              { props: { subtitle: { param: 'region' } } },
              { props: { badge: { param: 'count' } } }
            ]
          }
        ]
      }
    );

    expect(errors.map((error) => error.message)).toEqual([
      '页面参数 id 重复:code',
      '页面参数与筛选器同名:region;同一语义只能取一种形态',
      '默认值不符合参数类型 number'
    ]);
  });

  it('引用未声明参数被拒绝', () => {
    expect(pageParamErrors([param('code')], new Set(), referencing('typo'))).toEqual([
      expect.objectContaining({
        path: '/sections/0/components/0/props/title/param',
        message: '文本取值引用了未声明的页面参数:typo'
      }),
      expect.objectContaining({ path: '/params/0/id' })
    ]);
  });

  it('没有消费者的参数被拒绝', () => {
    const [error] = pageParamErrors([param('code')], new Set(), { sections: [] });
    expect(error?.message).toContain('没有任何消费者');
  });

  it('格式与参数类型不相容被拒绝', () => {
    const errors = pageParamErrors([param('code')], new Set(), {
      sections: [{ components: [{ props: { title: { param: 'code', format: 'percent-1' } } }] }]
    });
    expect(errors[0]?.path).toBe('/sections/0/components/0/props/title/format');
  });
});

describe('参数化页面的端到端校验', () => {
  const page = (overrides: Record<string, unknown>) => ({
    schemaVersion: '5.1',
    id: 'detail',
    dataSources: {
      info: {
        fields: { name: { type: 'string', role: 'dimension' } },
        source: { type: 'inline', rows: [{ name: '客户 A' }] }
      }
    },
    sections: [
      {
        id: 'head',
        components: [
          {
            id: 'header',
            type: 'reportHeader',
            layout: { span: 12 },
            props: { title: { param: 'page-title' }, tags: [{ param: 'level' }] }
          }
        ]
      }
    ],
    ...overrides
  });

  it('必需参数进标题、可选参数进标签的页面通过校验', () => {
    expect(
      validate(
        page({
          params: [
            { id: 'page-title', type: 'string', required: true },
            { id: 'level', type: 'string', required: false }
          ]
        })
      )
    ).toEqual([]);
  });

  it('必填文本属性引用可选参数被拒绝，并给出原因', () => {
    const errors = validate(
      page({
        params: [
          { id: 'page-title', type: 'string', required: false },
          { id: 'level', type: 'string', required: false }
        ]
      })
    );

    expect(errors.map((error) => error.message)).toContain(
      '可选页面参数缺失时引用处整体消失；必填文本属性只能引用必需参数'
    );
  });

  it('声明 5.0 却使用页面参数与文本取值引用，两处都被能力下限拒绝', () => {
    const errors = validate(
      page({
        schemaVersion: '5.0',
        params: [
          { id: 'page-title', type: 'string', required: true },
          { id: 'level', type: 'string', required: false }
        ]
      })
    );

    // 引用在解析接缝就会被整值替换掉，因此能力下限必须判在替换之前。
    expect(errors.map((error) => error.path)).toEqual(
      expect.arrayContaining([
        '/params',
        '/sections/0/components/0/props/title',
        '/sections/0/components/0/props/tags/0'
      ])
    );
  });
});
