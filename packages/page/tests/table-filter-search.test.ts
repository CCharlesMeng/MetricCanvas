import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { parsePage } from '../src/validate';
import { upgradePageDocument } from '../src/upgrade-document';
import { requiredMinorVersion } from '../src/version';
import { legacyTableCandidateSearch } from '../src/table/candidate-search';

function fixture(version = '6.112') {
  const document = JSON.parse(readFileSync('pages/capabilities/table/table-header-select-all.json', 'utf8'));
  document.schemaVersion = version;
  document.sections = [document.sections[0]];
  document.sections[0].components = document.sections[0].components.filter((component: {type:string}) => component.type === 'table').slice(0, 2);
  return document;
}

it.each([true, false, undefined])('accepts explicit search %s and omission for static and dynamic candidates', value => {
  const document = fixture();
  for (const table of document.sections[0].components) {
    if (value !== undefined) table.props.columns[1].filterable.showSearch = value;
  }
  expect(parsePage(document).errors).toEqual([]);
  if (value !== undefined) expect(requiredMinorVersion(document)).toBe(112);
});

it.each([true, false])('gates explicit search %s in old versions, including nested columns', value => {
  const document = fixture('6.111');
  const table = document.sections[0].components[0], column = table.props.columns[1];
  column.filterable.showSearch = value;
  table.props.columns = [{kind:'group',id:'group',title:'状态',children:[column]}];
  expect(parsePage(document)).toMatchObject({ok:false,errors:expect.arrayContaining([
    expect.objectContaining({path:'/sections/0/components/0/props/columns/0/children/0/filterable/showSearch',message:expect.stringContaining('6.112')})
  ])});
});

it.each(['yes', 1, {}, null])('rejects non-boolean search %j', value => {
  const document = fixture(); document.sections[0].components[0].props.columns[1].filterable.showSearch = value;
  expect(parsePage(document).ok).toBe(false);
});

it.each(['dateRange', 'numberRange'])('rejects search on %s controls', mode => {
  const document = fixture(); document.sections[0].components[0].props.columns[1].filterable = {mode,showSearch:true};
  expect(parsePage(document).ok).toBe(false);
});

it.each(['6.98','6.109','6.110','6.111','6.112'])('keeps the default after parsing and normalizing %s', version => {
  const document = fixture(version), parsed = parsePage(document);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) return;
  expect(legacyTableCandidateSearch(parsed.page.schemaVersion)).toBe(version !== '6.112');
  expect(parsePage(parsed.page).ok).toBe(true);
});

it('upgrades old pages without hiding dynamic search or adding search to static enums', () => {
  const document = fixture('6.111'), original = JSON.stringify(document);
  const result = upgradePageDocument(document);
  expect(result.ok).toBe(true);
  if (!result.ok) throw Error(JSON.stringify(result.errors));
  const tables = result.document.sections[0].components;
  expect(tables[0].type === 'table' && tables[0].props.columns[1]).toMatchObject({filterable:{mode:'select'}});
  expect(JSON.stringify(tables[0].type === 'table' && tables[0].props.columns[1])).not.toContain('showSearch');
  expect(tables[1].type === 'table' && tables[1].props.columns[1]).toMatchObject({filterable:{showSearch:true}});
  expect(result.changes).toContainEqual(expect.objectContaining({rule:'table-filter-search'}));
  expect(JSON.stringify(document)).toBe(original);
  expect(parsePage(result.document).ok).toBe(true);
  expect(upgradePageDocument(result.document)).toMatchObject({ok:true,changed:false});
});

it('preserves grouped dynamic columns inside a Tab when upgrading', () => {
  const document = fixture('6.111'), table = document.sections[0].components[1];
  table.props.columns = [{kind:'group',id:'status-group',title:'状态',children:[table.props.columns[1]]}];
  document.sections[0].components = [{id:'tabs',type:'tabContainer',layout:{span:12},props:{tabs:[{id:'main',label:'主表',components:[table]}]}}];
  const result = upgradePageDocument(document);
  expect(result.ok, JSON.stringify(result.errors)).toBe(true);
  if (!result.ok) return;
  expect(result.changes).toContainEqual(expect.objectContaining({path:'/sections/0/components/0/props/tabs/0/components/0/props/columns/0/children/0/filterable/showSearch'}));
  expect(parsePage(result.document).ok).toBe(true);
});
