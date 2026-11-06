import { expect,it } from 'vitest';
import fixture from '../../../pages/capabilities/chart/chart-table-unit.json';
import { parsePage } from '../src/validate';
import { pageCapabilities, requiredMinorVersion } from '../src/version';
it('accepts explicit display units while preserving the input',()=>{
  const before=structuredClone(fixture);
  const parsed=parsePage(fixture);
  expect(parsed).toMatchObject({ok:true});expect(fixture).toEqual(before);
  expect(requiredMinorVersion(fixture)).toBe(94);
});
it('rejects new field series and recursive column units on older and legacy documents',()=>{
  for(const schemaVersion of ['6.85','6.93','5.4'])expect(parsePage({...fixture,schemaVersion}).ok).toBe(false);
  const paths=pageCapabilities['chart-table-display-unit'].usedAt(fixture);
  expect(paths).toContain('/sections/0/components/5/props/columns/1/children/0/unit');
});
it('rejects malformed units and permits old constant and pie-legend declarations',()=>{
  const raw=structuredClone(fixture);
  Object.assign(raw.sections[0].components[1].props,{series:[{field:'duration',unit:12}]});
  expect(parsePage(raw).ok).toBe(false);
  const old={sections:[{components:[{type:'barChart',props:{series:[{value:1,unit:'天'}]}},{type:'pieChart',props:{legend:{columns:[{field:'value',unit:'家'}]}}}]}]};
  expect(pageCapabilities['chart-table-display-unit'].usedAt(old)).toEqual([]);
});

it('preserves chart and table units when applied currency selects another money field',async()=>{
  const {default:currency}=await import('../../../pages/capabilities/ioc-header/scenarios/ioc-header-currency-demo.json');
  const {projectFieldSelections}=await import('../src/field-selection');
  const parsed=parsePage(currency);if(!parsed.ok)throw new Error(JSON.stringify(parsed.errors));
  const chart=parsed.page.sections[0].components[1],table=parsed.page.sections[0].components[2];
  if(chart.type!=='barChart'||table.type!=='table')throw new Error('wrong fixture components');
  chart.props.series[0].unit='业务金额';
  const column=table.props.columns[1];if(column.kind==='group')throw new Error('wrong fixture column');
  column.unit='业务金额';
  const projected=projectFieldSelections(parsed.page,new Map([['currency',{type:'dimension',values:['USD']}]]));
  expect(projected.sections[0].components[1].props).toMatchObject({series:[expect.objectContaining({unit:'业务金额'})]});
  expect(projected.sections[0].components[2].props).toMatchObject({columns:expect.arrayContaining([expect.objectContaining({unit:'业务金额',field:expect.objectContaining({field:'base-usd'})})])});
});
