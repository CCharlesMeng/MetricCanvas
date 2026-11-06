import {expect,it} from 'vitest';
import {valueFormatPresets} from '@metriccanvas/page/internal';
import {formatValue} from '../src/shared/value-format';
import {formatChartNumber} from '../src/shared/chart-option';
import {formatTableCell} from '../src/components/table/cell-presentation';

it.each(valueFormatPresets)('%s renders actual missing values as exactly two adjacent ASCII hyphens',format=>{
  for(const value of [null,undefined,NaN,Infinity,-Infinity]){
    expect(formatValue(value,format)).toBe('--');
    expect(formatTableCell(value,format)).toBe('--');
    expect(formatChartNumber(value,format,undefined,'%', '天')).toBe('--');
  }
});
it.each(['—','–','-','- -','--','--%','- -%'])('normalizes legacy missing placeholder %s without rewriting real strings',text=>{
  expect(formatValue(null,'percent-1',text)).toBe('--');
  expect(formatChartNumber(null,'percent-1',text)).toBe('--');
  expect(formatValue(text,'text')).toBe(text);
  expect(formatChartNumber(text,'text')).toBe(text);
});
it('retains real zero, false and declared business text',()=>{
  expect(formatValue(0,'percent-1')).toBe('0%');
  expect(formatValue(false)).toBe('false');
  expect(formatValue(null,'number','暂无数据')).toBe('暂无数据');
});
