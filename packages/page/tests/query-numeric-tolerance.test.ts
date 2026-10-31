import { describe, expect, it } from 'vitest';
import { normalizeQueryRows, validateContractRows, type QueryFieldDefinition } from '../src/internal';

const number: QueryFieldDefinition = { queryField: '数值', type: 'number', role: 'measure', nullable: false };
const money: QueryFieldDefinition = { queryField: '数值', type: 'money', role: 'measure', currency: 'CNY', nullable: false };

describe('查询数值度量容错', () => {
  it.each([number, money])('$type 未返回属性时保留行和字段，置空并按字段汇总告警', field => {
    const input = [{ 编码: 'A', 数值: 0 }, { 编码: 'B' }, { 编码: 'C', 数值: -4 }, { 编码: 'D' }];
    const original = structuredClone(input);
    const result = normalizeQueryRows(input, {
      key: { queryField: '编码', type: 'string', role: 'dimension', nullable: false }, value: field
    });
    expect(result).toMatchObject({ok:true,rows:[
      {key:'A',value:0},{key:'B',value:null},{key:'C',value:-4},{key:'D',value:null}
    ],warnings:[{code:'MISSING_NUMERIC_QUERY_FIELD',fieldId:'value',queryField:'数值',expectedType:field.type,count:2}]});
    expect(input).toEqual(original);
    expect(JSON.stringify(result)).not.toContain('cellFallbacks');
  });

  it('整列数值未返回也保留声明字段，可空声明仍记录缺列告警', () => {
    const result = normalizeQueryRows([{}, {}], { value: {...number,nullable:true} });
    expect(result).toMatchObject({ok:true,rows:[{value:null},{value:null}],warnings:[{
      code:'MISSING_NUMERIC_QUERY_FIELD',fieldId:'value',queryField:'数值',count:2
    }]});
  });

  it.each([number, money])('$type 保留有效值和全部行，不把缺失、布尔或对象变成零', field => {
    const values = [10, '--', null, ' 12.5 ', 0, -4, '', ' ', true, false, {}, [], 'bad', NaN, Infinity, -Infinity, '0x10', '1,000', '12%'];
    const input = values.map(value => ({ 数值: value }));
    const result = normalizeQueryRows(input, { value: field });
    expect(result.ok).toBe(true);
    if (!result.ok) throw Error('数值异常不得阻断查询');
    expect(result.rows.map(row => row.value)).toEqual([10, null, null, 12.5, 0, -4, ...Array(13).fill(null)]);
    expect(result.rows).toHaveLength(input.length);
    expect(input[1].数值).toBe('--');
    expect(result).toHaveProperty('warnings', expect.arrayContaining([
      expect.objectContaining({ fieldId: 'value', queryField: '数值', count: expect.any(Number) })
    ]));
    expect(JSON.stringify(result.warnings)).not.toContain('bad');
  });

  it('可空数值的正常 null 不告警；十进制、科学计数法转为有限数字', () => {
    const result = normalizeQueryRows([{ 数值: null }, { 数值: '1e2' }, { 数值: '-.5' }], { value: { ...number, nullable: true } });
    expect(result).toMatchObject({ ok: true, rows: [{ value: null }, { value: 100 }, { value: -0.5 }] });
    const missing = normalizeQueryRows([{ 数值: null }], { value: { ...number, nullable: true } });
    expect(missing).not.toHaveProperty('warnings');
  });

  it('大批异常只按字段和原因计数，诊断大小不随行数增长', () => {
    const result = normalizeQueryRows(Array.from({ length: 1000 }, () => ({ 数值: '--' })), { value: number });
    expect(result).toMatchObject({ ok: true, warnings: [{ fieldId: 'value', queryField: '数值', code: 'INVALID_NUMERIC_VALUE', count: 1000 }] });
    if (result.ok) expect(result.warnings).toHaveLength(1);
  });

  it('嵌套明细的数值项采用相同规则，但维度和结构继续严格校验', () => {
    const detail: QueryFieldDefinition = { queryField: '明细', type: 'recordList', role: 'detail', items: { fields: {
      key: { queryField: '编码', type: 'string', role: 'dimension', nullable: false },
      value: number, amount: { ...money, queryField: '金额' }
    } } };
    const input = [{ 明细: [{ 编码: 'A', 数值: '--', 金额: '12.5' }, { 编码: 'B', 数值: null, 金额: true }] }];
    expect(normalizeQueryRows(input, { detail })).toMatchObject({ ok: true, rows: [{ detail: [
      { key: 'A', value: null, amount: 12.5 }, { key: 'B', value: null, amount: null }
    ] }] });
    for (const value of [[{ 编码: null, 数值: 1, 金额: 1 }], ['bad'], [{ 编码: 'A', 金额: 1 }]]) {
      expect(normalizeQueryRows([{ 明细: value }], { detail }).ok).toBe(false);
    }
  });

  it('缺维度字段、行结构与 inline 继续严格；标量失配保留展示证据而不提升类型', () => {
    expect(normalizeQueryRows([{}], { value: { ...number, role: 'dimension' } })).toMatchObject({
      ok: false, issues: [{code: 'MISSING_QUERY_FIELD', rowIndex: 0, fieldId: 'value', queryField: '数值', actualFields: []}]
    });
    expect(normalizeQueryRows([null], { value: number })).toEqual({ok:false,issues:[{code:'ROW_NOT_OBJECT',rowIndex:0}]});
    for (const value of ['--', '12', null]) {
      expect(normalizeQueryRows([{ 数值: value }], { value: { ...number, role: 'dimension' } })).toMatchObject({ok:true,rows:[{value:null}]});
    }
    expect(normalizeQueryRows([{ 数值: 12 }], { value: { queryField: '数值', type: 'string', role: 'dimension' } })).toMatchObject({ok:true,rows:[{value:null}],cellFallbacks:{0:{value:{raw:12}}}});
    for (const value of ['--', '12', null]) expect(validateContractRows([{ value }], { value: number }).ok).toBe(false);
  });
});
