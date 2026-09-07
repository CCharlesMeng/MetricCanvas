import { describe, expect, it } from 'vitest';
import { isDataComponent, type Component } from '@metriccanvas/page';
import { rendersWithoutWidgetHost } from '../src/widget-host-state';

/**
 * `rendersWithoutWidgetHost` 与 `isDataComponent` 是同一条判定的两个方向:
 * 声明数据槽的组件才有加载态与错误态可呈现。两者曾各自列一遍类型名,新增纯容器
 * 只改了一边(组合卡),这份测试把「方向相反、内容互补」钉住。
 */
function component(type: Component['type']): Component {
  return { id: 'probe', type, layout: { span: 6 }, props: {} } as unknown as Component;
}

const CONTAINERS = ['tabContainer', 'compositeCard'] as const;
const CHROME = ['reportHeader', 'text', 'aiSummary'] as const;
const DATA_COMPONENTS = [
  'metricCard',
  'barChart',
  'lineChart',
  'pieChart',
  'table',
  'mapChart',
  'gauge',
  'rankingCard',
  'rankingDetailCard',
  'keyValuePanel',
  'categoryBreakdown',
  'fieldText'
] as const;

describe('rendersWithoutWidgetHost', () => {
  it('两个纯容器都不经 WidgetHost:加载态与错误态归各自的子组件', () => {
    for (const type of CONTAINERS) {
      expect(rendersWithoutWidgetHost(component(type))).toBe(true);
    }
  });

  it('不声明数据槽的装饰与生成型组件也不经 WidgetHost', () => {
    for (const type of CHROME) {
      expect(rendersWithoutWidgetHost(component(type))).toBe(true);
    }
  });

  it('声明数据槽的组件一律经 WidgetHost,新增的分类明细也在内', () => {
    for (const type of DATA_COMPONENTS) {
      expect(rendersWithoutWidgetHost(component(type))).toBe(false);
    }
  });

  it('与 isDataComponent 逐个类型互补,不允许一边漏一个', () => {
    for (const type of [...CONTAINERS, ...CHROME, ...DATA_COMPONENTS]) {
      const probe = component(type);
      expect(rendersWithoutWidgetHost(probe)).toBe(!isDataComponent(probe));
    }
  });
});
