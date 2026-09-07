import { describe, expect, it } from 'vitest';
import { assembleAiSummaryRequest } from '../src/ai-summary/assemble-request';

const props = {
  title: '风险总结',
  promptTemplate: '只使用输入数据。',
  relatedData: {
    risk: {
      source: 'inspection-progress',
      description: '各代表处风险数据',
      fields: [
        { field: 'office', term: '代表处' },
        { field: 'missing', term: '未考察数' }
      ]
    }
  }
};

describe('AI 总结请求组装', () => {
  it('只发送 relatedData 声明的字段并转换为列数组', () => {
    const result = assembleAiSummaryRequest(
      props,
      new Map([
        [
          'inspection-progress',
          {
            status: 'ready' as const,
            rows: [
              { office: 'A', missing: 3, secret: '不得外传' },
              { office: 'B', missing: 1, secret: '不得外传' }
            ]
          }
        ]
      ])
    );

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.request.datasets).toEqual([
      {
        id: 'risk',
        question: '各代表处风险数据',
        data: { office: ['A', 'B'], missing: [3, 1] }
      }
    ]);
    expect(result.request.termMapping).toEqual({ office: '代表处', missing: '未考察数' });
    expect(JSON.stringify(result.request)).not.toContain('不得外传');
  });

  it('数据为空时不产生可调用请求', () => {
    expect(
      assembleAiSummaryRequest(props, new Map([['inspection-progress', { status: 'empty' }]]))
    ).toEqual({ status: 'empty' });
  });
});
