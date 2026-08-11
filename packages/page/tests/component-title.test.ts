import { describe, expect, it } from 'vitest';
import { componentCatalog, validate } from '../src';

function textDocument(): Record<string, any> {
  return {
    schemaVersion: '4.0',
    id: 'text-title',
    dataSources: {},
    sections: [{
      id: 'content',
      layout: { type: 'grid', columns: 12 },
      components: [{
        id: 'text',
        type: 'text',
        layout: { span: 12 },
        props: { title: '说明', body: '正文' }
      }]
    }]
  };
}

describe('组件标题 Props 规范', () => {
  it('text 使用 props.title 并拒绝旧 heading', () => {
    expect(validate(textDocument())).toEqual([]);
    const legacy = textDocument();
    legacy.sections[0].components[0].props = { heading: '说明', body: '正文' };
    expect(validate(legacy)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '/sections/0/components/0/props/heading' })
      ])
    );
  });

  it('组件能力目录为每种组件声明标题能力', () => {
    expect(componentCatalog.every((entry) => entry.title !== undefined)).toBe(true);
    expect(componentCatalog.find((entry) => entry.type === 'reportHeader')?.title).toBe(
      'required'
    );
    expect(componentCatalog.find((entry) => entry.type === 'aiSummary')?.title).toBe(
      'optional'
    );
  });

  it('摘要默认选择 text，只在需求明确声明运行时 SSE 时选择 aiSummary', () => {
    const text = componentCatalog.find((entry) => entry.type === 'text');
    const aiSummary = componentCatalog.find((entry) => entry.type === 'aiSummary');

    expect(text?.chooseWhen.join('\n')).toContain('摘要默认');
    expect(aiSummary?.chooseWhen.join('\n')).toContain('明确声明运行时 SSE');
  });
});
