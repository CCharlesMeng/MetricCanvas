import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { parsePage } from '../packages/page/src/index';
import { flattenPageComponents } from '../packages/page/src/internal';
import { createTableController } from '../packages/engine/runtime-ui/src/table/controller';
import { applyComputation } from '../packages/data-execution/src/compute';
import { barOption } from '../packages/engine/widgets/src/components/bar-chart/options';
import { capabilityFloorErrors } from '../packages/page/src/version';

const path = 'pages/capabilities/table/partner-health-interactions.json';
const document = JSON.parse(readFileSync(path,'utf8'));
const parsed = parsePage(document);
if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
const page = parsed.page;

describe('partner health interaction contract', () => {
  it('does not treat raw query rows as detail-title declarations', () => {
    expect(capabilityFloorErrors({schemaVersion:'6.100',dataSources:{raw:{source:{type:'inline',rows:[{openDetail:{title:'业务值'}}]}}}})).toEqual([]);
  });
  it('sorts computed scores across the whole local result before pagination without a query', () => {
    const table = flattenPageComponents(page).find(component => component.id === 'region-table');
    if (table?.type !== 'table') throw Error('missing table');
    const source = page.dataSources.scores;
    if (source.source.type !== 'inline') throw Error('requires inline input');
    const rows = applyComputation(source.compute!,source.source.rows);
    const changed = vi.fn();
    const controller = createTableController(page,()=>null,changed);
    controller.sort(table,[{field:'total-score',direction:'asc'}]);
    expect(controller.present(table,rows).rows.map(row=>row.region)).toEqual(Array.from({length:10},(_,i)=>`合成地区部${String(i+1).padStart(2,'0')}`));
    controller.page(table,1);
    expect(controller.present(table,rows).rows.map(row=>row.region)).toEqual(['合成地区部11','合成地区部12']);
    controller.sort(table,[{field:'total-score',direction:'desc'}]);
    expect(controller.present(table,rows).rows[0].region).toBe('合成地区部12');
    expect(changed).toHaveBeenCalled();
    controller.dispose();
  });
  it('displays stack totals including negative risk scores', () => {
    const chart = flattenPageComponents(page).find(component=>component.type==='barChart');
    if (chart?.type!=='barChart') throw Error('missing chart');
    const source=page.dataSources.scores;
    if (source.source.type!=='inline') throw Error('requires inline input');
    const rows=applyComputation(source.compute!,source.source.rows);
    const option=barOption({main:{fields:source.fields,snapshot:{status:'ready',rows}}},chart.props);
    expect(option.series).toEqual(expect.arrayContaining([expect.objectContaining({markPoint:expect.objectContaining({data:expect.arrayContaining([expect.objectContaining({value:36})])})})]));
  });
  it.each(['unknown','conflict','old-version','empty','expression','other-slot'])('rejects invalid detail title: %s', kind => {
    const input=structuredClone(document);
    const detail=input.sections[0].components[1].props.columns[2].openDetail;
    if(kind==='unknown')detail.title={parts:[{field:'not-a-field'}]};
    if(kind==='conflict')detail.titleField='region';
    if(kind==='old-version')input.schemaVersion='6.105';
    if(kind==='empty')detail.title={parts:[]};
    if(kind==='expression')detail.title={parts:[{expression:'row.region'}]};
    if(kind==='other-slot')detail.title={parts:[{field:{data:'aux',field:'region'}}]};
    const result=parsePage(input);
    expect(result.ok).toBe(false);
    if(!result.ok)expect(result.errors.some(error=>error.path.includes('title'))).toBe(true);
  });
});
