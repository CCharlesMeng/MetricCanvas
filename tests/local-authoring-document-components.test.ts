import { describe, expect, it } from 'vitest';
import { findDocumentComponents } from '../tools/scripts/local-authoring-document-components';
import { jsonBytes, queryPage } from '../tools/scripts/local-authoring-query-budget';

type Raw = Record<string, any>;
function document(): Raw {
  return { dataSources: { records: { fields: { createdAt: { type: 'datetime' } },
    source: { type: 'inline', rows: [{ secret: 'PRIVATE_ROWS'.repeat(20_000) }] } },
  remote: { source: { type: 'query', query: { body: 'RAW_QUERY'.repeat(20_000) } } } },
  sections: [{ components: [{ id: 'tabs', type: 'tabContainer', props: { tabs: [
    { label: '境内合同', components: [{ id: 'duplicate', type: 'table', data: { main: 'records', compare: 'remote' },
      props: { title: '签约时间', rows: ['HIDDEN_PROPS'], columns: [{ field: 'createdAt' }] } }] },
    { label: '境外合同', component: { id: 'duplicate', type: 'compositeCard', props: { title: '经营概览', components: [
      { id: 'metric', type: 'metricCard', data: { main: 'records' }, props: { title: '收入' } },
      { id: 'custom', type: 'unknown-component', props: { title: '未知组件' } }
    ] } } }
  ] } }] }], detailViews: [{ components: [{ id: 'detail', type: 'table', props: { title: '详情' } }] }] };
}
const tableAt = '/sections/0/components/0/props/tabs/0/components/0';
const compositeAt = '/sections/0/components/0/props/tabs/1/component';

describe('原始页面的安全组件目录', () => {
  it('沿真实组件树列出两种 Tab、组合卡、详情视图，重复 id 保留准确路径', () => {
    const result = findDocumentComponents(document());
    expect(result.items.map(item => item.documentAt)).toEqual([
      '/sections/0/components/0', tableAt, compositeAt, `${compositeAt}/props/components/0`,
      `${compositeAt}/props/components/1`, '/detailViews/0/components/0'
    ]);
    expect(result.items.filter(item => item.componentId === 'duplicate')).toHaveLength(2);
    expect(result.items[1]).toEqual({ componentId: 'duplicate', type: 'table', documentAt: tableAt,
      title: '签约时间', tabLabels: ['境内合同'], slots: [
        { slot: 'main', source: 'records', fieldsAt: '/dataSources/records/fields' },
        { slot: 'compare', source: 'remote', fieldsAt: '/dataSources/remote/fields' }
      ] });
  });

  it.each(['duplicate', 'TABLE', '签约时间', '境内合同'])('按组件 id、type、标题或祖先 Tab 标签搜索 %s', query => {
    const result = findDocumentComponents(document(), { query, owner: 'table', at: '/sections' });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.documentAt).toBe(tableAt);
  });

  it('范围按 JSON Pointer 边界匹配，不把索引 1 当作 10 的前缀', () => {
    const raw = document();
    raw.sections[0].components = Array.from({ length: 11 }, (_, index) => ({ id: String(index), type: 'table' }));
    expect(findDocumentComponents(raw, { at: '/sections/0/components/1' }).items.map(item => item.componentId)).toEqual(['1']);
    expect(findDocumentComponents(document(), { at: compositeAt }).items).toHaveLength(3);
    expect(findDocumentComponents(document(), { at: '/absent' }).items).toEqual([]);
  });

  it('修复中的嵌套 Tab 保留所有实际祖先标签，不读取标签对象正文', () => {
    const raw = { sections: [{ components: [{ type: 'tabContainer', props: { tabs: [{ label: '外层',
      component: { type: 'tabContainer', props: { tabs: [{ label: '内层', component: { type: 'table', props: {} } }] } }
    }] } }] }] };
    expect(findDocumentComponents(raw, { owner: 'table' }).items[0]!.tabLabels).toEqual(['外层', '内层']);
  });

  it('修复中的不完整页面与未知 type 可列出，动态文本不被求值或回传', () => {
    const raw = { sections: [{ components: [{ id: 'x', type: 'custom', props: { title: { source: 'RAW_QUERY' } } }, {}] }] };
    expect(findDocumentComponents(raw).items).toEqual([
      { componentId: 'x', type: 'custom', documentAt: '/sections/0/components/0' },
      { documentAt: '/sections/0/components/1' }
    ]);
    expect(findDocumentComponents(null).items).toEqual([]);
  });

  it('只展示受控短 slot 引用，不读取源本体；过长或非法引用明确省略', () => {
    const raw = document();
    raw.sections[0].components[0].props.tabs[0].components[0].data = {
      main: 'missing', compare: 'records', target: 'remote', extra: 'records',
      ['long'.repeat(1000)]: 'records', query: 'RAW_QUERY'.repeat(20_000), nested: { rows: 'PRIVATE_ROWS' }
    };
    const item = findDocumentComponents(raw, { at: tableAt }).items[0]!;
    expect(item.slots).toEqual([
      { slot: 'main', source: 'missing', fieldsAt: '/dataSources/missing/fields' },
      { slot: 'compare', source: 'records', fieldsAt: '/dataSources/records/fields' },
      { slot: 'target', source: 'remote', fieldsAt: '/dataSources/remote/fields' }
    ]);
    expect(item).toMatchObject({ slotsStatus: 'partial', omittedSlots: 4, documentAt: tableAt });
    expect(JSON.stringify(item)).not.toMatch(/RAW_QUERY|PRIVATE_ROWS/u);
  });

  it('长标题给短摘要但搜索仍覆盖完整标题，非标准 data 形态只给状态', () => {
    const raw = { sections: [{ components: [{ id: 'test', type: 'table', data: 'PRIVATE_ROWS'.repeat(20_000),
      props: { title: '合同'.repeat(2000) + '唯一搜索尾词' } }] }] };
    const item = findDocumentComponents(raw, { query: '唯一搜索尾词' }).items[0]!;
    expect(item.title).toBe('合同'.repeat(40) + '…');
    expect(item.slotsStatus).toBe('unsupported-shape');
    expect(JSON.stringify(item)).not.toContain('PRIVATE_ROWS');
  });

  it('IOC 页头使用静态身份标题，普通组件不把同名 identity 当作标题', () => {
    const raw = { sections: [{ components: [
      { type: 'iocHeader', props: { identity: { title: '合同看板' } } },
      { type: 'table', props: { identity: { title: 'PRIVATE_ROWS' } } }
    ] }] };
    expect(findDocumentComponents(raw, { query: '合同看板' }).items).toHaveLength(1);
    expect(findDocumentComponents(raw).items[1]!.title).toBeUndefined();
  });

  it('整个目录绝不复制 props、data、source、query、rows 或原始目标文档', () => {
    const raw = document(), before = JSON.stringify(raw), result = findDocumentComponents(raw);
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE_ROWS|RAW_QUERY|HIDDEN_PROPS|columns|createdAt/u);
    expect(JSON.stringify(raw)).toBe(before);
    expect(Object.keys(result)).toEqual(['kind', 'documentAt', 'items', 'read']);
    expect(result.read).toEqual({ script: 'analyze-data.mjs', command: 'scan', positionFlag: '--at',
      facets: ['config', 'bindings', 'fields', 'consumers', 'samples'] });
  });

  it('queryPage 集成逐页保持 1KiB，覆盖全部目录且游标绑定内容', () => {
    const result = findDocumentComponents(document()), options = { at: '', limit: 1 };
    const received: unknown[] = [];
    let cursor: string | undefined;
    do {
      const page = queryPage(result, { ...options, cursor }, 'find', 'raw-document-revision');
      expect(jsonBytes(page)).toBeLessThanOrEqual(1024);
      expect(JSON.stringify(page)).not.toMatch(/PRIVATE_ROWS|RAW_QUERY/u);
      received.push(...page.items as unknown[]);
      cursor = page.next as string | undefined;
    } while (cursor);
    expect(received).toEqual(result.items);
    const first = queryPage(result, options, 'find', 'raw-document-revision');
    expect(() => queryPage(result, { ...options, cursor: String(first.next) }, 'find', 'changed-revision')).toThrow('Stale');
  });

  it.each(['#', 'sections/0', '/sections/~2'])('拒绝非 JSON Pointer 范围 %s', at => {
    expect(() => findDocumentComponents(document(), { at })).toThrow('JSON Pointer');
  });
});
