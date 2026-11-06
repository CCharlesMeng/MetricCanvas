import { expect, it } from 'vitest';
import { appendDisplayUnit } from '../src/shared/display-unit';
import { barOption } from '../src/components/bar-chart/options';
import { lineOption } from '../src/components/line-chart/options';
import { alignTableRows, alignedCellText, projectTableRows, tableRowColumn } from '../src/components/table/rows';
import type { MainDataSlots } from '../src/shared/component-data';
import type { BarChartProps } from '@metriccanvas/page/internal';

const data: MainDataSlots = { main: { fields: {
  category: { type:'string', role:'dimension' },
  duration: { type:'number', role:'measure', unit:'原单位', defaultFormat:'number-1' }
}, snapshot:{status:'ready',rows:[{category:'甲',duration:12.5},{category:'零',duration:0},{category:'负',duration:-2},{category:'空',duration:null}]} } };
interface Display {legend?:unknown;series:Array<{name:string;label:{formatter:(v:unknown)=>string};tooltip:{valueFormatter:(v:unknown)=>string};markPoint?:{label:{formatter:(v:unknown)=>string}}}>}
const series = [{field:'duration',label:'审批',unit:'天'}];

it('uses the explicit unit in every bar/line numeric presentation and the single-series legend',()=>{
  const before=structuredClone(data);
  const bars:BarChartProps[]=[
    {categoryField:'category',series,showValueLabels:true},
    {categoryField:'category',series,horizontal:true,showValueLabels:true},
    {categoryField:'category',series,variant:'reportForecast',showSegmentLabels:true,showStackTotalLabels:true},
    {categoryField:'category',series:[{...series[0],kind:'line',axis:'primary'}],showValueLabels:true}
  ];
  const options=[...bars.map(props=>barOption(data,props)),
    lineOption(data,{xField:'category',series,showValueLabels:true}),
    lineOption(data,{xField:'category',series,showPointLabels:true})] as unknown as Display[];
  for(const option of options){
    expect(option.legend).toBeDefined();
    const first=option.series[0];expect(first.name).toBe('审批（天）');
    for(const [value,text] of [[12.5,'12.5 天'],[0,'0 天'],[-2,'-2 天']] as const){
      expect(first.label.formatter({value})).toBe(text);
      expect(first.tooltip.valueFormatter(value)).toBe(text);
      if(first.markPoint)expect(first.markPoint.label.formatter({value})).toBe(text);
    }
    expect(first.tooltip.valueFormatter(null)).toBe('--');
  }
  expect(data).toEqual(before);
});
it('joins explicit units without repeating a preset suffix or changing scale',()=>{
  expect(appendDisplayUnit('12.5万',125000,'万元','compact-wan-1')).toBe('12.5 万元');
  expect(appendDisplayUnit('25.0%',25,'%','percent-1')).toBe('25.0%');
  expect(appendDisplayUnit('12.00美元',12,'美元','usd-adaptive')).toBe('12.00美元');
  expect(appendDisplayUnit('—',null,'天')).toBe('—');
  expect(appendDisplayUnit('暂无',undefined,'天')).toBe('暂无');
  expect(appendDisplayUnit('Infinity',Infinity,'天')).toBe('Infinity');
  expect(appendDisplayUnit('原文','原文','天')).toBe('原文');
});
it('preserves historical series names and values when unit is absent',()=>{
  const option=barOption(data,{categoryField:'category',series:[{field:'duration',label:'审批'}],showValueLabels:true}) as unknown as Display;
  expect(option.legend).toBeUndefined();expect(option.series[0].name).toBe('审批');
  expect(option.series[0].tooltip.valueFormatter(12.5)).toBe('12.5');
});
it('applies column units to aligned numeric cells and pinned rows, preserving enums and missing text',()=>{
  const rows=alignTableRows(data);
  expect(rows.map(row=>alignedCellText('duration',data,row,undefined,'天'))).toEqual(['12.5 天','0 天','-2 天','--']);
  expect(alignedCellText('category',data,rows[0],undefined,'天')).toBe('甲');
  expect(alignedCellText('duration',data,rows[0],[{value:12.5,label:'已完成'}],'天')).toBe('已完成');
  const summary={...data,summary:{fields:data.main.fields,snapshot:{status:'ready' as const,rows:[{duration:15}]}}};
  const column={field:'duration',unit:'天',pinnedTop:{field:{data:'summary',field:'duration'}}};
  const projected=projectTableRows(summary,{columns:[column],pinnedTop:{data:'summary'}});
  const pinned=tableRowColumn(column,projected[0],summary);
  expect(alignedCellText(pinned.field,summary,projected[0],undefined,pinned.unit)).toBe('15 天');
});
