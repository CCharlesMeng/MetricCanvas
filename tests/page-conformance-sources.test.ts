import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {appendIocComponentFixtures} from '../tools/scripts/page-conformance-sources';

it('retains published IOC component resources after all four key-office pages migrate',()=>{
  const names=['key-office-filter-demo','key-office-filter-target','key-office-priority-demo','key-office-priority-target'];
  const fixtures=new Map<string,unknown>(),outputs=new Map<string,string>();
  for(const name of names){
    const page=JSON.parse(readFileSync(`pages/capabilities/filters/${name}.json`,'utf8'));
    expect(page).not.toHaveProperty('iocHeader');
    expect(page.sections[0].components[0].type).toBe('iocHeader');
    fixtures.set(name,page);
  }
  appendIocComponentFixtures(fixtures,outputs);
  expect([...outputs.keys()]).toEqual(names.map(name=>`page/conformance/valid/ioc-component-${name}.json`));
  for(const name of names){
    const page=JSON.parse(outputs.get(`page/conformance/valid/ioc-component-${name}.json`)!);
    expect(page.id).toBe(name);expect(page.sections[0].components[0].type).toBe('iocHeader');
  }
});

it('keeps legacy aliases without adding aliases for unrelated current component pages',()=>{
  const page=JSON.parse(readFileSync('pages/capabilities/filters/key-office-filter-demo.json','utf8'));
  const legacy=structuredClone(page);legacy.iocHeader=legacy.sections[0].components.shift().props;
  const fixtures=new Map<string,unknown>([['legacy',legacy],['new-header-page',page]]),outputs=new Map<string,string>();
  appendIocComponentFixtures(fixtures,outputs);
  expect([...outputs.keys()]).toEqual(['page/conformance/valid/ioc-component-legacy.json']);
  expect(JSON.parse(outputs.get('page/conformance/valid/ioc-component-legacy.json')!)).not.toHaveProperty('iocHeader');
});
