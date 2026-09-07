import { describe, expect, it } from 'vitest';
import {
  parseSemanticHtml,
  semanticDataPresentation
} from '../src/shared/semantic-html';

describe('parseSemanticHtml', () => {
  it('只解析允许的行内结构、文本和语义类', () => {
    const parsed = parseSemanticHtml(
      '<strong class="detail-title">ModelArts &amp; OBS</strong>：' +
        '<span class="detail-description">到期未续订</span>' +
        '<span class="detail-value tone-negative">（-12.0万）</span>'
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(JSON.stringify(parsed.document.nodes)).toContain('ModelArts & OBS');
    expect(JSON.stringify(parsed.document.nodes)).toContain('tone-negative');
  });

  it('解析多个 data、换行、显式正号、负数与零为安全数值节点', () => {
    const parsed = parseSemanticHtml(
      '较一月 (<data>-13123173.26</data>)<br>' +
        '同比变化：<data>+2590798.01</data>，基线 100；零值 <data>0</data>'
    );

    expect(parsed).toEqual({
      ok: true,
      document: {
        nodes: [
          { type: 'text', value: '较一月 (' },
          { type: 'data', raw: '-13123173.26', value: -13123173.26 },
          { type: 'text', value: ')' },
          { type: 'element', tag: 'br', classes: [], children: [] },
          { type: 'text', value: '同比变化：' },
          { type: 'data', raw: '+2590798.01', value: 2590798.01 },
          { type: 'text', value: '，基线 100；零值 ' },
          { type: 'data', raw: '0', value: 0 }
        ]
      }
    });
  });

  it('data 展示复用当前列格式并按原始值决定 signed 极性', () => {
    expect(
      semanticDataPresentation(
        { type: 'data', raw: '-13123173.26', value: -13123173.26 },
        'cny-adaptive',
        'signed'
      )
    ).toEqual({ text: '-1,312万', tone: 'negative' });
    expect(
      semanticDataPresentation(
        { type: 'data', raw: '+2590798.01', value: 2590798.01 },
        undefined,
        undefined
      )
    ).toEqual({ text: '+2590798.01', tone: undefined });
    expect(
      semanticDataPresentation(
        { type: 'data', raw: '-0', value: -0 },
        'cny-adaptive',
        'signed'
      )
    ).toEqual({ text: '0元', tone: 'neutral' });
  });

  it.each([
    '<script>alert(1)</script>',
    '<span style="color:red">危险</span>',
    '<span onclick="alert(1)">危险</span>',
    '<span class="red">危险</span>',
    '<ul class="detail-list"><li class="detail-item">列表</li></ul>',
    '<div><span>未闭合</div>'
  ])('对未知标签、属性、视觉类和错误嵌套失败关闭:%s', (source) => {
    expect(parseSemanticHtml(source)).toMatchObject({ ok: false });
  });

  it.each([
    '<data class="detail-value">1</data>',
    '<data data-key="amount">1</data>',
    '<data><strong>1</strong></data>',
    '<data>1元</data>',
    '<data>1,000</data>',
    '<data>1e3</data>',
    '<data></data>',
    '<data> 1</data>',
    '<data>1 </data>',
    '<data>01</data>',
    '<data>1</data'
  ])('任一非法 data 使整段 semanticHtml 失败关闭:%s', (source) => {
    expect(parseSemanticHtml(`前缀${source}后缀`)).toMatchObject({ ok: false });
  });

  it.each([
    `<data>${'9'.repeat(309)}</data>`,
    `<data>0.${'0'.repeat(323)}1</data>`
  ])('对溢出或非零下溢的 data 失败关闭', (source) => {
    expect(parseSemanticHtml(source)).toMatchObject({ ok: false });
  });
});
