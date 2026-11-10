import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodeKnowledge } from '../tools/scripts/local-authoring-knowledge-core';
import type { QueryKnowledge } from '../tools/scripts/local-authoring-query-types';
import { findSchema, showSchema } from '../tools/scripts/local-authoring-schema-query';
import { buildRuleBindings } from '../tools/scripts/local-authoring-query-rules';

const formatPointer = '#/definitions/fieldBinding/anyOf/1/properties/format';
const formatId = `schema:${formatPointer}`;

function model(): QueryKnowledge {
  return {
    schemaVersion: '6.107', topics: {},
    schema: { definitions: {
      tableColumn: { type: 'object', required: ['field'], properties: {
        field: { $ref: '#/definitions/fieldBinding' }, width: { type: 'number', minimum: 1 }
      } },
      fieldBinding: { anyOf: [
        { type: 'string' },
        { type: 'object', required: ['data', 'field'], additionalProperties: false, properties: {
          data: { type: 'string' }, field: { type: 'string' },
          format: { anyOf: [{ type: 'string', enum: ['text', 'date'] }, {
            type: 'object', required: ['type', 'pattern'], additionalProperties: false,
            properties: { type: { const: 'time' }, pattern: { type: 'string', minLength: 1 } }
          }] }
        } }
      ] },
      exportOptions: { type: 'object', properties: { format: { enum: ['xlsx'] } } },
      recursive: { type: 'object', properties: { self: { $ref: '#/definitions/recursive' }, format: { type: 'string' } } }
    } },
    modules: { fields: { file: 'fields.md', title: '字段格式', rules: [], examples: [
      'references/page-metadata/examples/table-time-format.json', 'references/page-metadata/examples/unrelated.json'
    ], semantics: ['# Fields', '## Time format\nUse {"type":"time"} at the field binding.', '## Money\nKeep original amounts.'] } },
    nodes: [
      { pointer: '#/definitions/tableColumn', path: '@tableColumn', module: 'table', required: 'type' },
      { pointer: formatPointer, path: '@fieldBinding.format', module: 'fields', required: 'optional', note: '显示格式' },
      { pointer: `${formatPointer}/anyOf/1`, path: '@fieldBinding.format.time', module: 'fields', required: 'branch' },
      { pointer: '#/definitions/exportOptions/properties/format', path: '@exportOptions.format', module: 'table', required: 'optional' }
    ]
  };
}

describe('按对象读取 Schema 契约', () => {
  it('沿 field 引用和联合分支找到格式，保留真实使用位置与必填配套项', () => {
    const result = findSchema(model(), { owner: 'tableColumn', query: 'format' });
    expect(result.items).toEqual([expect.objectContaining({ id: formatId, owner: 'tableColumn',
      path: 'tableColumn.field.format', parentRequired: ['data', 'field'],
      branches: ['schema:#/definitions/fieldBinding/anyOf/1'] })]);
    expect(JSON.stringify(result)).not.toContain('exportOptions');
  });

  it('中文任务词能匹配字段说明，同名导出属性仍由 owner 隔离', () => {
    expect(findSchema(model(), { owner: 'tableColumn', query: '单元格展示格式' }).items)
      .toEqual([expect.objectContaining({ id: formatId })]);
    expect(findSchema(model(), { owner: 'exportOptions', query: 'format' }).items)
      .toEqual([expect.objectContaining({ path: 'exportOptions.format' })]);
  });

  it('无 owner 搜索保留两个不同身份，不合并相同 key', () => {
    const result = findSchema(model(), { query: 'format' });
    expect(result.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: formatId }),
      expect.objectContaining({ id: 'schema:#/definitions/exportOptions/properties/format' })
    ]));
  });

  it('shape 先返回联合分支目录，选择 time 后只返回该分支的准确结构', () => {
    const document = model(), before = JSON.stringify(document);
    const directory = showSchema(document, { id: formatId, owner: 'tableColumn', select: 'shape' });
    expect(directory).toMatchObject({ owner: 'tableColumn', required: [], parentRequired: ['data', 'field'] });
    expect(directory.items).toEqual([
      expect.objectContaining({ id: `${formatId}/anyOf/0`, kind: 'branch' }),
      expect.objectContaining({ id: `${formatId}/anyOf/1`, kind: 'branch' })
    ]);
    const selected = showSchema(document, { id: formatId, owner: 'tableColumn', select: 'shape', branch: `${formatId}/anyOf/1` });
    expect(selected).toMatchObject({ required: ['type', 'pattern'], constraints: { additionalProperties: false } });
    expect(selected.items).toEqual([
      expect.objectContaining({ name: 'type', const: 'time', required: true }),
      expect.objectContaining({ name: 'pattern', minLength: 1, required: true })
    ]);
    expect(JSON.stringify(document)).toBe(before);
  });

  it('placement 保留选择对象，不能让不相关 owner 使用该节点', () => {
    expect(showSchema(model(), { id: formatId, owner: 'tableColumn', select: 'placement' }))
      .toMatchObject({ owner: 'tableColumn', path: 'tableColumn.field.format', parentRequired: ['data', 'field'] });
    expect(() => showSchema(model(), { id: formatId, owner: 'exportOptions', select: 'placement' })).toThrow('not reachable');
    expect(showSchema(model(), { id: formatId, select: 'placement' }).scope).toContain('definition location');
  });

  it('shape 原样保留 type、零值 const/default 和标量边界', () => {
    const document = model();
    document.schema.definitions.bounded = { type: 'number', const: 0, default: 0, minimum: 0, maximum: 1 };
    expect(showSchema(document, { id: 'schema:#/definitions/bounded', select: 'shape' }).constraints)
      .toEqual({ type: 'number', const: 0, default: 0, minimum: 0, maximum: 1 });
  });

  it('allOf 共同约束单独保留，不能与某一分支的 required 混为一组', () => {
    const document = model();
    document.schema.definitions.composed = { type: 'object', required: ['shared'], allOf: [
      { required: ['left'], properties: { left: { type: 'string' } } },
      { required: ['right'], properties: { right: { type: 'number' } } }
    ] };
    const id = 'schema:#/definitions/composed';
    expect(showSchema(document, { id, owner: 'composed', select: 'shape' })).toMatchObject({
      required: ['shared'], items: [
        expect.objectContaining({ id: `${id}/allOf/0`, operator: 'allOf' }),
        expect.objectContaining({ id: `${id}/allOf/1`, operator: 'allOf' })
      ]
    });
    expect(showSchema(document, { id, owner: 'composed', select: 'shape', branch: `${id}/allOf/0` }))
      .toMatchObject({ required: ['left'], enclosing: [{ id, operator: 'allOf', required: ['shared'], constraints: { type: 'object' } }] });
  });

  it('oneOf 分支不合并兄弟约束，后续直接读取子节点仍保留共同 required', () => {
    const document = model();
    document.schema.definitions.choice = { type: 'object', required: ['common'], oneOf: [
      { required: ['left'] }, { required: ['right'] }
    ] };
    const id = 'schema:#/definitions/choice', branch = `${id}/oneOf/0`;
    const selected = showSchema(document, { id: branch, owner: 'choice', select: 'shape' });
    expect(selected).toMatchObject({ required: ['left'], enclosing: [{ id, operator: 'oneOf', required: ['common'] }] });
    expect(JSON.stringify(selected)).not.toContain('right');
  });

  it('不支持的位置或消费参数显式拒绝，不假装已按参数过滤', () => {
    expect(() => showSchema(model(), { id: formatId, at: '/field', select: 'shape' })).toThrow('does not accept --at');
    expect(() => showSchema(model(), { id: formatId, query: 'format' })).toThrow('does not accept --query');
    expect(() => findSchema(model(), { owner: 'tableColumn', at: '/field' })).toThrow('does not accept --at');
    expect(() => findSchema(model(), { owner: 'tableColumn', branch: formatId })).toThrow('does not accept --branch');
  });

  it('rules 和 example 只返回可继续读取的相关引用', () => {
    const options = { id: formatId, branch: `${formatId}/anyOf/1` };
    expect(showSchema(model(), { ...options, select: 'rules' }).items)
      .toEqual([{ id: 'semantic:fields:1', title: 'Time format' }]);
    expect(showSchema(model(), { ...options, select: 'example' }).items)
      .toEqual([{ id: 'example:table-time-format' }]);
    expect(JSON.stringify(showSchema(model(), { ...options, select: 'rules' }))).not.toContain('Keep original amounts');
  });

  it('注册的使用与定义规则在 card、placement、shape 中出现，没有 owner 时不贴使用规则', () => {
    const document = model();
    document.schema.definitions.box = { type: 'object', properties: { entry: { $ref: '#/definitions/value' } } };
    document.schema.definitions.value = { type: 'string' };
    document.modules.fields!.rules = [
      { id: 'container-rule', description: '容器中的引用必须保持稳定', valid: ['valid-box'], invalid: ['invalid-box'] },
      { id: 'value-rule', description: '值应保留原始类型', valid: [], invalid: [] },
      { id: 'unregistered-rule', description: '无关模块规则不能自动附带' }
    ];
    document.ruleBindings = buildRuleBindings(document, {
      'container-rule': { owners: ['box'] }, 'value-rule': { owners: ['value'] }
    });
    const id = 'schema:#/definitions/value';
    for (const select of ['card', 'placement', 'shape']) {
      expect(showSchema(document, { id, owner: 'box', select }).contextRules).toEqual([
        { id: 'rule:container-rule', description: '容器中的引用必须保持稳定' },
        { id: 'rule:value-rule', description: '值应保留原始类型' }
      ]);
      expect(showSchema(document, { id, select }).contextRules).toEqual([
        { id: 'rule:value-rule', description: '值应保留原始类型' }
      ]);
    }
    expect(showSchema(document, { id, owner: 'box', select: 'rules' }).items).toEqual([
      { id: 'rule:container-rule', description: '容器中的引用必须保持稳定' },
      { id: 'rule:value-rule', description: '值应保留原始类型' }
    ]);
  });

  it('没有注册不回退附带模块规则，rules 仍保留相关 semantic 引用', () => {
    const document = model();
    document.modules.fields!.rules = [{ id: 'not-linked', description: '不应因为同模块就附带' }];
    expect(showSchema(document, { id: formatId, owner: 'tableColumn', select: 'card' }).contextRules).toEqual([]);
    document.ruleBindings = [{ id: 'binding-context', description: '绑定中的输入保持一致', owners: ['fieldBinding'], valid: [], invalid: [] }];
    expect(showSchema(document, { id: formatId, owner: 'fieldBinding', select: 'rules', branch: `${formatId}/anyOf/1` }).items)
      .toEqual([
        { id: 'rule:binding-context', description: '绑定中的输入保持一致' },
        { id: 'semantic:fields:1', title: 'Time format' }
      ]);
  });

  it('递归引用终止，未知身份、非法指针和非子分支明确失败', () => {
    expect(findSchema(model(), { owner: 'recursive', query: 'format' }).items)
      .toEqual([expect.objectContaining({ path: 'recursive.format' })]);
    expect(() => findSchema(model(), { owner: 'missing', query: 'format' })).toThrow('Unknown schema owner');
    expect(() => showSchema(model(), { id: 'schema:#/definitions/missing' })).toThrow('Unknown schema pointer');
    expect(() => showSchema(model(), { id: 'schema:#/definitions/__proto__' })).toThrow('Unknown schema pointer');
    expect(() => showSchema(model(), { id: formatId, branch: 'schema:#/definitions/exportOptions' })).toThrow('Unknown branch');
  });

  it('真实生成知识可定位表格格式，并读取 time 分支所需的父字段', () => {
    const document = decodeKnowledge(readFileSync('metriccanvas-authoring/skill/metriccanvas-local-authoring/references/authoring-knowledge/model.json', 'utf8'));
    const result = findSchema(document, { owner: 'tableColumn', query: 'format' });
    expect(result.items).toEqual(expect.arrayContaining([expect.objectContaining({ owner: 'tableColumn', path: 'tableColumn.field.format' })]));
    const id = 'schema:#/definitions/staticFieldBinding/anyOf/1/properties/format';
    expect(showSchema(document, { id, owner: 'tableColumn', select: 'placement' }))
      .toMatchObject({ path: 'tableColumn.field.format', parentRequired: ['data', 'field'] });
  });
});
