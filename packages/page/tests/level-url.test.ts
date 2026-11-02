import { describe, expect, it } from 'vitest';
import document from '../../../pages/capabilities/filters/ioc-region-url-demo.json';
import { parsePage } from '../src';
import { filterURLKeys } from '../src/filter-url';

describe('IOC Header 固定组织 URL 输入', () => {
  it('无需映射字段，旧版本 IOC 页面也可沿用原声明', () => {
    const before = JSON.stringify(document);
    for (const schemaVersion of ['6.41', '6.75', '6.78']) expect(parsePage({ ...document, schemaVersion }).ok).toBe(true);
    expect(JSON.stringify(document)).toBe(before);
    const parsed = parsePage(document);
    if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
    expect(parsed.page.filters![0]!.urlParams).toBeUndefined();
    expect(filterURLKeys(parsed.page.filters![0]!, true)).toMatchObject({ 'node/region-dept': 'region-dept', 'node/office': 'rep-office' });
  });

  it('普通页面保留同形层级筛选，组织专用键不自动进入其 URL 输入', () => {
    const ordinary = structuredClone(document);
    Reflect.deleteProperty(ordinary, 'iocHeader');
    const parsed = parsePage(ordinary);
    if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
    expect(filterURLKeys(parsed.page.filters![0]!)).toEqual({ value: 'region', level: 'region.level' });
  });

  it('固定组织参数名由 IOC Header 保留，普通页面仍可使用同名独立输入', () => {
    const raw = structuredClone(document);
    Object.assign(raw, { filters: [...raw.filters, { id: 'rep-office', type: 'search', visible: false }] });
    expect(parsePage(raw).errors).toContainEqual(expect.objectContaining({ message: 'URL 参数名重复:rep-office' }));
    Reflect.deleteProperty(raw, 'iocHeader');
    expect(parsePage(raw).ok).toBe(true);
  });

  it('撤回的通用映射不是页面协议字段', () => {
    const raw = structuredClone(document);
    Object.assign(raw.filters[0]!, { urlParams: { byLevel: { office: 'rep-office' } } });
    expect(parsePage(raw).ok).toBe(false);
  });
});
