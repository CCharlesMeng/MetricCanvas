import { describe, expect, it } from 'vitest';
import { validate, type Page } from '../src';

function document(): Page {
  return {
    schemaVersion: '5.0',
    id: 'risk-summary',
    dataSources: {
      risks: {
        fields: {
          office: { type: 'string', role: 'dimension' },
          missing: { type: 'number', role: 'measure' }
        },
        source: {
          type: 'inline',
          rows: [{ office: '北京代表处', missing: 5 }]
        }
      }
    },
    sections: [{
      id: 'risk',
      components: [{
        id: 'summary',
        type: 'aiSummary',
        layout: { span: 12 },
        props: {
          title: '风险总结',
          promptTemplate: '只根据输入数据总结。',
          relatedData: {
            risk: {
              source: 'risks',
              description: '各代表处风险数据',
              fields: [
                { field: 'office', term: '代表处' },
                { field: 'missing', term: '未开展客户数' }
              ]
            }
          }
        }
      }]
    }]
  };
}

describe('AI 总结组件契约', () => {
  it('接受无 data 槽、显式声明关联数据的组件', () => {
    const page = document();
    expect(validate(page)).toEqual([]);
    expect(page.sections[0]?.components[0]?.type).toBe('aiSummary');
  });

  it('拒绝 data 槽和空 promptTemplate', () => {
    const withData = structuredClone(document()) as unknown as Record<string, any>;
    withData.sections[0].components[0].data = { main: 'risks' };
    expect(validate(withData)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: '/sections/0/components/0/data',
          message: expect.stringContaining('未定义字段')
        })
      ])
    );

    const emptyPrompt = structuredClone(document()) as unknown as Record<string, any>;
    emptyPrompt.sections[0].components[0].props.promptTemplate = '';
    expect(validate(emptyPrompt)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: '/sections/0/components/0/props/promptTemplate'
        })
      ])
    );

    emptyPrompt.sections[0].components[0].props.promptTemplate = '   ';
    expect(validate(emptyPrompt)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: '/sections/0/components/0/props/promptTemplate'
        })
      ])
    );
  });

  it('拒绝未知关联数据源和字段', () => {
    const unknownSource = structuredClone(document());
    const summary = unknownSource.sections[0]!.components[0];
    if (summary.type !== 'aiSummary') throw new Error('测试文档类型错误');
    summary.props.relatedData.risk!.source = 'missing-source';
    expect(validate(unknownSource)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: '/sections/0/components/0/props/relatedData/risk/source',
          message: expect.stringContaining('未知数据源')
        })
      ])
    );

    const unknownField = structuredClone(document());
    const fieldSummary = unknownField.sections[0]!.components[0];
    if (fieldSummary.type !== 'aiSummary') throw new Error('测试文档类型错误');
    fieldSummary.props.relatedData.risk!.fields[0]!.field = 'unknown';
    expect(validate(unknownField)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: '/sections/0/components/0/props/relatedData/risk/fields/0/field',
          message: expect.stringContaining('不在数据源')
        })
      ])
    );
  });

  it('拒绝重复字段和冲突的术语映射', () => {
    const duplicate = structuredClone(document());
    const summary = duplicate.sections[0]!.components[0];
    if (summary.type !== 'aiSummary') throw new Error('测试文档类型错误');
    summary.props.relatedData.risk!.fields.push({ field: 'office', term: '代表处' });
    expect(validate(duplicate)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining('关联字段重复') })
      ])
    );

    const conflict = structuredClone(document());
    const conflictSummary = conflict.sections[0]!.components[0];
    if (conflictSummary.type !== 'aiSummary') throw new Error('测试文档类型错误');
    conflictSummary.props.relatedData.other = {
      source: 'risks',
      description: '其他数据',
      fields: [{ field: 'office', term: '区域' }]
    };
    expect(validate(conflict)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining('术语映射冲突') })
      ])
    );
  });
});
