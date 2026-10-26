import { describe, expect, it } from 'vitest';
import fixture from '../fixtures/contract-valid/paged-union-page.json';
import { parsePage, versionPolicy, migrateParamBindings } from '../src';
import { affectedSourceIds, definitionSourceIds, queryResultDependencies, tableColumnNavigation } from '../src/internal';

describe('pagedUnion result field contract', () => {
  it('is version-gated and separates definition invalidation from result dependencies', () => {
    const parsed = parsePage(fixture); expect(parsed.errors).toEqual([]); if (!parsed.ok) throw Error('fixture');
    expect(parsePage({ ...fixture, schemaVersion: '6.58' }).ok).toBe(false);
    expect(parsePage({ ...fixture, schemaVersion: versionPolicy.current }).ok).toBe(true);
    expect(definitionSourceIds(parsed.page.dataSources.opinions)).toEqual(['contract','commercial']);
    expect(queryResultDependencies(parsed.page.dataSources.opinions)).toEqual([]);
    expect(affectedSourceIds(parsed.page.dataSources, ['contract']).has('opinions')).toBe(true);
  });
  it('preserves the union capability floor during explicit parameter migration', () => {
    const result = migrateParamBindings(fixture);
    expect(result.ok).toBe(true);
    if (result.ok) { expect(result.document.schemaVersion).toBe(versionPolicy.current); expect(parsePage(result.document).ok).toBe(true); }
  });
  it('resolves navigation by row source and leaves unmatched sources as plain text', () => {
    const parsed = parsePage(fixture); if (!parsed.ok) throw Error('fixture');
    const table = parsed.page.sections[0].components[0]; if (table.type !== 'table') throw Error('table');
    const column = table.props.columns[0]; if (column.kind === 'group') throw Error('column');
    expect(tableColumnNavigation(column, { memberId: 'contract' })?.href).toBe('/pages/multi-source-contract-detail');
    expect(tableColumnNavigation(column, { memberId: 'commercial' })?.href).toBe('/pages/multi-source-commercial-detail');
    expect(tableColumnNavigation(column, { memberId: 'missing' })).toBeUndefined();
    expect(tableColumnNavigation(column, { memberId: 'constructor' })).toBeUndefined();
  });
  it.each(['missing-source','prototype-source','missing-projection','unknown-projection','incompatible-unit','nonnullable-null','invalid-key','member-window','shared-consumer','nested-member','navigation-unknown-field','navigation-unsafe-href'])('rejects %s', kind => {
    const document = structuredClone(fixture), source = document.dataSources.opinions.source;
    if (kind === 'missing-source') source.members.contract.source = 'missing';
    if (kind === 'prototype-source') source.members.contract.source = 'constructor';
    if (kind === 'missing-projection') Reflect.deleteProperty(source.members.contract.projection, 'approver');
    if (kind === 'unknown-projection') source.members.contract.projection.approver.field = 'missing';
    if (kind === 'incompatible-unit') Object.assign(document.dataSources.contract.fields['contract-decisionCount'], { unit: '万元' });
    if (kind === 'nonnullable-null') Object.assign(document.dataSources.opinions.fields.missingNote, { nullable: false });
    if (kind === 'invalid-key') source.members.contract.rowKey = 'contract-decisionCount';
    if (kind === 'member-window') Object.assign(document.dataSources.contract.source.query.body.dsl_list[0].order, { limit: 10 });
    if (kind === 'shared-consumer') { const second = structuredClone(document.sections[0].components[0]); second.id = 'second'; document.sections[0].components.push(second); }
    if (kind === 'nested-member') source.members.contract.source = 'opinions';
    if (kind === 'navigation-unknown-field') document.sections[0].components[0].props.columns[0].navigateBySource!.field = 'missing';
    if (kind === 'navigation-unsafe-href') document.sections[0].components[0].props.columns[0].navigateBySource!.cases.contract.href = 'javascript:alert(1)';
    expect(parsePage(document).ok).toBe(false);
  });
});
