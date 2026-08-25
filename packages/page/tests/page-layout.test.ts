import { describe, expect, it } from 'vitest';
import {
  documentLayoutForm,
  parsePage,
  requiredMinorVersion,
  sectionBackdrop,
  validate
} from '../src';

/**
 * 页面布局形态与分区叠放层：两者都是 5.1 的纯增量，因此这里既钉住
 * 「不声明等于旧观感」，也钉住 backdrop 的三条分区边界与能力下限探测。
 */

function dashboardPage(): any {
  return structuredClone({
    schemaVersion: '5.1',
    id: 'layout-probe',
    layoutForm: 'dashboard',
    dataSources: {
      regions: {
        fields: {
          name: { type: 'string', role: 'dimension', label: '区域' },
          rate: { type: 'number', role: 'measure', label: '支撑率' }
        },
        source: { type: 'inline', rows: [{ name: '中国', rate: 72.4 }] }
      }
    },
    sections: [
      {
        id: 'board',
        container: 'plain',
        components: [
          {
            id: 'map',
            type: 'mapChart',
            layout: { span: 12, layer: 'backdrop' },
            data: { main: 'regions' },
            props: { nameField: 'name', valueField: 'rate', map: 'world' }
          },
          {
            id: 'kpi',
            type: 'metricCard',
            layout: { span: 4 },
            data: { main: 'regions' },
            props: { rows: [{ label: '支撑率', valueField: 'rate' }] }
          }
        ]
      }
    ]
  });
}

describe('页面布局形态', () => {
  it('缺省是报表形态，声明后按声明值读，非法值与非对象文档都退化为缺省', () => {
    expect(documentLayoutForm({ id: 'x' })).toBe('report');
    expect(documentLayoutForm({ layoutForm: 'report' })).toBe('report');
    expect(documentLayoutForm({ layoutForm: 'dashboard' })).toBe('dashboard');
    expect(documentLayoutForm({ layoutForm: 'fullscreen' })).toBe('report');
    expect(documentLayoutForm(null)).toBe('report');
    expect(documentLayoutForm('not a document')).toBe('report');
  });

  it('形态是封闭闭集，闭集外的取值被结构校验拒绝', () => {
    const page = dashboardPage();
    page.layoutForm = 'kiosk';
    expect(validate(page)).toContainEqual(
      expect.objectContaining({ path: '/layoutForm' })
    );
  });

  it('声明形态或叠放层都要求 5.1，声明 5.0 时报到具体使用点', () => {
    const form: any = dashboardPage();
    delete form.sections[0].components[0].layout.layer;
    expect(requiredMinorVersion(form)).toBe(1);
    form.schemaVersion = '5.0';
    expect(validate(form)).toContainEqual(
      expect.objectContaining({ path: '/layoutForm' })
    );

    const layer: any = dashboardPage();
    delete layer.layoutForm;
    layer.schemaVersion = '5.0';
    expect(validate(layer)).toContainEqual(
      expect.objectContaining({ path: '/sections/0/components/0/layout/layer' })
    );
  });
});

describe('分区叠放层', () => {
  it('backdrop 分区通过校验，并能被读出来', () => {
    const page = dashboardPage();
    expect(validate(page)).toEqual([]);
    const parsed = parsePage(page);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(sectionBackdrop(parsed.page.sections[0]!)?.id).toBe('map');
  });

  it('没有 backdrop 的分区读出 undefined', () => {
    const page = dashboardPage();
    delete page.sections[0].components[0].layout.layer;
    const parsed = parsePage(page);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(sectionBackdrop(parsed.page.sections[0]!)).toBeUndefined();
  });

  it('一个分区最多一个 backdrop', () => {
    const page = dashboardPage();
    page.sections[0].components[1].layout.layer = 'backdrop';
    const errors = validate(page);
    expect(errors).toContainEqual(
      expect.objectContaining({ path: '/sections/0/components/0/layout/layer' })
    );
    expect(errors).toContainEqual(
      expect.objectContaining({ path: '/sections/0/components/1/layout/layer' })
    );
  });

  it('只有 backdrop 的分区被拒绝：没有可叠放其上的组件', () => {
    const page = dashboardPage();
    page.sections[0].components = [page.sections[0].components[0]];
    expect(validate(page)).toContainEqual(
      expect.objectContaining({ path: '/sections/0/components' })
    );
  });

  it('声明 backdrop 的分区必须是 container: plain', () => {
    for (const container of ['card', 'panel', undefined]) {
      const page = dashboardPage();
      if (container === undefined) delete page.sections[0].container;
      else page.sections[0].container = container;
      expect(validate(page)).toContainEqual(
        expect.objectContaining({ path: '/sections/0/container' })
      );
    }
  });

  it('Tab 内的子组件不得声明叠放层：Tab 里没有分区可铺满', () => {
    const page = dashboardPage();
    page.sections[0].components[1] = {
      id: 'tabs',
      type: 'tabContainer',
      layout: { span: 4 },
      props: {
        defaultTab: 'one',
        tabs: [
          {
            id: 'one',
            label: '概览',
            component: {
              id: 'nested-table',
              type: 'table',
              layout: { span: 12, layer: 'backdrop' },
              data: { main: 'regions' },
              props: { columns: [{ field: 'name' }, { field: 'rate' }] }
            }
          }
        ]
      }
    };
    expect(validate(page)).toContainEqual(
      expect.objectContaining({
        path: '/sections/0/components/1/props/tabs/0/component/layout/layer'
      })
    );
  });
});
