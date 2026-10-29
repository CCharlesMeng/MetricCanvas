import { describe, expect, it } from 'vitest';
import fixture from '../fixtures/contract-valid/paged-union-composite-key.json';
import legacy from '../fixtures/contract-valid/paged-union-page.json';
import { parsePage } from '../src';

const document = () => structuredClone(fixture);
const contract = (d: ReturnType<typeof document>) => d.dataSources.opinions.source.members.contract;

describe('pagedUnion composite identity contract', () => {
  it('accepts ordered raw dimension references, preserves the input and keeps legacy declarations readable', () => {
    const d = document(), before = JSON.stringify(d);
    expect(parsePage(d).errors).toEqual([]);
    expect(JSON.stringify(d)).toBe(before);
    expect(parsePage(legacy).errors).toEqual([]);
  });
  it.each(['6.71', '5.4'])('rejects composite identity under %s', schemaVersion => {
    const parsed = parsePage({ ...document(), schemaVersion });
    expect(parsed.ok).toBe(false);
    expect(parsed.errors.some(error => error.path.includes('schemaVersion') || error.message.includes('6.72'))).toBe(true);
  });
  it.each([[], ['contract-approver'], ['contract-approver', 'contract-approver'], ['contract-approver', 'missing'], ['contract-approver', 'contract-decisionCount']])('rejects invalid fields %j', (...fields) => {
    const d = document(); contract(d).rowKeyFields = fields;
    expect(parsePage(d).ok).toBe(false);
  });
  it('rejects simultaneous scalar and composite declarations and nullable key fields', () => {
    const both = document(); Object.assign(contract(both), { rowKey: 'contract-localRowId' });
    expect(parsePage(both).ok).toBe(false);
    const nullable = document(); nullable.dataSources.contract.fields['contract-office'].nullable = true;
    expect(parsePage(nullable).errors.some(error => error.path.endsWith('/rowKeyFields/1'))).toBe(true);
  });
  it('validates captured identities by member, tuple length, position types and nonempty values', () => {
    const d = document();
    const row = { rowKey: '', memberId: 'contract', localRowId: '001', approverId: 'P01', approver: '审批人甲', regionId: 'R01', region: '示例东区', officeId: 'O01', office: '示例一处', roleId: 'ROLE01', role: '业务审核', decisionCount: 120, validOpinionCount: 90, validOpinionRate: 63, businessType: '合同', missingNote: '合同专属说明' };
    const initial = { capturedAt: '2026-10-29T00:00:00Z', rows: [row], totalCount: 1, view: { pageIndex: 0, pageSize: 20, sort: [{field:'decisionCount',direction:'desc'}], predicates: [] } };
    Object.assign(d.dataSources.opinions.source, { initial });
    for (const key of [['审批人甲', '示例一处'], ['审批人甲'], ['审批人甲', 1], ['审批人甲', null], ['审批人甲', '  '], '审批人甲']) {
      row.rowKey = JSON.stringify(['contract', key]);
      expect(parsePage(d).ok).toBe(Array.isArray(key) && key.length === 2 && key[1] === '示例一处');
    }
    row.rowKey = JSON.stringify(['unknown', ['审批人甲', '示例一处']]);
    expect(parsePage(d).ok).toBe(false);
    row.rowKey = JSON.stringify(['contract', ['审批人甲', '示例一处']]);
    initial.totalCount = 2;
    initial.rows.push({ ...row, rowKey: '["contract", ["审批人甲", "示例一处"]]' });
    expect(parsePage(d).errors.some(error => error.message.includes('组合行键不得重复'))).toBe(true);
  });
});
