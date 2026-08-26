import { describe, expect, it } from 'vitest';
import {
  categoricalColor,
  categoryDomain,
  colorListOrUndefined,
  parseColorList,
  serialColor
} from '../src/shared/chart-palette';

describe('parseColorList', () => {
  it('切分十六进制色列并去掉空白', () => {
    expect(parseColorList(' #5b72ea, #3cc6c1 ,#fec72a,#4ba0f7 ')).toEqual([
      '#5b72ea',
      '#3cc6c1',
      '#fec72a',
      '#4ba0f7'
    ]);
  });

  it('函数式色值内部的逗号不切分', () => {
    expect(parseColorList('#7184e7, rgba(0, 0, 0, 0.05)')).toEqual([
      '#7184e7',
      'rgba(0, 0, 0, 0.05)'
    ]);
  });

  it('空格分隔的现代写法不含逗号,整段作为一个色值', () => {
    expect(parseColorList('rgb(0 0 0 / 0.05)')).toEqual(['rgb(0 0 0 / 0.05)']);
  });

  it('属性缺席读到空串时得到空色列', () => {
    expect(parseColorList('')).toEqual([]);
    expect(parseColorList('   ')).toEqual([]);
  });

  it('尾随逗号不产生空色值', () => {
    expect(parseColorList('#111, #222,')).toEqual(['#111', '#222']);
  });
});

describe('colorListOrUndefined', () => {
  it('空色列与缺席等价', () => {
    expect(colorListOrUndefined([])).toBeUndefined();
  });

  it('非空色列原样返回', () => {
    expect(colorListOrUndefined(['#111'])).toEqual(['#111']);
  });
});

describe('categoryDomain', () => {
  it('按首次出现顺序去重', () => {
    expect(categoryDomain(['华东', '华南', '华东', '华北'])).toEqual([
      '华东',
      '华南',
      '华北'
    ]);
  });

  it('空值归一到空串,只占一个位置', () => {
    expect(categoryDomain([null, undefined, '华东'])).toEqual(['', '华东']);
  });
});

describe('categoricalColor', () => {
  const palette = ['#5b72ea', '#3cc6c1', '#fec72a', '#4ba0f7'];

  it('同一类别在不同的行序下取到同一个颜色', () => {
    const domain = categoryDomain(['华东', '华南', '华北']);
    // 另一个组件把同一批类别按别的顺序渲染:颜色仍由类别在域里的位置决定
    expect(categoricalColor(palette, '华南', domain)).toBe('#3cc6c1');
    expect(categoricalColor(palette, '华北', domain)).toBe('#fec72a');
    expect(categoricalColor(palette, '华东', domain)).toBe('#5b72ea');
  });

  it('类别数超过色板长度时循环取色', () => {
    const domain = categoryDomain(['a', 'b', 'c', 'd', 'e']);
    expect(categoricalColor(palette, 'e', domain)).toBe('#5b72ea');
  });

  it('域外类别不取色,不静默落到 0 号色上撞色', () => {
    expect(categoricalColor(palette, '未收录', ['a'])).toBeUndefined();
  });

  it('色板缺席即不取色', () => {
    expect(categoricalColor(undefined, 'a', ['a'])).toBeUndefined();
    expect(categoricalColor([], 'a', ['a'])).toBeUndefined();
  });
});

describe('serialColor', () => {
  const palette = ['#5b72ea', '#3cc6c1'];

  it('按档位序号循环取色', () => {
    expect(serialColor(palette, 0)).toBe('#5b72ea');
    expect(serialColor(palette, 1)).toBe('#3cc6c1');
    expect(serialColor(palette, 2)).toBe('#5b72ea');
  });

  it('色板缺席或序号非法即不取色', () => {
    expect(serialColor(undefined, 0)).toBeUndefined();
    expect(serialColor(palette, -1)).toBeUndefined();
  });
});
