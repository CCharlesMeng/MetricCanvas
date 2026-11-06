import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {parsePage} from '../src/validate';
import {requiredMinorVersion} from '../src/version';

const sample=()=>JSON.parse(readFileSync('pages/capabilities/ioc-header/controls/ioc-header-controls.json','utf8'));
const selectionPath='/sections/0/components/1/props/columns/1/selection/writes/region';

describe('table selection level',()=>{
  it('writes the implicit Header Region with explicit levels and retains the authored source',()=>{
    const source=sample(),before=JSON.stringify(source),parsed=parsePage(source);
    expect(parsed.ok).toBe(true);if(!parsed.ok)return;
    expect(source.filters.some((filter:{id:string})=>filter.id==='region')).toBe(false);
    expect(parsed.page.filters?.find(filter=>filter.id==='region')).toMatchObject({defaultLevel:'geo'});
    expect(requiredMinorVersion(source)).toBe(95);
    expect(JSON.stringify(source)).toBe(before);
  });
  it('accepts fixed values with a level',()=>{
    const source=sample();source.sections[0].components[1].props.columns[1].selection.writes.region={value:'上海代表处',level:'office'};
    expect(parsePage(source).ok).toBe(true);
  });
  it.each(['unknown',''])('rejects invalid level %j at the write location',level=>{
    const source=sample();source.sections[0].components[1].props.columns[1].selection.writes.region.level=level;
    const parsed=parsePage(source);expect(parsed.ok).toBe(false);if(parsed.ok)return;
    expect(parsed.errors.some(error=>error.path.startsWith(selectionPath))).toBe(true);
    if(level)expect(parsed.errors).toContainEqual(expect.objectContaining({path:selectionPath+'/level'}));
  });
  it('rejects a level on an ordinary dimension',()=>{
    const source=sample();source.filters.push({id:'flat',type:'dimension',dimension:'office',options:[{value:'上海代表处',label:'上海代表处'}]});
    source.sections[0].components[1].props.columns[1].selection.writes={flat:{value:'上海代表处',level:'office'}};
    const parsed=parsePage(source);expect(parsed.ok).toBe(false);if(parsed.ok)return;
    expect(parsed.errors).toContainEqual(expect.objectContaining({path:selectionPath.replace('/region','/flat')+'/level'}));
  });
  it('keeps omitted levels compatible with existing declarations',()=>{
    const source=sample();source.schemaVersion='6.91';
    for(const column of source.sections[0].components[1].props.columns)delete column.selection.writes.region.level;
    expect(parsePage(source).ok).toBe(true);expect(requiredMinorVersion(source)).toBe(91);
  });
  it('enforces the new capability floor in grouped columns',()=>{
    const source=sample(),table=source.sections[0].components[1];source.schemaVersion='6.94';
    table.props.columns=[{kind:'group',id:'organizations',title:'组织',children:table.props.columns}];
    const parsed=parsePage(source);expect(parsed.ok).toBe(false);if(parsed.ok)return;
    expect(parsed.errors.some(error=>error.path==='/sections/0/components/1/props/columns/0/children/1/selection/writes/region/level')).toBe(true);
  });
});
