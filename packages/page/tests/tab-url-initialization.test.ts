import { describe, expect, it } from 'vitest';
import fixture from '../../../pages/capabilities/navigation/tab-url-initialization.json';
import source from '../../../pages/capabilities/navigation/tab-url-source.json';
import { parsePage } from '../src';

describe('Tab URL 初始化协议', () => {
  it('完整来源页和目标页合法，声明需要 6.33，旧页面保持可读', () => {
    expect(parsePage(source).ok).toBe(true);
    expect(parsePage(fixture).ok).toBe(true);
    expect(parsePage({ ...fixture, schemaVersion: '6.32' }).ok).toBe(false);
    expect(parsePage({ ...fixture, schemaVersion: '5.4' }).ok).toBe(false);
    const legacy = structuredClone(fixture);
    legacy.schemaVersion = '6.32';
    legacy.sections[0]!.components.forEach(component => Reflect.deleteProperty(component.props, 'initialTabUrlParam'));
    expect(parsePage(legacy).ok).toBe(true);
  });

  it('参数名不能为空，defaultTab 仍须引用已声明页签', () => {
    for (const change of [{ initialTabUrlParam: '' }, { defaultTab: 'missing' }]) {
      const document = structuredClone(fixture);
      Object.assign(document.sections[0]!.components[0]!.props, change);
      expect(parsePage(document).ok).toBe(false);
    }
  });

  it('拒绝两个容器和页面参数、筛选器（含别名、范围分量）的 URL 名称冲突', () => {
    const cases = [
      { params: { display: [{ id: 'sales-tab', type: 'string', value: 'detail' }] } },
      { filters: [{ id: 'sales-tab', type: 'search' }] },
      { filters: [{ id: 'other', type: 'search', urlParams: { value: 'sales-tab' } }] },
      { filters: [{ id: 'other', type: 'numberRange', urlParams: { from: 'sales-tab' } }] }
    ];
    for (const change of cases) {
      const document = structuredClone({ ...fixture, ...change });
      if ('params' in change) Object.assign(document.sections[0]!.components[0]!.props, { title: { param: 'sales-tab' } });
      const result = parsePage(document);
      expect(result.ok).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({
        path: '/sections/0/components/0/props/initialTabUrlParam', message: 'URL 参数名重复:sales-tab'
      }));
    }
    const duplicate = structuredClone(fixture);
    duplicate.sections[0]!.components[1]!.props.initialTabUrlParam = 'sales-tab';
    expect(parsePage(duplicate).errors).toContainEqual(expect.objectContaining({
      path: '/sections/0/components/1/props/initialTabUrlParam', message: 'URL 参数名重复:sales-tab'
    }));
  });
});
