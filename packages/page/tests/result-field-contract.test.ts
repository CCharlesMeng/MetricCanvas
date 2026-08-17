import { describe, expect, it } from 'vitest';
import {
  MAX_DETAIL_RECORDS,
  MAX_SEMANTIC_HTML_LENGTH,
  matchesFieldValue,
  normalizeQueryRows,
  validateContractRows,
  type FieldDefinition,
  type FieldType,
  type QueryFieldDefinition
} from '../src';

/**
 * 结果字段契约共享校验(issue #50):inline 数据校验与查询结果归一化
 * 必须调用同一实现。这里把两条路径放进同一组表驱动用例,任何一条
 * 规则漂移都会让两路结论不一致而失败。
 */

interface Verdict {
  ok: boolean;
  codes: string[];
}

/** inline 路径:数据行已在稳定页面字段空间,直接走共享公开接口。 */
function inlineVerdict(field: FieldDefinition, value: unknown): Verdict {
  const result = validateContractRows([{ f: value }], { f: field });
  return { ok: result.ok, codes: result.issues.map((issue) => issue.code) };
}

/** 查询结果路径:内嵌初始行与数据网关共用的归一化(经查询字段映射)。 */
function queryVerdict(field: FieldDefinition, value: unknown): Verdict {
  const mapping = withQueryFields(field);
  const result = normalizeQueryRows([{ RAW: value }], { f: mapping });
  return { ok: result.ok, codes: result.issues.map((issue) => issue.code) };
}

function withQueryFields(field: FieldDefinition): QueryFieldDefinition {
  if (field.type === 'recordList') {
    return {
      ...field,
      queryField: 'RAW',
      items: {
        fields: Object.fromEntries(
          Object.entries(field.items.fields).map(([itemFieldId, item]) => [
            itemFieldId,
            { ...item, queryField: `RAW_${itemFieldId}` }
          ])
        )
      }
    };
  }
  return { ...field, queryField: 'RAW' };
}

/** 查询路径的原始明细项使用 DQE 字段名;由 withQueryFields 的约定改写。 */
function rawDetailItem(
  item: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(item).map(([key, value]) => [`RAW_${key}`, value])
  );
}

function bothVerdicts(field: FieldDefinition, value: unknown): [Verdict, Verdict] {
  return [inlineVerdict(field, value), queryVerdict(field, value)];
}

const scalarRules: Array<{
  type: FieldType;
  accepted: unknown[];
  rejected: unknown[];
}> = [
  {
    type: 'string',
    accepted: ['华东', '', '41.67%'],
    rejected: [42, true, ['华东'], { value: '华东' }]
  },
  {
    type: 'number',
    accepted: [0, -12.5, 128600],
    rejected: ['42', true, [42]]
  },
  {
    type: 'boolean',
    accepted: [true, false],
    rejected: ['true', 0, 1]
  },
  {
    type: 'date',
    accepted: ['2026-08-13', '2024-02-29'],
    rejected: ['2026-8-13', '2026-13-01', '2026-02-30', '20260813', '2026-08-13T10:00', 1723500000]
  },
  {
    type: 'datetime',
    accepted: [
      '2026-08-13T10:00',
      '2026-08-13T10:00:00Z',
      '2026-08-13T10:00:00.123+08:00'
    ],
    rejected: ['2026-08-13', '2026-08-13 10:00:00', 'T10:00', 42]
  }
];

describe('结果字段契约:标量类型规则(表驱动,两条路径同一实现)', () => {
  it.each(scalarRules)(
    '$type 的接受与拒绝在 inline 与查询结果路径完全一致',
    ({ type, accepted, rejected }) => {
      const field: FieldDefinition = { type, role: 'dimension', nullable: false };
      for (const value of accepted) {
        const [inline, query] = bothVerdicts(field, value);
        expect(inline).toEqual({ ok: true, codes: [] });
        expect(query).toEqual({ ok: true, codes: [] });
      }
      for (const value of rejected) {
        const [inline, query] = bothVerdicts(field, value);
        expect(inline).toEqual({ ok: false, codes: ['TYPE_MISMATCH'] });
        expect(query).toEqual({ ok: false, codes: ['TYPE_MISMATCH'] });
      }
    }
  );

  it.each(scalarRules)('$type 的 nullable 语义在两条路径一致', ({ type }) => {
    const rejecting: FieldDefinition = { type, role: 'dimension', nullable: false };
    for (const verdict of bothVerdicts(rejecting, null)) {
      expect(verdict).toEqual({ ok: false, codes: ['NULL_NOT_ALLOWED'] });
    }

    const allowing: FieldDefinition = { type, role: 'dimension', nullable: true };
    const defaulted: FieldDefinition = { type, role: 'dimension' };
    for (const field of [allowing, defaulted]) {
      for (const verdict of bothVerdicts(field, null)) {
        expect(verdict).toEqual({ ok: true, codes: [] });
      }
    }
  });
});

describe('结果字段契约:货币金额字段', () => {
  const field: FieldDefinition = {
    type: 'money',
    role: 'measure',
    currency: 'CNY',
    nullable: false
  };

  it('inline 与查询结果路径只接受有限数字', () => {
    for (const value of [0, -0, 12.5, -13_123_173.26]) {
      for (const verdict of bothVerdicts(field, value)) {
        expect(verdict).toEqual({ ok: true, codes: [] });
      }
    }

    for (const value of ['12.5', Number.NaN, Number.POSITIVE_INFINITY]) {
      for (const verdict of bothVerdicts(field, value)) {
        expect(verdict).toEqual({ ok: false, codes: ['TYPE_MISMATCH'] });
      }
    }
  });

  it('沿用结果字段契约的 nullable 语义', () => {
    for (const verdict of bothVerdicts(field, null)) {
      expect(verdict).toEqual({ ok: false, codes: ['NULL_NOT_ALLOWED'] });
    }
    for (const verdict of bothVerdicts({ ...field, nullable: true }, null)) {
      expect(verdict).toEqual({ ok: true, codes: [] });
    }
  });
});

describe('结果字段契约:明细字段规则(两条路径同一实现)', () => {
  const recordListField: FieldDefinition = {
    type: 'recordList',
    role: 'detail',
    nullable: false,
    items: {
      fields: {
        service: { type: 'string', role: 'dimension', nullable: false },
        delta: { type: 'number', role: 'measure', nullable: false }
      }
    }
  };

  it('接受符合项契约的一层对象数组与空数组', () => {
    const inlineRows = [
      { f: [{ service: 'ModelArts', delta: -20 }] },
      { f: [] }
    ];
    const inline = validateContractRows(inlineRows, { f: recordListField });
    expect(inline).toEqual({ ok: true, issues: [] });

    const query = normalizeQueryRows(
      [
        { RAW: [rawDetailItem({ service: 'ModelArts', delta: -20 })] },
        { RAW: [] }
      ],
      { f: withQueryFields(recordListField) }
    );
    expect(query.ok).toBe(true);
    if (query.ok) {
      expect(query.rows).toEqual([
        { f: [{ service: 'ModelArts', delta: -20 }] },
        { f: [] }
      ]);
    }
  });

  it('项字段类型与 nullable 违规在两条路径同类上报', () => {
    const badType = [{ service: 'ModelArts', delta: '非数字' }];
    const badNull = [{ service: null, delta: -20 }];

    expect(inlineVerdict(recordListField, badType).codes).toEqual([
      'DETAIL_TYPE_MISMATCH'
    ]);
    expect(inlineVerdict(recordListField, badNull).codes).toEqual([
      'DETAIL_NULL_NOT_ALLOWED'
    ]);
    expect(
      queryVerdict(recordListField, badType.map(rawDetailItem)).codes
    ).toEqual(['DETAIL_TYPE_MISMATCH']);
    expect(
      queryVerdict(recordListField, badNull.map(rawDetailItem)).codes
    ).toEqual(['DETAIL_NULL_NOT_ALLOWED']);
  });

  it('明细项数量上限与非对象项在两条路径同类上报', () => {
    const oversized = Array.from({ length: MAX_DETAIL_RECORDS + 1 }, () => ({
      service: 'x',
      delta: 1
    }));
    expect(inlineVerdict(recordListField, oversized).codes).toEqual([
      'DETAIL_LIST_TOO_LARGE'
    ]);
    expect(
      queryVerdict(recordListField, oversized.map(rawDetailItem)).codes
    ).toEqual(['DETAIL_LIST_TOO_LARGE']);

    expect(inlineVerdict(recordListField, ['非对象']).codes).toEqual([
      'DETAIL_ITEM_NOT_OBJECT'
    ]);
    expect(queryVerdict(recordListField, ['非对象']).codes).toEqual([
      'DETAIL_ITEM_NOT_OBJECT'
    ]);
  });

  it('semanticHtml 的类型、nullable 与长度上限在两条路径一致', () => {
    const field: FieldDefinition = {
      type: 'semanticHtml',
      role: 'detail',
      nullable: false
    };
    const html = '<span class="tone-negative">-12.0万</span>';
    for (const verdict of bothVerdicts(field, html)) {
      expect(verdict).toEqual({ ok: true, codes: [] });
    }
    for (const verdict of bothVerdicts(field, null)) {
      expect(verdict).toEqual({ ok: false, codes: ['NULL_NOT_ALLOWED'] });
    }
    for (const verdict of bothVerdicts(field, 42)) {
      expect(verdict).toEqual({ ok: false, codes: ['TYPE_MISMATCH'] });
    }
    for (const verdict of bothVerdicts(field, 'x'.repeat(MAX_SEMANTIC_HTML_LENGTH + 1))) {
      expect(verdict).toEqual({ ok: false, codes: ['SEMANTIC_HTML_TOO_LARGE'] });
    }
  });
});

describe('结果字段契约:错误只报告行号、字段名与错误分类', () => {
  const sentinel = '机密客户名-绝不入错误信息';

  it('inline 路径的结构化失败不回显业务字段值', () => {
    const result = validateContractRows([{ amount: sentinel }], {
      amount: { type: 'number', role: 'measure', nullable: false }
    });
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual([
      {
        code: 'TYPE_MISMATCH',
        rowIndex: 0,
        fieldId: 'amount',
        expectedType: 'number'
      }
    ]);
    expect(JSON.stringify(result)).not.toContain(sentinel);
  });

  it('查询结果路径的结构化失败不回显业务字段值', () => {
    const result = normalizeQueryRows([{ 金额: sentinel }], {
      amount: {
        queryField: '金额',
        type: 'number',
        role: 'measure',
        nullable: false
      }
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual([
        {
          code: 'TYPE_MISMATCH',
          rowIndex: 0,
          fieldId: 'amount',
          queryField: '金额',
          expectedType: 'number'
        }
      ]);
    }
    expect(JSON.stringify(result)).not.toContain(sentinel);
  });

  it('明细项违规也不回显业务字段值', () => {
    const field: FieldDefinition = {
      type: 'recordList',
      role: 'detail',
      items: {
        fields: { reason: { type: 'number', role: 'measure' } }
      }
    };
    const inline = validateContractRows([{ f: [{ reason: sentinel }] }], {
      f: field
    });
    const query = normalizeQueryRows([{ RAW: [{ RAW_reason: sentinel }] }], {
      f: withQueryFields(field)
    });
    expect(inline.ok).toBe(false);
    expect(query.ok).toBe(false);
    expect(JSON.stringify(inline)).not.toContain(sentinel);
    expect(JSON.stringify(query)).not.toContain(sentinel);
  });
});

describe('结果字段契约:行集合校验', () => {
  const fields: Record<string, FieldDefinition> = {
    region: { type: 'string', role: 'dimension', nullable: false }
  };

  it('拒绝非数组行集与非对象行', () => {
    expect(validateContractRows('not-rows', fields).issues).toEqual([
      { code: 'ROWS_NOT_ARRAY' }
    ]);
    expect(validateContractRows(['not-object'], fields).issues).toEqual([
      { code: 'ROW_NOT_OBJECT', rowIndex: 0 }
    ]);
    const query = normalizeQueryRows('not-rows', {
      region: { queryField: '区域', type: 'string', role: 'dimension' }
    });
    expect(query.issues).toEqual([{ code: 'ROWS_NOT_ARRAY' }]);
  });

  it('拒绝未声明字段与缺少字段,并携带行号与字段名', () => {
    const result = validateContractRows([{ unexpected: 1 }], fields);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        { code: 'UNDECLARED_FIELD', rowIndex: 0, fieldId: 'unexpected' },
        { code: 'MISSING_FIELD', rowIndex: 0, fieldId: 'region' }
      ])
    );
  });

  it('matchesFieldValue 是同一实现的布尔简写', () => {
    const field: FieldDefinition = { type: 'date', role: 'dimension' };
    expect(matchesFieldValue('2026-08-13', field)).toBe(true);
    expect(matchesFieldValue('2026-02-30', field)).toBe(false);
    expect(matchesFieldValue(null, field)).toBe(true);
    expect(matchesFieldValue(null, { ...field, nullable: false })).toBe(false);
  });
});
