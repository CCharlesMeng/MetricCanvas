import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { tmpdir } from 'node:os';

const root = mkdtempSync(path.join(tmpdir(), 'authoring-contract-installed-'));
const skill = path.join(root, 'skill');
const bridge = path.join(root, 'mc');
const target = path.join(root, 'page.json');
const at = '/sections/0/components/3/props/columns/1/field';
function execute(args: string[]) {
  return spawnSync(process.execPath, [path.join(skill, 'scripts/read-knowledge.mjs'), ...args], {
    cwd: root, encoding: 'utf8', timeout: 15_000, env: {PATH: process.env.PATH}
  });
}
function resolve(extra: string[] = []) {
  const result = execute(['resolve', '--document', target, '--at', at, '--aspect', 'numeric-format', ...extra]);
  expect(result.status, result.stderr).toBe(0);
  expect(Buffer.byteLength(result.stdout)).toBeLessThanOrEqual(8192);
  expect(result.stdout).not.toContain('PRIVATE_UNRELATED_');
  return JSON.parse(result.stdout);
}
function allItems(limit: string) {
  const items: unknown[] = [];
  let next: string | undefined;
  do {
    const result = resolve(['--limit', limit, ...(next ? ['--cursor', next] : [])]);
    items.push(...result.items); next = result.next;
  } while (next);
  return items;
}
function original() {
  return JSON.parse(readFileSync('pages/capabilities/data/numeric-value-display.json', 'utf8'));
}
function save(value: unknown) { writeFileSync(target, JSON.stringify(value)); }
beforeAll(() => {
  cpSync('metriccanvas-authoring/skill/metriccanvas-local-authoring', skill, {recursive: true});
  cpSync('metriccanvas-authoring/mc-content', bridge, {recursive: true});
});
afterAll(() => rmSync(root, {recursive: true, force: true}));

describe('仓外安装的目标关联契约', () => {
  it('真实数字字段一次到达结构和原文；不要求先检索示例', () => {
    save(original());
    const result = resolve();
    expect(result.kind).toBe('contract');
    expect(result.coverage).toBe('registered');
    expect(JSON.stringify(result)).toContain('percent-1');
    expect(JSON.stringify(result)).toContain('小数末尾零');
    expect(JSON.stringify(result)).toContain('missingText');
  });

  it('同名导出format不冒充字段格式，未登记返回缺口', () => {
    const page = original();
    page.sections[0].components[3].props.toolbar = {export: {format: 'xlsx'}};
    save(page);
    const result = execute(['resolve', '--document', target, '--at', '/sections/0/components/3/props/toolbar/export/format', '--aspect', 'numeric-format']);
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout).coverage).not.toBe('registered');
    expect(result.stdout).not.toContain('小数末尾零');
  });

  it('大无关载荷不会进入输出；同输入原文分页精确重建，变更后游标失效', () => {
    const page = original();
    save(page);
    const full = allItems('30');
    expect(allItems('1')).toEqual(full);
    const first = resolve(['--limit', '1']);
    expect(first.next).toEqual(expect.any(String));
    page.dataSources.unrelated = {source: {type: 'inline', rows: [{payload: 'PRIVATE_UNRELATED_'.repeat(20_000)}]}};
    save(page);
    expect(allItems('30')).toEqual(full);
    const stale = execute(['resolve', '--document', target, '--at', at, '--aspect', 'numeric-format', '--limit', '1', '--cursor', first.next]);
    expect(stale.status).toBe(1);
    expect(stale.stderr).toContain('Stale');
  });

  it('MC与local消费同一关联，且源页面字节不变', () => {
    const page = original(); save(page);
    const before = readFileSync(target, 'utf8');
    const local = resolve();
    const result = spawnSync(process.execPath, [path.join(bridge, 'scripts/read-knowledge.mjs')], {
      cwd: root, encoding: 'utf8', input: JSON.stringify({command: 'resolve', document: page, at, aspect: 'numeric-format'}), timeout: 15_000
    });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(local);
    expect(readFileSync(target, 'utf8')).toBe(before);
  });

  it.each([
    ['resolve'],
    ['resolve', '--at', at, '--aspect', 'numeric-format'],
    ['resolve', '--document', target, '--at', at, '--aspect', 'unknown'],
    ['resolve', '--document', target, '--at', at, '--aspect', 'numeric-format', '--select', 'shape'],
    ['find', '--document', target, '--at', at, '--aspect', 'numeric-format']
  ])('拒绝错误请求 %j', (...args) => {
    save(original());
    expect(execute(args).status).toBe(1);
  });
});
