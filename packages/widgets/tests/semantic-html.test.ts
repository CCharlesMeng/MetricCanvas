import { describe, expect, it } from 'vitest';
import { parseSemanticHtml } from '../src/components/ranking-detail-card/semantic-html';

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
});
