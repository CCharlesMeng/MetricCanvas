import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { tmpdir } from 'node:os';

type Raw = Record<string, any>;
const root = mkdtempSync(path.join(tmpdir(), 'authoring-context-installed-'));
const skill = path.join(root, 'skill'), bridge = path.join(root, 'mc-content');
const firstTable = '/sections/0/components/0/props/tabs/0/components/0';
const secondTable = '/sections/0/components/0/props/tabs/1/component';
const formatId = 'schema:#/definitions/staticFieldBinding/anyOf/1/properties/format';
const exportId = 'schema:#/definitions/tableComponent/properties/props/properties/toolbar/properties/export/properties/format';

function table(): Raw {
  return { id: 'duplicate', type: 'table', data: { main: 'rows', compare: 'remote' }, props: {
    columns: [{ field: { data: 'rows', field: 'createdAt', format: { type: 'time', pattern: 'YYYY-MM-DD' } } }],
    toolbar: { export: { format: 'xlsx' } }
  } };
}
function document(): Raw {
  // Missing page identity/version, component layout/data and Tab labels are deliberate.
  return { dataSources: { rows: { source: { type: 'inline', rows: [{ secret: 'PRIVATE_ROWS' }] } },
    remote: { source: { type: 'query', query: { body: 'RAW_QUERY' } } } },
  sections: [{ components: [{ id: 'duplicate', type: 'tabContainer', props: { tabs: [
    { id: 'duplicate', components: [table()] }, { id: 'duplicate', component: table() }
  ] } }] }] };
}
function target(value: unknown): string {
  const file = path.join(root, 'target.json');
  writeFileSync(file, JSON.stringify(value));
  return file;
}
function execute(args: string[]) {
  return spawnSync(process.execPath, [path.join(skill, 'scripts/read-knowledge.mjs'), ...args], {
    cwd: root, encoding: 'utf8', timeout: 15_000, env: { PATH: process.env.PATH }
  });
}
function read(args: string[]) {
  const result = execute(args);
  expect(result.status, result.stderr).toBe(0);
  expect(Buffer.byteLength(result.stdout)).toBeLessThanOrEqual(args[0] === 'find' ? 1024 : 2048);
  expect(result.stdout).not.toMatch(/PRIVATE_ROWS|RAW_QUERY/u);
  return JSON.parse(result.stdout);
}
function find(value: unknown, at: string, extra: string[] = []) {
  return read(['find', '--document', target(value), '--at', at, ...extra]);
}
function invokeBridge(input: unknown) {
  return spawnSync(process.execPath, [path.join(bridge, 'scripts/read-knowledge.mjs')], {
    cwd: root, encoding: 'utf8', input: JSON.stringify(input), timeout: 15_000, env: { PATH: process.env.PATH }
  });
}

beforeAll(() => {
  cpSync('metriccanvas-authoring/skill/metriccanvas-local-authoring', skill, { recursive: true });
  cpSync('metriccanvas-authoring/mc-content', bridge, { recursive: true });
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('仓外安装的目标文档知识查询', () => {
  it('直接消费整体非法的原始 JSON，按嵌套 Tab 的具体槽位区分格式身份', () => {
    const field = find(document(), `${firstTable}/props/columns/0/field/format`);
    expect(field.documentContext).toEqual({ status: 'resolved', documentAt: `${firstTable}/props/columns/0/field/format` });
    expect(field.items).toEqual([{ id: formatId, owner: 'staticFieldBinding' }]);
    expect(field.contextRules).toContainEqual(expect.objectContaining({ id: 'rule:table-column-binding-unique' }));
    const exported = find(document(), `${firstTable}/props/toolbar/export/format`);
    expect(exported.items).toEqual([{ id: exportId, owner: 'tableComponent' }]);
    const card = read(['show', '--id', field.items[0].id, '--owner', field.items[0].owner]);
    expect(card).toMatchObject({ id: formatId, owner: 'staticFieldBinding', select: 'card' });
    const placement = read(['show', '--id', exportId, '--owner', 'tableComponent', '--select', 'placement']);
    expect(placement.path).toBe('tableComponent.props.toolbar.export.format');
  });

  it('Tab 单组件 property 与组件数组项返回同一真实组件定义，而非包装属性', () => {
    const raw = document();
    for (const at of [firstTable, secondTable]) {
      const result = find(raw, at);
      expect(result.items).toEqual([{ id: 'schema:#/definitions/tableComponent', owner: 'tableComponent' }]);
      expect(result.documentContext).toEqual({ status: 'resolved', documentAt: at });
    }
  });

  it('未声明的列外层 format 返回准确父对象，不猜成 field.format', () => {
    const at = `${firstTable}/props/columns/0/format`, result = find(document(), at);
    expect(result).toMatchObject({ status: 'not-found', complete: false,
      documentContext: { status: 'not-found', documentAt: at }, contextAt: `${firstTable}/props/columns/0` });
    expect(result.items).toEqual([{ id: 'schema:#/definitions/tableColumn', owner: 'tableColumn' }]);
    expect(result.id).toBeUndefined();
  });

  it('重复 id 的第二张表按原始路径读取，不误选第一张表', () => {
    const raw = document();
    raw.sections[0].components[0].props.tabs[1].component.type = 'metricCard';
    raw.sections[0].components[0].props.tabs[1].component.props = {};
    const first = find(raw, `${firstTable}/props/columns/0/width`);
    expect(first.items).toEqual([{ id: 'schema:#/definitions/tableColumn/properties/width', owner: 'tableColumn' }]);
    const second = find(raw, `${secondTable}/props/title`);
    expect(second.items).toEqual([{ id: 'schema:#/definitions/metricCardComponent/properties/props/properties/title', owner: 'metricCardComponent' }]);
    expect(second.documentContext.documentAt).toBe(`${secondTable}/props/title`);
  });

  it('未知 type 明确要求上下文，候选目录可分页而不选择第一分支', () => {
    const raw = document();
    raw.sections[0].components[0].props.tabs[1].component.type = 'unrecognized';
    const result = find(raw, `${secondTable}/props/title`, ['--limit', '1']);
    expect(result).toMatchObject({ status: 'needs-context', complete: false,
      documentContext: { status: 'needs-context', documentAt: `${secondTable}/props/title` }, contextAt: secondTable });
    expect(result.needs).toContainEqual(expect.objectContaining({ documentAt: `${secondTable}/type`, values: expect.arrayContaining(['table', 'metricCard']) }));
    expect(result.total).toBeGreaterThan(1);
    expect(result.next).toEqual(expect.any(String));
    expect(result.id).toBeUndefined();
  });

  it.each([
    ['find', '--document'],
    ['find', '--document', 'TARGET', '--at'],
    ['find', '--document', 'TARGET'],
    ['find', '--at', '/sections/0'],
    ['show', '--id', formatId, '--document', 'TARGET', '--at', '/sections/0'],
    ['find', '--document', 'TARGET', '--at', '/sections/-/components'],
    ['find', '--document', 'TARGET', '--at', '/sections/9/components'],
    ['find', '--document', 'TARGET', '--at', `${firstTable}/props/columns/01/width`]
  ])('拒绝错误参数或数组位置 %j', (...args) => {
    const file = target(document());
    const result = execute(args.map(arg => arg === 'TARGET' ? file : arg));
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).not.toMatch(/PRIVATE_ROWS|RAW_QUERY/u);
  });

  it('分页游标绑定原始目标内容，即使修改不改变 Schema 候选也拒绝旧游标', () => {
    const raw = document(), at = firstTable;
    const args = ['find', '--document', target(raw), '--at', at, '--query', 'title', '--limit', '1'];
    const initial = read(args);
    expect(initial.total).toBeGreaterThan(1);
    expect(initial.next).toEqual(expect.any(String));
    const continued = read([...args, '--cursor', initial.next]);
    expect(continued.offset).toBe(1);
    raw.repairNote = 'another revision with identical candidate schema';
    target(raw);
    const stale = execute([...args, '--cursor', initial.next]);
    expect(stale.status).toBe(1);
    expect(stale.stderr).toContain('Stale or mismatched query cursor');
  });

  it('无需 at 即可先读安全组件目录，再按范围和类型找准确目标', () => {
    const raw = document();
    raw.sections[0].components[0].props.tabs[0].label = '合同归档';
    const file = target(raw);
    const directory = read(['find', '--kind', 'component', '--document', file]);
    expect(directory.kind).toBe('component');
    expect(directory.items.length).toBeGreaterThan(0);
    expect(directory.items[0].documentAt).toBe('/sections/0/components/0');
    const focused = read(['find', '--kind', 'component', '--document', file,
      '--owner', 'table', '--query', '合同归档', '--at', firstTable]);
    expect(focused.items).toEqual([expect.objectContaining({ componentId: 'duplicate', type: 'table', documentAt: firstTable,
      tabLabels: ['合同归档'], slots: [
        { slot: 'main', source: 'rows', fieldsAt: '/dataSources/rows/fields' },
        { slot: 'compare', source: 'remote', fieldsAt: '/dataSources/remote/fields' }
      ] })]);
    expect(JSON.stringify(focused)).not.toMatch(/pattern|columns|RAW_QUERY|PRIVATE_ROWS/u);
    expect(execute(['find', '--kind', 'component']).status).toBe(1);
  });

  it('从返回示例 id 限定真实模块语义，时间标题先于正文偶然匹配并绑定游标', () => {
    const examples = read(['find', '--kind', 'example', '--owner', 'table', '--query', '时间格式']);
    const id = examples.items[0].id;
    const scoped = read(['find', '--kind', 'semantic', '--example', id, '--query', '时间']);
    expect(scoped).toMatchObject({ kind: 'semantic', example: id });
    expect(scoped.scope).toContain('module-level');
    expect(scoped.items[0].title).toContain('时间');
    expect(scoped.items.every((item: { owner: string }) => item.owner === 'field-bindings-and-formats')).toBe(true);
    const args = ['find', '--kind', 'semantic', '--example', id, '--limit', '1'];
    const first = read(args);
    expect(first.next).toEqual(expect.any(String));
    expect(read([...args, '--cursor', first.next]).offset).toBe(1);
    const changed = execute(['find', '--kind', 'semantic', '--example', 'example:table-column-enums', '--limit', '1', '--cursor', first.next]);
    expect(changed.status).toBe(1);
    expect(changed.stderr).toContain('Stale or mismatched query cursor');
    const mc = invokeBridge({ command: 'find', kind: 'semantic', example: id, query: '时间' });
    expect(mc.status, mc.stderr).toBe(0);
    expect(JSON.parse(mc.stdout)).toEqual(scoped);
  });

  it.each([
    ['find', '--example', 'example:table-time-format'],
    ['find', '--kind', 'schema', '--example', 'example:table-time-format'],
    ['show', '--id', 'semantic:table:0', '--example', 'example:table-time-format'],
    ['find', '--kind', 'semantic', '--example', 'example:missing'],
    ['find', '--kind', 'semantic', '--example', 'example:table-time-format', '--document', 'TARGET', '--at', '']
  ])('拒绝错误的 semantic --example 组合 %j', (...args) => {
    const file = target(document());
    const result = execute(args.map(arg => arg === 'TARGET' ? file : arg));
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
  });

  it('独立复制的 MC JSON bridge 接受同一 raw 文档并返回相同规范身份', () => {
    const raw = document(), at = `${firstTable}/props/columns/0/field/format`;
    const local = find(raw, at), result = invokeBridge({ command: 'find', document: raw, at });
    expect(result.status, result.stderr).toBe(0);
    expect(Buffer.byteLength(result.stdout)).toBeLessThanOrEqual(1024);
    expect(result.stdout).not.toMatch(/PRIVATE_ROWS|RAW_QUERY/u);
    expect(JSON.parse(result.stdout)).toEqual(local);
    const rejected = invokeBridge({ command: 'show', document: raw, id: formatId });
    expect(rejected.status).toBe(1);
    expect(rejected.stdout).toBe('');
  });
});
