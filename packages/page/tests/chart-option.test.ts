import { describe, expect, it } from 'vitest';
import scene from '../../../pages/chart-echarts-option-page.json';
import { chartOptionErrors, chartOptionErrorsFor, collectFilterTextValueReferences, collectTextValueCompositions, collectTextValueReferences, parsePage, resolveTextValues, requiredMinorVersion } from '../src/internal';

function withOption(option: unknown, index = 1) {
  const document = structuredClone(scene);
  Object.assign(document.sections[0]!.components[index]!.props, { echartsOption: option });
  return document;
}

describe('高级 ECharts 呈现协议', () => {
  it('直接消费完整场景，登记能力下限而不迁移旧文档', () => {
    expect(parsePage(scene).ok).toBe(true);
    expect(requiredMinorVersion(scene)).toBe(32);
    expect(parsePage({ ...scene, schemaVersion: '5.4' })).toMatchObject({ ok: false, errors: expect.arrayContaining([expect.objectContaining({ type: 'CHART_OPTION_ERROR', message: expect.stringContaining('6.32') })]) });
    expect(parsePage({ ...scene, schemaVersion: '6.31' })).toMatchObject({ ok: false, errors: expect.arrayContaining([expect.objectContaining({ path: expect.stringContaining('echartsOption'), message: expect.stringContaining('6.32') })]) });
  });
  it.each([
    [{ series: [{ data: [99] }] }, '/series/0/data'],
    [{ series: [{ type: 'line' }] }, '/series/0/type'],
    [{ series: [{ name: '假指标' }] }, '/series/0/name'],
    [{ series: [{ stack: 'other' }] }, '/series/0/stack'],
    [{ xAxis: { data: ['替换'] } }, '/xAxis/data'],
    [{ yAxis: [{}, {}] }, '/yAxis/1'],
    [{ series: [{}, {}, {}] }, '/series/2'],
    [{ series: [null] }, '/series/0'],
    [{ grid: [] }, '/grid'],
    [{ media: [{ option: { series: [{ data: [1] }] } }] }, '/media'],
    [{ tooltip: { formatter: '<img src=x onerror=alert(1)>' } }, '/tooltip/formatter'],
    [{ tooltip: { textStyle: { fontFamily: 'Arial;position:fixed' } } }, '/tooltip/textStyle/fontFamily'],
    [{ textStyle: { backgroundColor: 'url(https://example.org/pixel)' } }, '/textStyle/backgroundColor'],
    [{ tooltip: { extraCssText: 'position:fixed' } }, '/tooltip/extraCssText'],
    [{ series: [{ symbol: 'image://https://example.org/a.png' }] }, '/series/0/symbol'],
    [{ tooltip: { valueFormatter: 'function(x){return x}' } }, '/tooltip/valueFormatter']
  ])('拒绝数据/结构/行为绕过并返回准确路径：%j', (option, suffix) => {
    expect(chartOptionErrors(withOption(option))).toContainEqual(expect.objectContaining({ type: 'CHART_OPTION_ERROR', path: `/sections/0/components/1/props/echartsOption${suffix}` }));
  });
  it.each([undefined, NaN, Infinity, () => 1, new Date(), { get color() { throw Error('must not execute'); } }])('JS API 非 JSON 输入不会被 stringify 偷偷丢弃', value => {
    expect(parsePage(withOption(value))).toMatchObject({ ok: false, errors: [expect.objectContaining({ type: 'CHART_OPTION_ERROR' })] });
  });
  it('混合图显式双轴即使单系列也按实际构造保留两个值轴', () => {
    expect(chartOptionErrorsFor('barChart', { series: [{ kind: 'line' }], dualAxis: true, echartsOption: { yAxis: [{}, {}] } }, '/props/echartsOption')).toEqual([]);
  });
  it('保留同一文档中其他原有错误', () => {
    const document = withOption({ series: [{ data: [1] }] });
    document.id = '?';
    const result = parsePage(document);
    expect(result).toMatchObject({ ok: false, errors: expect.arrayContaining([expect.objectContaining({ type: 'CHART_OPTION_ERROR' }), expect.objectContaining({ type: 'SCHEMA_ERROR', path: '/id' })]) });
  });
  it('拒绝循环、原型键与不支持的组件', () => {
    const cycle: Record<string, unknown> = {}; cycle.textStyle = cycle;
    expect(chartOptionErrors(withOption(cycle))[0]?.message).toContain('循环');
    expect(chartOptionErrors(withOption(JSON.parse('{"textStyle":{"__proto__":{"x":1}}}')))).toContainEqual(expect.objectContaining({ path: expect.stringContaining('__proto__') }));
    expect(chartOptionErrors(withOption({}, 0))[0]?.message).toContain('只支持');
  });
  it('参数/筛选/parts 形状在该子树内是不透明 JSON', () => {
    const option = { textStyle: { rich: { a: { param: 'absent' }, b: { filter: 'absent' }, c: { parts: ['a', 'b'] } } } };
    const document = withOption(option);
    expect(collectTextValueReferences(document)).toEqual([]);
    expect(collectFilterTextValueReferences(document)).toEqual([]);
    expect(collectTextValueCompositions(document)).toEqual([]);
    expect(parsePage(document).ok).toBe(true);
    expect(resolveTextValues(document, { values: new Map() })).toEqual(document);
  });
});

it('opaque ECharts byFilter keys neither enable IOC currency capabilities nor get projected', async () => {
  const {fieldSelectionIds,projectComponentFields}=await import('../src/field-selection');
  const document=withOption({textStyle:{byFilter:{filterId:'opaque-name',cases:{RMB:'red',USD:'blue'}}}});
  expect(requiredMinorVersion(document)).toBe(32);
  expect(parsePage(document).ok).toBe(true);
  expect(fieldSelectionIds(document)).toEqual([]);
  const parsed=parsePage(scene);expect(parsed.ok).toBe(true);if(!parsed.ok)return;
  const component=parsed.page.sections[0]!.components[1]!;
  if(component.type!=='barChart')throw Error('expected actual bar chart');
  const applied={...component,props:{...component.props,echartsOption:{textStyle:{byFilter:{filterId:'opaque-name',cases:{RMB:'red',USD:'blue'}}}}}};
  expect(projectComponentFields(parsed.page,applied,new Map()).props).toEqual(applied.props);
});
