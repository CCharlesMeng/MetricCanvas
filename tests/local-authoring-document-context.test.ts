import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodeKnowledge } from '../tools/scripts/local-authoring-knowledge-core';
import { resolveDocumentContext } from '../tools/scripts/local-authoring-document-context';
import type { QueryKnowledge } from '../tools/scripts/local-authoring-query-types';

const model: QueryKnowledge = decodeKnowledge(readFileSync(
  'metriccanvas-authoring/skill/metriccanvas-local-authoring/references/authoring-knowledge/model.json', 'utf8'));
const tableAt = '/sections/0/components/0';
function table(): Record<string, any> {
  return { id: 'repeated', type: 'table', layout: { span: 12 }, data: 'records', props: {
    columns: [{ field: { data: 'records', field: 'date' } }], toolbar: { export: { format: 'xlsx' } }
  } };
}
function page(component: unknown = table()): Record<string, any> {
  // An intentionally incomplete repair document: it must not pass page validation first.
  return { layout: 'dashboard', sections: [{ components: [component] }] };
}
function locate(document: unknown, at: string) {
  return resolveDocumentContext(model, document, at);
}

describe('原始目标页面的准确 Schema 上下文', () => {
  it('不依赖整页合法，区分字段格式和导出格式，保留完整祖先 owner', () => {
    const document = page();
    const format = locate(document, `${tableAt}/props/columns/0/field/format`);
    expect(format).toMatchObject({ status: 'resolved', documentAt: `${tableAt}/props/columns/0/field/format`,
      owner: 'staticFieldBinding', id: 'schema:#/definitions/staticFieldBinding/anyOf/1/properties/format' });
    expect(format.enclosingOwners).toEqual(['page', 'section', 'tableComponent', 'tableColumnNode', 'tableColumn', 'fieldBinding', 'staticFieldBinding']);
    expect(locate(document, `${tableAt}/props/toolbar/export/format`)).toMatchObject({
      status: 'resolved', owner: 'tableComponent',
      id: 'schema:#/definitions/tableComponent/properties/props/properties/toolbar/properties/export/properties/format'
    });
  });

  it('区分页面 layout 与组件 layout，不把别处的同名 key 当作补属性', () => {
    expect(locate(page(), '/layout')).toMatchObject({ owner: 'page', id: 'schema:#/properties/layout' });
    expect(locate(page(), `${tableAt}/layout`)).toMatchObject({ owner: 'tableComponent',
      id: 'schema:#/definitions/tableComponent/properties/layout' });
    expect(locate(page(), `${tableAt}/props/columns/0/format`)).toMatchObject({
      status: 'not-found', contextAt: `${tableAt}/props/columns/0`,
      candidates: [expect.objectContaining({ owner: 'tableColumn', id: 'schema:#/definitions/tableColumn' })]
    });
  });

  it('已有合法父对象允许补末端属性，不能越过缺失父对象', () => {
    expect(locate(page(), `${tableAt}/props/columns/0/width`)).toMatchObject({
      status: 'resolved', owner: 'tableColumn', id: 'schema:#/definitions/tableColumn/properties/width'
    });
    expect(() => locate(page(), `${tableAt}/props/rowNumber/width`)).toThrow('Missing document parent');
  });

  it('按 Tab 与组合卡实际槽位递归，重复业务 id 不改变路径', () => {
    const metric = { id: 'repeated', type: 'metricCard', layout: { span: 6 }, props: {} };
    const composite = { id: 'repeated', type: 'compositeCard', props: { components: [metric] } };
    const document = page({ id: 'repeated', type: 'tabContainer', props: { tabs: [
      { id: 'same', components: [table()] }, { id: 'same', component: composite }
    ] } });
    expect(locate(document, `${tableAt}/props/tabs/0/components/0/props/columns/0/width`)).toMatchObject({
      status: 'resolved', owner: 'tableColumn' });
    expect(locate(document, `${tableAt}/props/tabs/1/component/props/components/0/layout/span`)).toMatchObject({
      status: 'resolved', owner: 'metricCardLayout', id: 'schema:#/definitions/metricCardLayout/properties/span' });
    // The same component type is not legal in every slot: a Tab cannot contain another Tab.
    document.sections[0].components[0].props.tabs[1].component = { type: 'tabContainer', props: {} };
    expect(locate(document, `${tableAt}/props/tabs/1/component/props`)).toMatchObject({ status: 'needs-context' });
  });

  it('Tab 的单组件 property 槽位与数组项都定位到实际组件定义，普通格式属性仍保留', () => {
    const document = page({ type: 'tabContainer', props: { tabs: [
      { component: table() }, { components: [table()] }
    ] } });
    expect(locate(page(), tableAt)).toMatchObject({ status: 'resolved', owner: 'tableComponent',
      id: 'schema:#/definitions/tableComponent' });
    const single = `${tableAt}/props/tabs/0/component`;
    expect(locate(document, single)).toMatchObject({ status: 'resolved', owner: 'tableComponent',
      id: 'schema:#/definitions/tableComponent' });
    expect(locate(document, `${tableAt}/props/tabs/1/components/0`)).toMatchObject({
      status: 'resolved', owner: 'tableComponent', id: 'schema:#/definitions/tableComponent' });
    expect(locate(document, `${single}/props/columns/0/field`)).toMatchObject({
      status: 'resolved', owner: 'tableColumn', id: 'schema:#/definitions/tableColumn/properties/field' });
    document.sections[0].components[0].props.tabs[0].component.type = 'unknown';
    expect(locate(document, single)).toMatchObject({ status: 'needs-context', contextAt: single });
    delete document.sections[0].components[0].props.tabs[0].component.type;
    expect(locate(document, single)).toMatchObject({ status: 'needs-context', contextAt: single });
  });

  it('缺少必填判别字段时不能用待补叶子或旁边独有属性选中分支', () => {
    const document = page();
    document.sections[0].components[0].props.columns[0].filterable = { showSelectAll: true };
    expect(locate(document, `${tableAt}/props/columns/0/filterable/showSelectAll`)).toMatchObject({
      status: 'needs-context', contextAt: `${tableAt}/props/columns/0/filterable`,
      needs: [{ documentAt: `${tableAt}/props/columns/0/filterable/mode`, values: ['select', 'dateRange', 'numberRange'] }]
    });
    document.sections[0].components[0].props.columns[0].filterable.mode = 'select';
    expect(locate(document, `${tableAt}/props/columns/0/filterable/showSelectAll`)).toMatchObject({ status: 'resolved' });
  });

  it('支持独立详情视图中的真实组件槽位', () => {
    const document = { detailViews: [{ components: [table()] }] };
    expect(locate(document, '/detailViews/0/components/0/props/columns/0/width')).toMatchObject({
      status: 'resolved', owner: 'tableColumn' });
  });

  it.each([undefined, 'unknown-type'])('缺失或未知组件 type (%s) 返回候选，不从 props 形状猜', type => {
    const component = table();
    if (type === undefined) delete component.type;
    else component.type = type;
    const result = locate(page(component), `${tableAt}/props/columns/0/width`);
    expect(result).toMatchObject({ status: 'needs-context', contextAt: tableAt,
      needs: [expect.objectContaining({ documentAt: `${tableAt}/type`, values: expect.arrayContaining(['table', 'metricCard']) })] });
    expect(result.id).toBeUndefined();
    expect(result.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ owner: 'tableComponent', id: 'schema:#/definitions/tableComponent' }),
      expect.objectContaining({ owner: 'metricCardComponent' })
    ]));
  });

  it('格式对象 type 缺失仍可定位其属性，但不按 leaf key 推断对象分支', () => {
    const document = page();
    document.sections[0].components[0].props.columns[0].field.format = { pattern: 'YYYY-MM-DD' };
    expect(locate(document, `${tableAt}/props/columns/0/field/format/type`)).toMatchObject({
      status: 'resolved', owner: 'staticFieldBinding',
      id: 'schema:#/definitions/staticFieldBinding/anyOf/1/properties/format/anyOf/1/properties/type'
    });
    document.sections[0].components[0].props.columns[0].field.format = 42;
    expect(locate(document, `${tableAt}/props/columns/0/field/format`)).toMatchObject({ status: 'resolved' });
  });

  it('数据源根据实际 source.type 判别，字段声明与任意记录键通过 Schema 槽位定位', () => {
    const document = { dataSources: { '账本/主~表': { source: { type: 'inline', rows: [] }, fields: {} } } };
    expect(locate(document, '/dataSources/账本~1主~0表/fields')).toMatchObject({
      status: 'resolved', owner: 'inlineDataSource', id: 'schema:#/definitions/inlineDataSource/properties/fields'
    });
    expect(locate(document, '/dataSources/账本~1主~0表/fields/new')).toMatchObject({ status: 'needs-context' });
  });

  it.each(['/sections/-/components', '/sections/00/components', '/sections/1/components',
    `${tableAt}/props/columns/1`, `${tableAt}/props/columns/-`])('拒绝缺失或不合法数组位置 %s', at => {
    expect(() => locate(page(), at)).toThrow(/array position/u);
  });

  it.each(['#', 'sections/0', '/sections/~2'])('拒绝非 JSON Pointer %s', at => {
    expect(() => locate(page(), at)).toThrow('JSON Pointer');
  });

  it('交集中的引用属性保持规范身份，递归 Schema 沿有限文档路径继续', () => {
    const composed: QueryKnowledge = { ...model, schema: { type: 'object', properties: {
      entry: { allOf: [{ $ref: '#/definitions/box' }, { type: 'object', properties: { extra: { type: 'boolean' } } }] }
    }, definitions: { box: { type: 'object', properties: {
      value: { type: 'string' }, next: { $ref: '#/definitions/box' }
    } } } } };
    expect(resolveDocumentContext(composed, { entry: { next: {} } }, '/entry/next/value')).toMatchObject({
      status: 'resolved', owner: 'box', id: 'schema:#/definitions/box/properties/value'
    });
    expect(resolveDocumentContext(composed, { entry: {} }, '/entry/extra')).toMatchObject({
      status: 'resolved', owner: 'page', id: 'schema:#/properties/entry/allOf/1/properties/extra'
    });
  });

  it('两个结构分支同时有依据时返回 ambiguous，不随意选择第一个', () => {
    const overlapping: QueryKnowledge = { ...model, schema: { type: 'object', properties: {
      choice: { anyOf: [
        { type: 'object', properties: { left: { type: 'number' }, value: { type: 'number' } } },
        { type: 'object', properties: { right: { type: 'number' }, value: { type: 'string' } } }
      ] }
    } } };
    const result = resolveDocumentContext(overlapping, { choice: { left: 1, right: 2 } }, '/choice/value');
    expect(result.status).toBe('ambiguous');
    expect(result.candidates).toHaveLength(2);
    expect(result.id).toBeUndefined();
  });

  it('定位只返回短规范身份，不泄露查询或数据行，且输入不变', () => {
    const document = page();
    document.dataSources = { rows: { source: { type: 'inline', rows: [{ secret: 'PRIVATE ROW' }] } },
      remote: { source: { type: 'query', query: { body: 'PRIVATE QUERY' } } } };
    const before = JSON.stringify(document), result = locate(document, `${tableAt}/props/columns/0/field/format`);
    expect(JSON.stringify(document)).toBe(before);
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE|rows|query/u);
    expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThan(1024);
    expect(locate(document, '')).toMatchObject({ status: 'resolved', owner: 'page', id: 'schema:#' });
  });
});


describe('通过真实已有属性排除禁止该属性的联合分支', () => {
  function chart(series: Record<string, unknown>) {
    return page({ type: 'barChart', id: 'chart', props: { categoryField: 'category', series: [series] } });
  }
  const seriesAt = `${tableAt}/props/series/0`;

  it('field/value按not:{}互斥声明定位，不借助不相关必填属性', () => {
    expect(locate(chart({ field: 'amount' }), seriesAt + '/field')).toMatchObject({ status: 'resolved',
      owner: 'barChartSeries', id: 'schema:#/definitions/barChartSeries/anyOf/0/properties/field' });
    expect(locate(chart({ value: 0 }), seriesAt + '/format')).toMatchObject({ status: 'resolved',
      owner: 'barChartSeries', id: 'schema:#/definitions/barChartSeries/anyOf/1/properties/format' });
    expect(locate(chart({ value: null }), seriesAt + '/format').status).toBe('resolved');
  });

  it('field/value同存或都缺时保持缺口，不选择第一分支', () => {
    expect(locate(chart({ field: 'amount', value: 0 }), seriesAt + '/field').status).not.toBe('resolved');
    expect(locate(chart({}), seriesAt + '/field').status).not.toBe('resolved');
  });

  it('布尔false属性同样排除且不因缺少非判别必填字段拒绝局部修复', () => {
    const altered = structuredClone(model);
    const branches = altered.schema.definitions.barChartSeries.anyOf;
    branches[0].properties.value = false;
    branches[1].properties.field = false;
    branches[0].required.push('unrelatedRepairField');
    expect(resolveDocumentContext(altered, chart({ field: 'amount' }), seriesAt + '/field').status).toBe('resolved');
    expect(resolveDocumentContext(altered, chart({ value: 0 }), seriesAt + '/format').status).toBe('resolved');
    expect(resolveDocumentContext(altered, chart({ field: 'amount', value: 0 }), seriesAt + '/field').status).not.toBe('resolved');
  });
});
