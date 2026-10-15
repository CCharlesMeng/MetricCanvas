import { describe, expect, it } from 'vitest';
import fixture from '../fixtures/contract-valid/paged-join-page.json';
import { parsePage, resolvePageParams } from '../src';
import { affectedSourceIds, queryResultDependencies } from '../src/internal';

describe('pagedJoin protocol',()=>{
  it('accepts current version, rejects old version and isolates definition dependencies',()=>{
    const parsed=parsePage(fixture);expect(parsed.errors).toEqual([]);if(!parsed.ok)throw Error('fixture');
    expect(parsePage({...fixture,schemaVersion:'6.21'}).ok).toBe(false);
    expect(queryResultDependencies(parsed.page.dataSources['office-overview'])).toEqual([]);
    expect(affectedSourceIds(parsed.page.dataSources,['office-meeting']).has('office-overview')).toBe(true);
  });
  it.each(['source','key','projection','ordinal','scope','owner'])('rejects invalid %s',kind=>{
    const page=structuredClone(fixture),source=page.dataSources['office-overview'].source;
    if(kind==='source')source.members.meeting.source='missing';
    if(kind==='key')source.members.meeting.key.field='analysis-meeting-rate';
    if(kind==='projection')source.projection['bidding-amount'].field='missing';
    if(kind==='ordinal')source.ordinalField='bidding-amount';
    if(kind==='scope')delete (page.dataSources['office-meeting'].source as {resultScope?:string}).resultScope;
    if(kind==='owner')page.sections[0].components.push(structuredClone(page.sections[0].components[0]));
    expect(parsePage(page).ok).toBe(false);
  });
  it('does not infer the numberRange capability from ordinary title text',()=>{
    const page=structuredClone(fixture);delete (page.dataSources as Record<string,unknown>)['office-overview'];page.sections[0].components.splice(1,1);page.schemaVersion='6.21';page.sections[0].components[0].props.title='numberRange description';
    expect(parsePage(page).ok).toBe(true);
  });

});
