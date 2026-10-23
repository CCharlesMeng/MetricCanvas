import type { Row } from '@metriccanvas/page/internal';
import seed from './seed.json';

export type MemberId = 'contract' | 'commercial';
export type SortField = 'decisionCount' | 'validOpinionCount' | 'validOpinionRate';
export interface SortRule { field: SortField; direction: 'asc' | 'desc'; }
export interface OpinionRow extends Row {
  rowKey: string;
  memberId: MemberId;
  localRowId: string;
  decisionCount: number;
  validOpinionCount: number;
  validOpinionRate: number | null;
}
export const memberIds: MemberId[] = ['contract', 'commercial'];
export const memberLabels: Record<MemberId, string> = {
  contract: seed.members.contract.label, commercial: seed.members.commercial.label
};

function normalizeSeed(memberId: MemberId, raw: Row): OpinionRow {
  const member = seed.members[memberId];
  const localRowId = String(raw['统计行编码']);
  const rate = raw['有效意见占比'];
  return {
    rowKey: JSON.stringify([memberId, localRowId]), memberId, localRowId,
    approver: raw['审批人'], approverId: raw['审批人编码'],
    region: raw['区域'], regionId: raw['区域编码'],
    office: raw['代表处'], officeId: raw['代表处编码'],
    role: raw['审批人角色'], roleId: raw['审批人角色编码'],
    businessType: member.label,
    decisionCount: Number(raw[member.decisionCountField]),
    validOpinionCount: Number(raw['有效意见数']),
    // Existing percent-* formats consume 0–100. This changes scale, never the formula.
    validOpinionRate: typeof rate === 'number' ? rate * 100 : null
  };
}

function generatedRow(memberId: MemberId, index: number): OpinionRow {
  const localRowId = String(index + 5).padStart(3, '0');
  const office = index % 4 + 1;
  const decisionCount = 79 - index % 79;
  return {
    rowKey: JSON.stringify([memberId, localRowId]), memberId, localRowId,
    approver: `审批人${String(index + 1).padStart(3, '0')}`, approverId: `P${index + 100}`,
    region: office <= 2 ? '示例东区' : '示例西区', regionId: office <= 2 ? 'R01' : 'R02',
    office: `示例${office}处`, officeId: `O0${office}`,
    role: index % 2 === 0 ? '业务审核' : '专业审核', roleId: `ROLE0${index % 2 + 1}`,
    businessType: seed.members[memberId].label, decisionCount,
    validOpinionCount: Math.floor(decisionCount * 0.55),
    validOpinionRate: index % 60
  };
}

/** Full arrays belong only to the synthetic upstream, never to the merge reader. */
export function createMemberRows(memberId: MemberId, generatedCount = 124): OpinionRow[] {
  return [
    ...seed.members[memberId].rows.map(raw => normalizeSeed(memberId, raw)),
    ...Array.from({ length: generatedCount }, (_, index) => generatedRow(memberId, index))
  ];
}

function compareValue(a: number | null, b: number | null, direction: SortRule['direction']): number {
  if (a === null) return b === null ? 0 : 1;
  if (b === null) return -1;
  return direction === 'asc' ? a - b : b - a;
}

export function compareOpinionRows(a: OpinionRow, b: OpinionRow, rules: readonly SortRule[]): number {
  for (const rule of rules) {
    const compared = compareValue(a[rule.field], b[rule.field], rule.direction);
    if (compared) return compared;
  }
  if (a.memberId !== b.memberId) return a.memberId < b.memberId ? -1 : 1;
  return a.localRowId < b.localRowId ? -1 : Number(a.localRowId !== b.localRowId);
}
