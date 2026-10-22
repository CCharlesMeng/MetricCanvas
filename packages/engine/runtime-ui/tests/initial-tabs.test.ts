import { describe, expect, it } from 'vitest';
import fixture from '../../../../pages/capabilities/navigation/tab-url-initialization.json';
import source from '../../../../pages/capabilities/navigation/tab-url-source.json';
import { parsePage } from '@metriccanvas/page';
import { navigationHref } from '../../runtime/src/navigate';
import { resolveActiveTab } from '../../widgets/src/components/tab-container/tabs';
import { initialTabsFromSearch } from '../src/initial-tabs';

const parsed = parsePage(fixture);
if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
const page = parsed.page;
const containers = page.sections[0]!.components.filter(component => component.type === 'tabContainer');
const active = (search: string) => {
  const initial = initialTabsFromSearch(page, search);
  return containers.map(component => resolveActiveTab(component.props.tabs, undefined,
    initial.get(component.id) ?? component.props.defaultTab));
};

describe('URL 到初始 Tab 的解析与链接闭合', () => {
  it('容器各自显式接收参数，URL 覆盖 defaultTab，非声明参数不参与', () => {
    const before = structuredClone(page);
    expect(active('?sales-tab=detail&support-tab=closed')).toEqual(['detail', 'closed']);
    expect(active('sales-tab=detail&tab=closed')).toEqual(['detail', 'open']);
    expect(active('?sales%2Dtab=%64etail')).toEqual(['detail', 'open']);
    expect(page).toEqual(before);
  });

  it.each(['', '?sales-tab=', '?sales-tab=missing', '?sales-tab=DETAIL', '?sales-tab=%20detail',
    '?sales-tab=detail&sales-tab=overview', '?sales-tab=detail&sales-tab=detail', '?sales-tab=detail&sales%2Dtab=detail'])
  ('缺省或非法输入回退已声明默认，另一容器回退首项：%s', search => {
    expect(active(search)).toEqual(['overview', 'open']);
  });

  it('未配置接收参数的旧容器忽略同名 URL 输入，实例之间相互隔离', () => {
    const document = structuredClone(fixture);
    document.sections[0]!.components.forEach(component => Reflect.deleteProperty(component.props, 'initialTabUrlParam'));
    const legacy = parsePage(document);
    if (!legacy.ok) throw Error('Expected legacy page');
    expect(initialTabsFromSearch(legacy.page, '?sales-tab=detail').size).toBe(0);
    expect(active('?sales-tab=detail')).toEqual(['detail', 'open']);
    expect(active('')).toEqual(['overview', 'open']);
  });

  it('消费来源页声明的静态、参数与行字段链接；编码与锚点沿用普通导航', () => {
    const parsedSource = parsePage(source);
    if (!parsedSource.ok) throw Error(JSON.stringify(parsedSource.errors));
    const text = parsedSource.page.sections[0]!.components.find(component => component.type === 'text');
    const table = parsedSource.page.sections[0]!.components.find(component => component.type === 'table');
    if (!text || !table) throw Error('Expected source components');
    const fixed = new URL(navigationHref(text.props.links![0]!, new Map(), new Map()), 'https://example.test');
    expect(fixed.hash).toBe('#tabs');
    expect(active(fixed.search)).toEqual(['detail', 'closed']);
    const dynamic = new URL(navigationHref(text.props.links![1]!, new Map(), new Map([['preferred-tab', 'detail']])), 'https://example.test');
    expect(dynamic.searchParams.get('static')).toBe('kept');
    expect(active(dynamic.search)).toEqual(['detail', 'open']);
    const column = table.props.columns[0]!;
    if (column.kind === 'group' || !column.navigate) throw Error('Expected row link');
    const row = new URL(navigationHref(column.navigate, new Map(), new Map(), { 'tab-id': 'overview' }), 'https://example.test');
    expect(active(row.search)).toEqual(['overview', 'open']);
    const filtered = new URL(navigationHref({ href: fixed.href, query: { 'sales-tab': { source: 'filter', id: 'selection' } } },
      new Map([['selection', { type: 'dimension', dimension: 'tab', values: ['overview'] }]]), new Map()), 'https://example.test');
    expect(active(filtered.search)).toEqual(['overview', 'closed']);
  });
});
