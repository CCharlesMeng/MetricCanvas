import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildContractBindings, resolveDocumentContract, type ContractRegistration } from '../tools/scripts/local-authoring-contract-query';
import { showSchema } from '../tools/scripts/local-authoring-schema-query';
import { decodeKnowledge } from '../tools/scripts/local-authoring-knowledge-core';
import type { QueryKnowledge } from '../tools/scripts/local-authoring-query-types';

const source: QueryKnowledge = decodeKnowledge(readFileSync('metriccanvas-authoring/skill/metriccanvas-local-authoring/references/authoring-knowledge/model.json', 'utf8'));
const registrations: Record<string, ContractRegistration> = JSON.parse(readFileSync('docs/page-metadata/reference-map.json', 'utf8')).authoringContracts;
const model: QueryKnowledge = { ...source, contracts: buildContractBindings(source, registrations) };
const fieldAt = '/sections/0/components/0/props/columns/0/field';
function page(field: unknown = { data: 'main', field: 'amount' }): Record<string, any> {
  return { sections: [{ components: [{ type: 'table', id: 'duplicate', layout: { span: 12 }, data: { main: 'sample' },
    props: { columns: [{ field, title: 'Amount' }], toolbar: { export: { format: 'xlsx' } } } }] }],
    dataSources: { sample: { source: { type: 'inline', rows: [{ amount: 12.56, hidden: 'PRIVATE_UNRELATED' }] } } } };
}
function resolve(document: unknown = page(), aspect = 'numeric-format', at = fieldAt) {
  return resolveDocumentContract(model, { at, aspect }, document);
}
function semanticText(result: Record<string, any>, id: string): string {
  return result.items.filter((item: Record<string, any>) => item.kind === 'semantic' && item.source === id)
    .map((item: Record<string, any>) => item.text).join('');
}

describe('目标字段关联的结构和行为契约', () => {
  it('直接关联绑定位置，不先找例子，返回完整原文而不读取数据行', () => {
    const document = page(), before = JSON.stringify(document), result = resolve(document);
    expect(result).toMatchObject({ kind: 'contract', status: 'resolved', coverage: 'registered', complete: true, acceptance: 'not-assessed', unresolved: [] });
    const entry = model.contracts!.find(item => item.aspect === 'numeric-format')!;
    for (const semantic of entry.semantics) expect(semanticText(result, semantic.id)).toBe(model.modules[semantic.module]!.semantics[semantic.section]);
    expect(JSON.stringify(result)).not.toContain('PRIVATE_UNRELATED');
    expect(JSON.stringify(result)).toContain('6.106');
    expect(JSON.stringify(result)).toContain('number-5');
    expect(JSON.stringify(document)).toBe(before);
    expect(result.items).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'structure' })]));
  });

  it('普通精度保留产品边界，创作工具与符号方向留在各自章节', () => {
    const result = resolve(), entry = model.contracts!.find(item => item.aspect === 'numeric-format')!;
    const text = entry.semantics.map(source => semanticText(result, source.id)).join('\n');
    expect(text).toContain('组件绑定的显式format优先');
    expect(text).toContain('0.42不自动变42%');
    expect(text).toContain('6.106 及更早版本不能声明新预设');
    expect(text).toContain('其他显式业务 `missingText` 保留');
    expect(text).toContain('XLSX 保留数值单元格的原始值及数值类型');
    expect(text).toContain('可能显示末尾零');
    expect(text).not.toContain('PRESENTATION_FORMAT_ADJUSTED');
    expect(text).not.toContain('PRESENTATION_PRECISION_LIMIT');
    expect(text).not.toContain('colorRule');
    expect(text).not.toContain('变化箭头');
  });

  it('signed一次关联共同规则和符号方向，无需先消费numeric', () => {
    const result = resolve(page(), 'signed-number'), entry = model.contracts!.find(item => item.aspect === 'signed-number')!;
    const text = entry.semantics.map(source => semanticText(result, source.id)).join('\n');
    expect(text).toContain('组件绑定的显式format优先');
    expect(text).toContain('missingText');
    expect(text).toContain('6.107');
    expect(text).toContain('舍入后零为普通文字且无箭头');
    expect(text).toContain('number-2-signed');
    expect(text).toContain('6.18');
    expect(text).toContain('默认最多三位小数');
    expect(text).not.toContain('PRESENTATION_FORMAT_ADJUSTED');
    for (const source of entry.semantics) expect(semanticText(result, source.id)).toBe(model.modules[source.module]!.semantics[source.section]);
  });

  it('紧凑枚举保留全部合法值，不以缩短输出删除格式', () => {
    const result = resolve(), items = result.items as Record<string, any>[];
    const structure = items.find(item => item.kind === 'structure' && item.enum)!;
    const original = showSchema(model, { id: structure.id, select: 'shape' }).items as Record<string, any>[];
    expect(structure.enum).toEqual(original.filter(item => item.kind === 'enum').map(item => item.value));
    expect(structure.items).toEqual(original.filter(item => item.kind !== 'enum'));
  });

  it('旧6.106页面读取高精度规则保留版本下限，不等于能力已通过验收', () => {
    const document = page({ data: 'main', field: 'amount', format: 'number-5' });
    document.schemaVersion = '6.106';
    const before = JSON.stringify(document), result = resolve(document);
    const entry = model.contracts!.find(item => item.aspect === 'numeric-format')!;
    const text = entry.semantics.map(source => semanticText(result, source.id)).join('\n');
    expect(text).toContain('6.106 及更早版本不能声明新预设');
    expect(text).toContain('6.107');
    expect(result.acceptance).toBe('not-assessed');
    expect(JSON.stringify(document)).toBe(before);
  });

  it('字符串绑定和未声明format的对象绑定均可查，不要求提前修改页面', () => {
    expect(resolve(page('amount')).status).toBe('resolved');
    expect(resolve(page(), 'numeric-format', fieldAt + '/format').status).toBe('resolved');
    expect(resolve(page(), 'time-format').status).toBe('resolved');
  });

  it('不把导出format、列标题或导航职责当作数值格式', () => {
    const base = '/sections/0/components/0/props';
    for (const at of [base + '/toolbar/export/format', base + '/columns/0/title', base + '/columns/0']) {
      expect(resolve(page(), 'numeric-format', at)).toMatchObject({ status: 'unregistered', coverage: 'partial', complete: false, items: [] });
    }
    expect(resolve(page(), 'display-unit', base + '/columns/0/title').status).toBe('unregistered');
  });

  it('位置未解析和缺登记分别给出缺口，未知aspect不回退宽搜', () => {
    expect(() => resolve(page(), 'not-registered')).toThrow('available:');
    expect(resolve(page(), 'numeric-format', '/sections/0/components/0/props/columns/0/format')).toMatchObject({ status: 'not-found', complete: false });
    const document = page(); document.sections[0].components[0].type = 'unknown';
    expect(resolve(document)).toMatchObject({ status: 'needs-context', complete: false });
    expect(() => resolveDocumentContract(model, { aspect: 'numeric-format' }, page())).toThrow('--at');
  });

  it('重复组件id按实际位置选择，并保持无关载荷增长不影响输出', () => {
    const document = page();
    document.sections[0].components.push({ type: 'text', id: 'duplicate', props: { text: 'Other' } });
    const original = JSON.stringify(resolve(document));
    document.dataSources.sample.source.rows[0].hidden = 'PRIVATE_UNRELATED'.repeat(5000);
    expect(JSON.stringify(resolve(document))).toBe(original);
    expect(resolve(document, 'numeric-format', '/sections/0/components/1').status).toBe('unregistered');
  });

  it('带符号精度与时间规则各自关联，明确未评估运行效果', () => {
    const signed = JSON.stringify(resolve(page(), 'signed-number'));
    expect(signed).toContain('number-5-signed');
    expect(signed).toContain('6.107');
    const time = JSON.stringify(resolve(page(), 'time-format'));
    expect(time).toContain('UTC+8');
    expect(time).toContain('Excel');
    expect(time).not.toContain('百分比创作与覆盖边界');
    const unit = resolve(page(), 'display-unit', '/sections/0/components/0/props/columns/0');
    expect(unit).toMatchObject({ status: 'resolved', coverage: 'partial', acceptance: 'not-assessed' });
    expect(unit.unresolved).not.toEqual([]);
  });

  it('条件字段仅给具体静态case位置，不宣称普通格式规则已覆盖选择关系', () => {
    const document = page({ byFilter: { filterId: 'currency', cases: {
      RMB: { data: 'main', field: 'cny' }, USD: { data: 'main', field: 'usd' }
    } } });
    const result = resolve(document);
    expect(result).toMatchObject({ status: 'needs-context', coverage: 'partial', complete: false });
    expect(result.items).toEqual([
      expect.objectContaining({ kind: 'binding', documentAt: fieldAt + '/byFilter/cases/RMB' }),
      expect.objectContaining({ kind: 'binding', documentAt: fieldAt + '/byFilter/cases/USD' })
    ]);
    expect(resolve(document, 'numeric-format', fieldAt + '/byFilter/cases/USD').status).toBe('resolved');
    const malformed = page({ field: 'amount', byFilter: { filterId: 'currency', cases: {} } });
    expect(resolve(malformed).complete).toBe(false);
  });

  it('指标卡与图表真实绑定位置复用契约，常量格式保留未登记', () => {
    const document = page();
    document.sections[0].components.push({ type: 'metricCard', id: 'card', props: {
      rows: [{ label: 'Amount', valueField: 'amount' }]
    } });
    document.sections[0].components.push({ type: 'barChart', id: 'chart', props: {
      categoryField: 'category', series: [{ field: 'amount', label: 'Amount' }, { value: 10, format: 'number' }]
    } });
    expect(resolve(document, 'numeric-format', '/sections/0/components/1/props/rows/0/valueField').status).toBe('resolved');
    expect(resolve(document, 'numeric-format', '/sections/0/components/2/props/series/0/field').status).toBe('resolved');
    expect(resolve(document, 'numeric-format', '/sections/0/components/2/props/series/1/format')).toMatchObject({ status: 'unregistered', coverage: 'partial', complete: false });
  });

  it('登记标题、owner、结构和示例漂移均使生成失败', () => {
    const original = registrations['numeric-format']!;
    expect(() => buildContractBindings(source, { broken: { ...original, owners: ['missing'] } })).toThrow('owner');
    expect(() => buildContractBindings(source, { broken: { ...original, structures: ['#/definitions/missing'] } })).toThrow('schema');
    expect(() => buildContractBindings(source, { broken: { ...original, examples: ['example:missing'] } })).toThrow('example');
    expect(() => buildContractBindings(source, { broken: { ...original, semantics: [{ module: 'field-bindings-and-formats', headings: ['renamed'] }] } })).toThrow('heading');
    expect(() => buildContractBindings(source, { broken: { ...original, semantics: [{ module: 'missing', headings: [] }] } })).toThrow('module');
  });

  it('已生成正文身份漂移不能静默继续读取', () => {
    const changed = structuredClone(model);
    const selected = changed.contracts!.find(entry => entry.aspect === 'numeric-format')!.semantics[0]!;
    changed.modules[selected.module]!.semantics[selected.section] += '\nchanged';
    expect(() => resolveDocumentContract(changed, { at: fieldAt, aspect: 'numeric-format' }, page())).toThrow('Stale contract source');
  });
});
