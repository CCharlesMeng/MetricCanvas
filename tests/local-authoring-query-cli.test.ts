import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const install = mkdtempSync(path.join(tmpdir(), 'authoring-query-cli-'));
const source = 'metriccanvas-authoring/skill/metriccanvas-local-authoring';
const execute = (args: string[]) => spawnSync(process.execPath, [path.join(install, 'scripts/read-knowledge.mjs'), ...args],
  {cwd: tmpdir(), encoding: 'utf8', timeout: 15_000, env: {PATH: process.env.PATH}});
function read(args: string[]) {
  const result = execute(args);
  expect(result.status, result.stderr).toBe(0);
  expect(Buffer.byteLength(result.stdout)).toBeLessThanOrEqual(args[0] === 'find' ? 1024 : 2048);
  return JSON.parse(result.stdout);
}
beforeAll(() => cpSync(source, install, {recursive: true}));
afterAll(() => rmSync(install, {recursive: true, force: true}));

describe('installed knowledge workflow', () => {
  it('finds a time example then reads only its precise format and required field contract', () => {
    const result = read(['find', '--kind', 'example', '--owner', 'table', '--query', '时间格式']);
    const id = result.items[0].id;
    const outline = read(['show', '--id', id, '--select', 'outline']);
    const table = outline.items.find((item: {type: string}) => item.type === 'table');
    const at = table.path + '/props/columns/1';
    const snippet = read(['show', '--id', id, '--select', 'snippet', '--at', at]);
    expect(snippet.value.field.format).toEqual({type: 'time', pattern: 'YYYY-MM-DD HH:mm:ss'});
    expect(snippet.contextRules).toContainEqual({id:'rule:table-column-binding-unique',description:'表格列字段绑定不重复'});
    const dependencies = read(['show', '--id', id, '--select', 'dependencies', '--at', at]);
    expect(dependencies.items.some((item: {kind: string; field: string}) => item.kind === 'field' && item.field === 'createdAt')).toBe(true);
    expect(dependencies.complete).toBe(true);
    expect(dependencies.dependenciesResolved).toBe('not-assessed');
    expect(JSON.stringify(dependencies)).not.toContain('2026-11-09T18:30:00Z');
  });

  it('resolves tableColumn.field.format without the unrelated export.format', () => {
    const found = read(['find', '--kind', 'schema', '--owner', 'tableColumn', '--query', 'format']);
    const field = found.items.find((item: {path: string}) => item.path === 'tableColumn.field.format');
    expect(field).toBeDefined();
    const placement = read(['show', '--id', field.id, '--owner', field.owner, '--select', 'placement']);
    expect(placement.path).toBe('tableColumn.field.format');
    expect(placement.parentRequired).toContain('data');
    expect(placement.contextRules.some((item:{id:string})=>item.id==='rule:table-column-binding-unique')).toBe(true);
    const shape = read(['show', '--id', field.id, '--owner', field.owner, '--select', 'shape']);
    expect(shape.items.some((item: {kind: string}) => item.kind === 'branch')).toBe(true);
  });

  it('discovers and reads time semantics even when old topic headings omit them', () => {
    const found = read(['find', '--kind', 'semantic', '--query', 'UTC+8']);
    expect(found.items.length).toBeGreaterThan(0);
    const text = read(['show', '--id', found.items[0].id, '--select', 'text']);
    expect(text.items.some((item: {text: string}) => item.text.includes('UTC+8'))).toBe(true);
  });

  it('rejects wrong parameters and detects altered example content before exposing it', () => {
    for (const args of [['find', '--select', 'shape'], ['find', '--limit', '0'], ['show', '--id', 'example:missing'], ['find', '--unknown', 'value']]) {
      expect(execute(args).status).toBe(1);
    }
    const file = path.join(install, 'references/page-metadata/examples/table-time-format.json');
    const original = readFileSync(file, 'utf8');
    writeFileSync(file, original + ' ');
    try {
      const result = execute(['show', '--id', 'example:table-time-format', '--select', 'outline']);
      expect(result.status).toBe(2);
      expect(result.stderr).toContain('hash mismatch');
    } finally { writeFileSync(file, original); }
  });

  it('shares bounded queries with the MC bridge while preserving its legacy pointer interface', () => {
    const bridge = 'metriccanvas-authoring/mc-content/scripts/read-knowledge.mjs';
    const invoke = (input: unknown) => spawnSync(process.execPath, [bridge], {encoding:'utf8',input:JSON.stringify(input),timeout:15_000});
    const found = invoke({command:'find',kind:'example',owner:'table',query:'时间格式'});
    expect(found.status,found.stderr).toBe(0);
    expect(Buffer.byteLength(found.stdout)).toBeLessThanOrEqual(1024);
    expect(JSON.parse(found.stdout).items[0].id).toBe('example:table-time-format');
    const legacy = invoke({pointers:['#/definitions/staticFieldBinding']});
    expect(legacy.status,legacy.stderr).toBe(0);
    expect(JSON.parse(legacy.stdout).nodes.some((node:{pointer:string})=>node.pointer==='#/definitions/staticFieldBinding')).toBe(true);
    expect(invoke({command:'find',kind:'example',limit:0}).status).toBe(1);
  });
});
