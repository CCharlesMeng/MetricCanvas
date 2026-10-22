import {expect,it} from 'vitest';
import * as echarts from 'echarts';
import scene from '../../../../pages/capabilities/chart/bar-width-defaults.json';
import {flattenPageComponents,parsePage,resolveDataSourceFields} from '@metriccanvas/page/internal';
import {barOption,barSeriesOrder} from '../src/components/bar-chart/options';
import {chartSource} from '../src/shared/chart-option-extension';
import type {MainDataSlots} from '../src/shared/component-data';

const parsed=parsePage(scene);
if(!parsed.ok)throw Error(JSON.stringify(parsed.errors));
const data:MainDataSlots={main:{fields:resolveDataSourceFields(parsed.page.dataSources.sample!),snapshot:{status:'ready',rows:scene.dataSources.sample.source.rows}}};
const charts=flattenPageComponents(parsed.page).filter(component=>component.type==='barChart');

it('消费完整验收页：六类柱图默认16px，显式32px覆盖保留',()=>{
  expect(charts).toHaveLength(7);
  for(const component of charts){
    const source=chartSource(()=>barOption(data,component.props),component.props,{componentId:component.id,componentType:'barChart',path:'/props/echartsOption'},barSeriesOrder(component.props));
    expect(source.failure).toBeUndefined();
    const option=source.extended??source.base!;
    for(const series of Array.isArray(option.series)?option.series:[]){
      if(series.type==='bar')expect(series.barWidth,component.id).toBe(component.id==='override'?32:16);
      else expect(series).not.toHaveProperty('barWidth');
    }
  }
});

for(const width of [390,1440])for(const id of ['normal','horizontal'])it(`${id}在${width}px画布中实际绘制16px柱宽`,()=>{
  const component=charts.find(component=>component.id===id)!;
  const chart=echarts.init(null,undefined,{renderer:'svg',ssr:true,width,height:400});
  try{
    chart.setOption({...barOption(data,component.props),animation:false});
    const paths=[...chart.renderToSVGString().matchAll(/<path d="([^"]+)"[^>]*ecmeta_series_index="0"[^>]*ecmeta_data_index="\d+"/g)];
    expect(paths).toHaveLength(3);
    for(const [,path] of paths){
      const rectangle=/l(-?[\d.]+) 0l0 (-?[\d.]+)/.exec(path!)!;
      expect(Math.abs(Number(rectangle[id==='horizontal'?2:1]))).toBe(16);
    }
  }finally{chart.dispose();}
});
