import { describe, expect, it } from 'vitest';
import type { Page } from '../src';
import { pageListEntry } from '../src';

function page(): Page {
  return {
    schemaVersion: '5.0',
    id: 'inventory-overview',
    meta: { description: '库存经营看板' },
    dataSources: {},
    sections: [
      {
        id: 'overview',
        components: [
          {
            id: 'header',
            type: 'reportHeader',
            layout: { span: 12 },
            props: { title: '库存概览' }
          }
        ]
      }
    ]
  };
}

describe('看板页面列表条目', () => {
  it('统一从报告页头派生列表标题和说明', () => {
    expect(pageListEntry(page())).toEqual({
      id: 'inventory-overview',
      title: '库存概览',
      description: '库存经营看板'
    });
  });

  it('没有报告页头时使用页面 id 作为标题', () => {
    const document = page();
    document.sections[0]!.components = [];

    expect(pageListEntry(document)).toEqual({
      id: 'inventory-overview',
      title: 'inventory-overview',
      description: '库存经营看板'
    });
  });
});
