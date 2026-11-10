import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { tmpdir } from 'node:os';

type Json = Record<string, any>;
const install = mkdtempSync(path.join(tmpdir(), 'authoring-local-read-installed-'));
const skill = path.join(install, 'skill');
const firstAt = '/sections/0/components/0/props/tabs/0/component';
const secondAt = '/sections/0/components/0/props/tabs/1/components/0';

function table(): Json {
  return { id: 'shared-id', type: 'table', layout: { span: 12 }, data: { main: 'records', remote: 'remote' },
    props: { title: 'Records', columns: [{ field: 'id' }, { field: 'amount' }, { field: 'rate' }, { field: 'note' }] } };
}
function document(payload = 0): Json {
  return { schemaVersion: '6.107', id: 'sample', layout: 'dashboard',
    dataSources: {
      records: { fields: { id: { type: 'string', role: 'dimension' },
        amount: { type: 'number', role: 'measure', nullable: true, defaultFormat: 'number-2' },
        rate: { type: 'number', role: 'measure', defaultFormat: 'percent-2' },
        note: { type: 'string', role: 'dimension' } },
        source: { type: 'inline', rows: [{ id: 'a', amount: 12.56, rate: 50, note: 'first' },
          { id: 'b', amount: null, rate: 0, note: 'second' }] } },
      remote: { fields: { id: { type: 'string', role: 'dimension' } },
        source: { type: 'query', query: { body: 'PRIVATE_QUERY_BODY', language: 'dqe' } } },
      audit: { fields: { payload: { type: 'string', role: 'dimension' } },
        source: { type: 'inline', rows: [{ payload: 'PRIVATE_AUDIT_' + 'x'.repeat(payload) }] } }
    }, filters: [{ id: 'global-filter', type: 'text', label: 'PRIVATE_GLOBAL_FILTER' }],
    params: { secret: { type: 'string', default: 'PRIVATE_GLOBAL_PARAM' } },
    sections: [{ id: 'main', components: [{ id: 'tabs', type: 'tabContainer', props: { tabs: [
      { label: 'First', component: table() }, { label: 'Second', components: [table()] }
    ] } }, { id: 'summary', type: 'metricCard', data: { main: 'records' }, props: { rows: [{ label: 'Amount', valueField: 'amount' }] } }] }] };
}
function target(value: Json): string {
  const file = path.join(install, 'sample.json');
  writeFileSync(file, JSON.stringify(value));
  return file;
}
function execute(script: string, args: string[]) {
  return spawnSync(process.execPath, [path.join(skill, 'scripts', script + '.mjs'), ...args], {
    cwd: install, encoding: 'utf8', timeout: 15_000, env: { PATH: process.env.PATH }
  });
}
function read(file: string, at: string, select: string, extra: string[] = []): Json {
  const result = execute('analyze-data', ['scan', '--page', file, '--at', at, '--select', select, ...extra]);
  expect(result.status, result.stderr).toBe(0);
  expect(result.stderr).toBe('');
  expect(Buffer.byteLength(result.stdout)).toBeLessThanOrEqual(2048);
  expect(result.stdout).not.toMatch(/PRIVATE_AUDIT_|PRIVATE_QUERY_BODY|PRIVATE_GLOBAL_FILTER|PRIVATE_GLOBAL_PARAM/u);
  return JSON.parse(result.stdout);
}
function factView(value: Json): Json {
  const { pageSha256: _page, schemaSha256: _schema, next: _next, ...facts } = value;
  return facts;
}
function allPages(file: string, select: string, extra: string[] = []): Json[] {
  const result: Json[] = [];
  let cursor: string | undefined;
  do {
    const page = read(file, firstAt, select, [...extra, ...(cursor ? ['--cursor', cursor] : [])]);
    result.push(page);
    cursor = page.next;
    expect(result.length).toBeLessThan(100);
  } while (cursor);
  expect(result.at(-1)!.complete).toBe(true);
  return result;
}
function reject(file: string, args: string[]): void {
  const result = execute('analyze-data', ['scan', '--page', file, ...args]);
  expect(result.status).not.toBe(0);
  expect(result.stdout + result.stderr).not.toMatch(/PRIVATE_AUDIT_|PRIVATE_QUERY_BODY/u);
  expect(Buffer.byteLength(result.stdout + result.stderr)).toBeLessThanOrEqual(2048);
}

beforeAll(() => cpSync('metriccanvas-authoring/skill/metriccanvas-local-authoring', skill, { recursive: true }));
afterAll(() => rmSync(install, { recursive: true, force: true }));

describe('独立安装的目标事实局部读取', () => {
  it('从安全目录发现scan，重复业务id用返回的第二个实际路径读取', () => {
    const file = target(document(220_000));
    const found = execute('read-knowledge', ['find', '--kind', 'component', '--document', file, '--query', 'shared-id']);
    expect(found.status, found.stderr).toBe(0);
    const directory = JSON.parse(found.stdout);
    expect(directory.read).toMatchObject({ script: 'analyze-data.mjs', command: 'scan', positionFlag: '--at' });
    expect(directory.read.facets).toContain('fields');
    const second = directory.items.find((item: Json) => item.documentAt === secondAt);
    expect(second).toBeDefined();
    expect(read(file, second.documentAt, 'config')).toMatchObject({ componentAt: secondAt,
      page: { id: 'sample', schemaVersion: '6.107', layout: 'dashboard' }, value: { id: 'shared-id' } });
    reject(file, ['--component', 'shared-id', '--select', 'config']);
  });

  it.each(['fields', 'bindings'])('%s默认事实不随无关载荷增长，不带全局状态或数据体', select => {
    const small = target(document()), first = allPages(small, select);
    const big = target(document(240_000)), second = allPages(big, select);
    expect(second.map(factView)).toEqual(first.map(factView));
    expect(Buffer.byteLength(JSON.stringify(second))).toBe(Buffer.byteLength(JSON.stringify(first)));
    expect(first[0]!.pageSha256).not.toBe(second[0]!.pageSha256);
  });

  it('bindings先给出真实source目录；缺失来源明确unknown且不伪造完整', () => {
    const page = document(), file = target(page);
    const known = read(file, firstAt, 'bindings', ['--limit', '2']);
    expect(known.items).toEqual([{ kind: 'source', id: 'records', type: 'inline' }, { kind: 'source', id: 'remote', type: 'query' }]);
    expect(known.complete).toBe(false);
    expect(known.next).toEqual(expect.any(String));
    delete page.dataSources.remote;
    const missing = read(target(page), firstAt, 'bindings', ['--limit', '2']);
    expect(missing).toMatchObject({ status: 'unresolved', complete: false });
    expect(missing.items).toContainEqual({ kind: 'source', id: 'remote', type: 'unknown', status: 'unknown' });
    expect(missing.unresolved).toContainEqual({ type: 'UNKNOWN_SOURCE', source: 'remote' });
  });

  it('页面身份缺失时仅标partial，不为读取根属性启动自由投影', () => {
    const page = document();
    delete page.id;
    const result = read(target(page), firstAt + '/props/columns/1', 'config');
    expect(result.page).toEqual({ schemaVersion: '6.107', layout: 'dashboard', status: 'partial' });
    expect(result.value).toEqual({ field: 'amount' });
  });

  it('字段白名单保留实际defaultFormat与nullable，而不扩大到其他字段', () => {
    const pages = allPages(target(document(220_000)), 'fields', ['--source', 'records', '--field', 'amount']);
    const fields = pages.flatMap(page => page.items);
    expect(fields).toEqual([{ source: 'records', field: 'amount', at: '/dataSources/records/fields/amount',
      contract: { type: 'number', role: 'measure', nullable: true, defaultFormat: 'number-2' } }]);
    reject(target(document()), ['--at', firstAt, '--select', 'fields', '--field', 'invented']);
  });

  it('共享消费者仅返回真实组件身份及位置，不读取props全文', () => {
    const result = allPages(target(document()), 'consumers').flatMap(page => page.items);
    expect(result).toContainEqual({ componentId: 'summary', type: 'metricCard', at: '/sections/0/components/1' });
    expect(result).toContainEqual({ componentId: 'shared-id', type: 'table', at: secondAt });
    expect(result).not.toContainEqual(expect.objectContaining({ props: expect.anything() }));
  });

  it('大配置先返回目录，显式收窄后读字段绑定，输入全程不变', () => {
    const page = document(220_000);
    page.sections[0].components[0].props.tabs[0].component.props.description = 'long'.repeat(10_000);
    const file = target(page), original = readFileSync(file);
    const directory = read(file, firstAt + '/props', 'config');
    expect(directory).toMatchObject({ status: 'needs-expand', complete: false });
    expect(directory.items).toContainEqual(expect.objectContaining({ at: firstAt + '/props/columns', type: 'array' }));
    expect(read(file, firstAt + '/props/columns/1', 'config').value).toEqual({ field: 'amount' });
    expect(readFileSync(file)).toEqual(original);
  });

  it('配置中的数据体显式排除，直接请求query body或source树被拒绝', () => {
    const page = document();
    page.sections[0].components[0].props.tabs[0].component.props.debug = {
      inline: { source: { type: 'inline', rows: ['PRIVATE_QUERY_BODY'] } },
      remote: { source: { type: 'query', query: { body: 'PRIVATE_QUERY_BODY' } } }
    };
    const file = target(page), config = read(file, firstAt + '/props/debug', 'config');
    expect(config.complete).toBe(false);
    expect(config.excludedPositions).toEqual([firstAt + '/props/debug/inline/source/rows', firstAt + '/props/debug/remote/source/query/body']);
    reject(file, ['--at', firstAt + '/props/debug/remote/source/query/body', '--select', 'config']);
    reject(file, ['--at', '/dataSources/remote/source/query/body', '--select', 'config']);
  });

  it('合法指标卡rows与导航body参数保留，不按同名key误删配置', () => {
    const page = document();
    page.sections[0].components[0].props.tabs[0].component.props.columns[1].navigate = {
      href: '/target', query: { body: { source: 'row', field: 'note' } }
    };
    const file = target(page);
    expect(read(file, '/sections/0/components/1/props/rows', 'config').value).toEqual([{ label: 'Amount', valueField: 'amount' }]);
    expect(read(file, firstAt + '/props/columns/1/navigate/query/body', 'config').value).toEqual({ source: 'row', field: 'note' });
  });

  it.each([
    { args: ['--source', 'records'] }, { args: ['--field', 'amount', '--limit', '1'] }, { args: ['--source', 'records', '--field', 'amount'] }
  ])('样本缺少显式范围时拒绝：$args', ({ args }) => {
    reject(target(document()), ['--at', firstAt, '--select', 'samples', ...args]);
  });

  it('显式样本保留null/零，标注声明来源且不执行远程查询', () => {
    const result = read(target(document()), firstAt, 'samples', ['--source', 'records', '--field', 'amount', '--field', 'rate', '--limit', '2']);
    expect(result).toMatchObject({ origin: 'declared-inline', execution: 'not-run', rowLimit: 2 });
    expect(result.items.map((item: Json) => item.values)).toEqual([{ amount: 12.56, rate: 50 }, { amount: null, rate: 0 }]);
    const remote = read(target(document()), firstAt, 'samples', ['--source', 'remote', '--field', 'id', '--limit', '1']);
    expect(remote).toMatchObject({ status: 'not-available', complete: false, execution: 'not-run' });
  });

  it('长样本只返回类型和大小，范围外来源不得读取', () => {
    const page = document();
    page.dataSources.records.source.rows[0].note = 'PRIVATE_SAMPLE_LONG_' + 'x'.repeat(20_000);
    const result = read(target(page), firstAt, 'samples', ['--source', 'records', '--field', 'note', '--limit', '1']);
    expect(result.items[0].values.note).toMatchObject({ status: 'omitted', type: 'string' });
    expect(JSON.stringify(result)).not.toContain('PRIVATE_SAMPLE_LONG_');
    expect(result.complete).toBe(false);
    reject(target(page), ['--at', firstAt, '--select', 'samples', '--source', 'audit', '--field', 'payload', '--limit', '1']);
  });

  it('游标续读覆盖全部字段，参数或页面改变后明确拒绝旧游标', () => {
    const file = target(document()), first = read(file, firstAt, 'fields', ['--limit', '1']);
    expect(first.next).toEqual(expect.any(String));
    const pages = allPages(file, 'fields', ['--limit', '1']);
    expect(pages.flatMap(page => page.items).map(item => item.source + ':' + item.field)).toEqual([
      'records:id', 'records:amount', 'records:rate', 'records:note', 'remote:id'
    ]);
    reject(file, ['--at', firstAt, '--select', 'fields', '--source', 'records', '--limit', '1', '--cursor', first.next]);
    target(document(10));
    reject(file, ['--at', firstAt, '--select', 'fields', '--limit', '1', '--cursor', first.next]);
  });

  it('旧scan仍含共享闭包，draft拒绝局部选项而保持全页范围', () => {
    const page = document(), file = target(page);
    const legacy = execute('analyze-data', ['scan', '--page', file, '--component', 'summary']);
    expect(legacy.status, legacy.stderr).toBe(0);
    expect(JSON.parse(legacy.stdout).consumers).toContainEqual(expect.objectContaining({ id: 'shared-id', path: firstAt }));
    const md = path.join(install, 'metrics.md'); writeFileSync(md, '# Amount\n\n金额。');
    const draft = execute('analyze-data', ['draft', '--page', file, '--md', md]);
    expect(draft.status, draft.stderr).toBe(0);
    expect(JSON.parse(draft.stdout).entries.length).toBeGreaterThan(5);
    const rejected = execute('analyze-data', ['draft', '--page', file, '--md', md, '--at', firstAt, '--select', 'fields']);
    expect(rejected.status).not.toBe(0);
  });
});
