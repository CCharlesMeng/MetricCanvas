import { expect, it } from 'vitest';
import { barOption } from '../src/components/bar-chart/options';
import type { MainDataSlots } from '../src/shared/component-data';

it.each([
  {horizontal:false, a:30, b:10, risk:-5, value:35, coord:['A',40], position:'top'},
  {horizontal:true, a:30, b:10, risk:-5, value:35, coord:[40,'A'], position:'right'},
  {horizontal:false, a:-5, b:-10, risk:0, value:-15, coord:['A',-15], position:'bottom'},
  {horizontal:true, a:-5, b:-10, risk:0, value:-15, coord:[-15,'A'], position:'left'},
  {horizontal:false, a:30, b:10, risk:0, value:40, coord:['A',40], position:'top'}
])('keeps the net total outside the visible stack: $horizontal/$value', ({horizontal,a,b,risk,value,coord,position}) => {
  const data: MainDataSlots = {main:{fields:{
    name:{type:'string',role:'dimension'},
    a:{type:'number',role:'measure'}, b:{type:'number',role:'measure'}, risk:{type:'number',role:'measure'}
  },snapshot:{status:'ready',rows:[{name:'A',a,b,risk}]}}};
  const option=barOption(data,{categoryField:'name',series:[{field:'a'},{field:'b'},{field:'risk'}],stacked:true,showStackTotalLabels:true,horizontal});
  expect(option.series).toEqual(expect.arrayContaining([expect.objectContaining({markPoint:expect.objectContaining({
    label:expect.objectContaining({distance:8}),
    data:[expect.objectContaining({value,coord,label:{position}})]
  })})]));
});
