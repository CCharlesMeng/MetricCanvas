import type { EChartsOption, SeriesOption } from 'echarts';
import { copyChartOption, type ChartSource } from './chart-option-extension';

function entries<T>(value:T|T[]|undefined):T[] {
  if(value===undefined)return [];
  return Array.isArray(value)?value:[value];
}

/** Keep the real chart configuration and canvas, without inventing result geometry. */
export function loadingChartOption(option:EChartsOption):EChartsOption {
  const copied=copyChartOption(option);
  return {...copied,animation:false,tooltip:{show:false},series:entries(copied.series).map(clearSeries)};
}
function clearSeries(series:SeriesOption):SeriesOption {
  return {...series,silent:true,label:{show:false},data:[]} as SeriesOption;
}
export function loadingChartSource(source:ChartSource):ChartSource {
  return {...source,base:source.base?loadingChartOption(source.base):undefined,
    extended:source.extended?loadingChartOption(source.extended):undefined};
}
