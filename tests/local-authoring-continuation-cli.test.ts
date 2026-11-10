import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { build } from 'esbuild';

const root = mkdtempSync(path.join(tmpdir(), 'authoring-continuation-'));
const install = path.join(root, 'skill');
const script = path.join(install, 'scripts/read-knowledge.mjs');
const baselineScript = path.join(install, 'scripts/baseline-read-knowledge.mjs');
const target = path.join(root, 'input page.json');
const at = '/sections/0/components/3/props/columns/1/field';
const base = ['resolve', '--document', target, '--at', at, '--aspect', 'numeric-format', '--limit', '1'];
function execute(args: string[], entry = script) {
  return spawnSync(process.execPath, [entry, ...args], { cwd: root, encoding: 'utf8', timeout: 15_000 });
}
function read(args: string[]) {
  const result = execute(args);
  expect(result.status, result.stderr).toBe(0);
  expect(Buffer.byteLength(result.stdout)).toBeLessThanOrEqual(8192);
  return JSON.parse(result.stdout);
}
function resetPage() {
  cpSync('pages/capabilities/data/numeric-value-display.json', target);
}
beforeAll(async () => {
  cpSync('metriccanvas-authoring/skill/metriccanvas-local-authoring', install, { recursive: true });
  cpSync(script, baselineScript);
  // Exercise this source revision without modifying any distributed bundle.
  await build({ entryPoints: ['tools/scripts/local-authoring-knowledge-reader.ts'], outfile: script,
    bundle: true, platform: 'node', format: 'esm', target: 'node22', logLevel: 'silent' });
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('知识CLI的命令帮助与续读兼容', () => {
  it.each(['resolve', 'find', 'show', 'list'])('%s --help无需页面参数或知识包即可读取', command => {
    const emptyInstall = path.join(root, 'without-knowledge');
    mkdirSync(path.join(emptyInstall, 'scripts'), { recursive: true });
    const entry = path.join(emptyInstall, 'scripts/read-knowledge.mjs');
    cpSync(script, entry);
    const result = execute([command, '--help'], entry);
    expect(result.status, result.stderr).toBe(0);
    const help = JSON.parse(result.stdout);
    expect(help.commands.length).toBeGreaterThan(0);
    expect(help.commands.every((usage: string) => usage.startsWith(command + ' '))).toBe(true);
    expect(help.continuation).toContain('--cursor');
    expect(help.continuation).toContain('--next');
  });

  it('正常数值读取逐页字节不增加，完整读取次数保持不变', () => {
    resetPage();
    const args = base.slice(0, -2);
    let next: string | undefined;
    let pages = 0;
    do {
      const request = [...args, ...(next ? ['--cursor', next] : [])];
      const baseline = execute(request, baselineScript);
      const current = execute(request);
      expect(current.status, current.stderr).toBe(0);
      expect(baseline.status, baseline.stderr).toBe(0);
      expect(current.stdout).toBe(baseline.stdout);
      expect(Buffer.byteLength(current.stdout)).toBeLessThanOrEqual(8192);
      next = JSON.parse(current.stdout).next;
      pages++;
      expect(pages).toBeLessThan(30);
    } while (next);
    expect(pages).toBeGreaterThan(0);
  });

  it('next别名与cursor生成逐字相同续页，不改变规范化后的请求身份', () => {
    resetPage();
    const first = read(base);
    expect(first.next).toEqual(expect.any(String));
    const cursor = execute([...base, '--cursor', first.next]);
    const alias = execute([...base, '--next', first.next]);
    expect(alias.status, alias.stderr).toBe(0);
    expect(alias.stdout).toBe(cursor.stdout);
    const second = JSON.parse(alias.stdout);
    expect(second.next).toEqual(expect.any(String));
    expect(execute([...base, '--next', second.next]).stdout).toBe(execute([...base, '--cursor', second.next]).stdout);
  });

  it('别名仍绑定页面内容和读取参数，不能绕过过期或串用检查', () => {
    resetPage();
    const first = read(base);
    const differentAspect = [...base];
    differentAspect[differentAspect.indexOf('numeric-format')] = 'signed-number';
    const mismatch = execute([...differentAspect, '--next', first.next]);
    expect(mismatch.status).toBe(1);
    expect(mismatch.stderr).toContain('Stale or mismatched');
    const page = JSON.parse(readFileSync(target, 'utf8'));
    page.title = 'changed input identity';
    writeFileSync(target, JSON.stringify(page));
    const stale = execute([...base, '--next', first.next]);
    expect(stale.status).toBe(1);
    expect(stale.stderr).toContain('Stale or mismatched');
  });

  it('同时提供next和cursor拒绝歧义，空next和未知命令帮助保持调用错误', () => {
    resetPage();
    const first = read(base);
    expect(execute([...base, '--next', first.next, '--cursor', first.next]).status).toBe(1);
    expect(execute([...base, '--cursor', first.next, '--next', first.next]).status).toBe(1);
    expect(execute([...base, '--next']).status).toBe(1);
    expect(execute(['unknown', '--help']).status).toBe(1);
  });
});
