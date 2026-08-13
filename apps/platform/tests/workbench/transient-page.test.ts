import { describe, expect, it } from 'vitest';
import { parsePage, validate } from '@metriccanvas/page';
import {
  TRANSIENT_PAGE_ID_PATTERN,
  isTransientPageId,
  workbenchPageViewModel
} from '../../src/lib/workbench/transient-page';

/** 与 /ask 路由(轨道 F)一致的临时页面 id 样例。 */
const TRANSIENT_ID = 'ask-transient-8f2c3a1b';
const ASSET_ID = 'sales-overview';

function pageDocument(pageId: string): Record<string, unknown> {
  return {
    schemaVersion: '5.0',
    id: pageId,
    meta: { description: '各区域 Tokens 消耗' },
    dataSources: {
      'region-consumption': {
        fields: {
          region: { type: 'string', role: 'dimension', label: '区域', nullable: false },
          tokens: {
            type: 'number',
            role: 'measure',
            label: '消耗量',
            nullable: false,
            defaultFormat: 'number-grouped'
          }
        },
        source: {
          type: 'inline',
          rows: [
            { region: '华东', tokens: 44700000 },
            { region: '华南', tokens: 27600000 }
          ]
        }
      }
    },
    sections: [
      {
        id: 'main',
        title: '问数结果',
        container: 'panel',
        components: [
          {
            id: 'region-consumption-bar-chart',
            type: 'barChart',
            layout: { span: 6 },
            data: { main: 'region-consumption' },
            props: {
              title: '各区域消耗',
              categoryField: 'region',
              series: [{ field: 'tokens', label: '消耗量' }]
            }
          },
          {
            id: 'summary-text',
            type: 'text',
            layout: { span: 6 },
            props: { title: '分析结论', body: '华东领先。' }
          }
        ]
      }
    ]
  };
}

describe('临时页面 id 命名规范', () => {
  it('规范为 ask-transient- 前缀 + 8 位十六进制', () => {
    expect(isTransientPageId(TRANSIENT_ID)).toBe(true);
    expect(isTransientPageId('ask-transient-00000000')).toBe(true);
    expect(isTransientPageId('ask-transient-8F2C3A1B')).toBe(false);
    expect(isTransientPageId('ask-transient-123')).toBe(false);
    expect(isTransientPageId('ask-transient-')).toBe(false);
    expect(isTransientPageId(ASSET_ID)).toBe(false);
    expect(isTransientPageId('transient-ask-8f2c3a1b')).toBe(false);
  });

  it('符合规范的临时 id 通过页面校验', () => {
    expect(TRANSIENT_PAGE_ID_PATTERN.test(TRANSIENT_ID)).toBe(true);
    expect(validate(pageDocument(TRANSIENT_ID))).toEqual([]);
  });
});

describe('统一运行时不按页面 id 分叉(ADR-0021 对照自证)', () => {
  it('同一文档内容在临时 id 与正式 id 下的页面解析结果一致', () => {
    const transient = parsePage(pageDocument(TRANSIENT_ID));
    const asset = parsePage(pageDocument(ASSET_ID));
    if (!transient.ok || !asset.ok) throw new Error('页面解析应当成功');

    // 渲染输入(parsePage 产物)除 id 外逐字段一致:统一运行时只吃文档,
    // 不存在按 id 选择样式、组件或交互的输入差异。
    expect({ ...transient.page, id: 'normalized' }).toEqual({
      ...asset.page,
      id: 'normalized'
    });
  });

  it('工作台视图模型除徽标与修订归属闸门外不因 id 而不同', () => {
    const transient = workbenchPageViewModel(pageDocument(TRANSIENT_ID));
    const asset = workbenchPageViewModel(pageDocument(ASSET_ID));

    expect(transient.transient).toBe(true);
    expect(asset.transient).toBe(false);
    expect({ ...transient, pageId: 'normalized', transient: false }).toEqual({
      ...asset,
      pageId: 'normalized',
      transient: false
    });
  });
});

describe('工作台页面视图模型', () => {
  it('派生组件清单:类型、目录中文名、数据槽引用与标题', () => {
    const model = workbenchPageViewModel(pageDocument(TRANSIENT_ID));
    expect(model).toMatchObject({
      pageId: TRANSIENT_ID,
      transient: true,
      description: '各区域 Tokens 消耗',
      dataSourceCount: 1
    });
    expect(model.components).toEqual([
      {
        componentId: 'region-consumption-bar-chart',
        componentType: 'barChart',
        componentLabel: '柱状图',
        dataSourceId: 'region-consumption',
        title: '各区域消耗'
      },
      {
        componentId: 'summary-text',
        componentType: 'text',
        componentLabel: '文本',
        dataSourceId: null,
        title: '分析结论'
      }
    ]);
  });
});
