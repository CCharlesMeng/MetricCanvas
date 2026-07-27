import { describe, expect, it } from 'vitest';
import { parseSafeMarkdown } from '../src/lib/safe-markdown';

describe('Agent 安全 Markdown 子集', () => {
  it('保留原始 HTML 为普通文本，并拒绝 javascript 链接', () => {
    expect(
      parseSafeMarkdown(
        '# 结果\n<script>alert(1)</script> **通过** [危险](javascript:evil) [预览](/pages/demo)'
      )
    ).toEqual([
      {
        type: 'heading',
        level: 1,
        content: [{ type: 'text', value: '结果' }]
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', value: '<script>alert(1)</script> ' },
          { type: 'strong', value: '通过' },
          { type: 'text', value: ' ' },
          { type: 'text', value: '[危险](javascript:evil)' },
          { type: 'text', value: ' ' },
          { type: 'link', value: '预览', href: '/pages/demo' }
        ]
      }
    ]);
  });
});
