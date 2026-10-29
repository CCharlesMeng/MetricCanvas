import { describe, expect, it } from 'vitest';
import fixture from '../fixtures/contract-valid/paged-union-generated-key.json';
import { parsePage } from '../src';

describe('explicit generated pagedUnion identities', () => {
  it('accepts nullable business dimensions without a business row key', () => {
    expect(parsePage(fixture).errors).toEqual([]);
    const old = {...fixture,schemaVersion:'6.72'};
    expect(parsePage(old).errors.some(error=>error.message.includes('6.73'))).toBe(true);
  });
  it.each(['rowKey','rowKeyFields'])('rejects combining uuid generation with %s', property => {
    const d=structuredClone(fixture), member=d.dataSources.opinions.source.members.contract;
    Object.assign(member,{[property]:property==='rowKey'?'contract-localRowId':['contract-approver','contract-office']});
    expect(parsePage(d).ok).toBe(false);
  });
  it('rejects an unsupported generator and missing identity strategy', () => {
    const d=structuredClone(fixture);
    d.dataSources.opinions.source.members.contract.rowKeyGeneration='random';
    expect(parsePage(d).ok).toBe(false);
    Reflect.deleteProperty(d.dataSources.opinions.source.members.contract,'rowKeyGeneration');
    expect(parsePage(d).ok).toBe(false);
  });
});
