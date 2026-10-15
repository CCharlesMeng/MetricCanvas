import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chmod, cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parsePage } from '../packages/page/src/validate';
import { fileNameErrors } from '../packages/page/src/file-name';
import { versionPolicy } from '../packages/page/src/version';
import { validateReferenceLinks } from '../tools/scripts/page-reference';

const source = 'metriccanvas-authoring/skill/metriccanvas-local-authoring';
const isolated = await mkdtemp(path.join(tmpdir(), 'metriccanvas-local-skill-'));
const folder = path.join(isolated, 'skill');
const script = path.join(folder, 'scripts/validate-page.mjs');
const files = new Map<string,string>();
beforeAll(async () => {
  await cp(source, folder, {recursive: true});
  for (const entry of await readdir(folder, {recursive: true, withFileTypes: true})) if (entry.isFile()) {
    const absolute = path.join(entry.parentPath, entry.name);
    files.set(path.relative(folder, absolute).split(path.sep).join('/'), await readFile(absolute, 'utf8'));
  }
});
afterAll(() => rm(isolated, {recursive: true, force: true}));
const run = (args: string[]) => spawnSync(process.execPath, [script, ...args], {cwd: isolated, encoding: 'utf8', timeout: 10_000, env: {PATH: process.env.PATH}});

describe('独立本地创作 Skill', () => {
  it('查询数值容错示例可在仓外独立校验，维度和缺字段仍被拒绝', async () => {
    const sourcePage = files.get('references/page-metadata/examples/query-numeric-tolerance.json');
    expect(sourcePage).toBeDefined();
    const page = JSON.parse(sourcePage!);
    const target = path.join(isolated, `${page.id}.json`);
    await writeFile(target, JSON.stringify(page));
    expect(run([target]).status).toBe(0);
    page.dataSources.samples.source.initial.rows[0]['容错数值'] = { invalid: true };
    page.dataSources.samples.source.initial.rows[0]['容错明细'][0]['明细数值'] = [1, 2];
    await writeFile(target, JSON.stringify(page));
    expect(run([target]).status).toBe(0);
    page.dataSources.samples.source.initial.rows[0]['容错样例'] = null;
    await writeFile(target, JSON.stringify(page));
    expect(run([target]).status).toBe(1);
    page.dataSources.samples.source.initial.rows[0]['容错样例'] = '正常';
    delete page.dataSources.samples.source.initial.rows[0]['容错数值'];
    await writeFile(target, JSON.stringify(page));
    expect(run([target]).status).toBe(1);
  });

  it('整目录复制后知识链接与机器索引闭合，所有生成内容有一致的版本和哈希', () => {
    validateReferenceLinks(files);
    const manifest = JSON.parse(files.get('references/knowledge.json')!);
    expect(manifest.schemaVersion).toBe(versionPolicy.current);
    for (const entry of manifest.files) {
      expect(files.has(entry.file), entry.file).toBe(true);
      expect(createHash('sha256').update(files.get(entry.file)!).digest('hex'), entry.file).toBe(entry.sha256);
    }
    const reference = JSON.parse(files.get('references/page-metadata/index.json')!);
    expect(reference.schemaVersion).toBe(manifest.schemaVersion);
    for (const module of Object.keys(reference.modules)) expect(files.has(`references/page-metadata/${module}`), module).toBe(true);
    for (const item of [...reference.exampleCoverage, ...reference.branchCoverage]) {
      const file = item.file ?? item.negativeWitness?.file;
      if (file) expect(files.has(`references/page-metadata/${file}`), file).toBe(true);
    }
    for (const [file, content] of files) if (file.endsWith('.md') || file.endsWith('.json')) {
      expect(content, file).not.toMatch(/packages\/|tools\/|docs\/|metriccanvas-authoring\/|page\/conformance\/|PAGE-(?:METADATA|PARAMETERS)\.md/);
    }
    const version = run(['--version']);
    expect(version.status, version.stderr).toBe(0);
    expect(JSON.parse(version.stdout).schemaVersion).toBe(manifest.schemaVersion);
  });

  // Each scenario launches one bounded Node process. Combining eight CLI
  // invocations made the shared 5s test deadline depend on CI runner load.
  it.each([
    ['valid', 0], ['file-name', 1], ['semantic', 1], ['syntax', 1],
    ['missing', 2], ['empty-directory', 2], ['directory', 0]
  ] as const)('无仓库和依赖的 CLI 场景：%s', async (scenario, status) => {
    const caseFolder = await mkdtemp(path.join(isolated, 'cli-'));
    const page = JSON.parse(files.get('references/page-metadata/examples/inline-report.json')!);
    let target = path.join(caseFolder, `${page.id}.json`);
    let expectedErrors: unknown[] | undefined;
    if (scenario === 'file-name') {
      target = path.join(caseFolder, 'wrong-name.json');
      expectedErrors = fileNameErrors('wrong-name.json', page);
    } else if (scenario === 'semantic') {
      page.sections[0].components[0].id = page.sections[0].components[1].id;
      const parsed = parsePage(page);
      expect(parsed.ok).toBe(false);
      if (!parsed.ok) expectedErrors = parsed.errors;
    }
    if (scenario !== 'missing' && scenario !== 'empty-directory') {
      await writeFile(target, scenario === 'syntax' ? '{broken' : JSON.stringify(page));
    }
    const result = run([scenario === 'directory' || scenario === 'empty-directory' ? caseFolder : target]);
    expect(result.error, result.stderr).toBeUndefined();
    expect(result.status, result.stderr).toBe(status);
    if (status !== 2) {
      const receipt = JSON.parse(result.stdout);
      expect(receipt.ok).toBe(status === 0);
      if (expectedErrors) expect(receipt.errors).toEqual(expectedErrors);
      if (scenario === 'syntax') expect(receipt.errors[0].type).toBe('SCHEMA_ERROR');
    }
  });

  it('概览完整样例与短片段均可通过产品校验，地名清单无仓外依赖', async () => {
    const page = JSON.parse(files.get('assets/layouts/overview-map-led.json')!);
    expect(parsePage(page).ok).toBe(true);
    const names = JSON.parse(files.get('references/map-regions.json')!);
    expect(names.maps.world.regions).toContain('China');
    expect(names.maps.world.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
    const snippets = [...files.get('references/component-recipes.md')!.matchAll(/```json\n([\s\S]*?)\n```/g)];
    expect(snippets.length).toBe(3);
    const dimension = {type: 'string', role: 'dimension'};
    const measure = {type: 'number', role: 'measure'};
    for (const [, source] of snippets) {
      const document = {...page, dataSources: {
        'activity-summary': {fields: {count: measure, delta: measure}, source: {type: 'inline', rows: [{count: 10, delta: 2}]}},
        categories: {fields: {category: dimension, count: measure}, source: {type: 'inline', rows: [{category: '示例', count: 10}]}},
        overview: {fields: {name: dimension, amount: measure}, source: {type: 'inline', rows: [{name: '示例', amount: 10}]}}
      }, sections: [{id: 'example', components: [JSON.parse(source)]}]};
      const parsed = parsePage(document);
      expect(parsed.ok, JSON.stringify(parsed)).toBe(true);
    }
  });

  it('尝试快照保留错误字节、拒绝覆盖并检测篡改', async () => {
    const target = path.join(isolated, 'broken.json');
    const attempt = path.join(isolated, 'attempt-1');
    await writeFile(target, '{broken bytes');
    const snapshot = (args: string[]) => spawnSync(process.execPath, [path.join(folder, 'scripts/snapshot-attempt.mjs'), ...args], {cwd: isolated, encoding: 'utf8'});
    expect(snapshot([target, attempt]).status).toBe(0);
    expect(await readFile(path.join(attempt, 'broken.json'), 'utf8')).toBe('{broken bytes');
    await writeFile(target, '{different bytes');
    expect(snapshot([target, attempt]).status).toBe(1);
    expect(snapshot(['--check', attempt]).status).toBe(0);
    await chmod(path.join(attempt, 'broken.json'), 0o644);
    await writeFile(path.join(attempt, 'broken.json'), 'changed');
    expect(snapshot(['--check', attempt]).status).toBe(1);
  });

  it('独立打包校验器与当前产品对所有契约向量给出相同结果', async () => {
    const vectors: Array<{name:string;fileName:string;document:unknown;expected:unknown}> = [];
    for (const prefix of ['contracts/metriccanvas/page/conformance/valid', 'contracts/metriccanvas/page/conformance/invalid']) {
      for (const name of await readdir(prefix)) if (name.endsWith('.json')) {
        const value = JSON.parse(await readFile(path.join(prefix,name),'utf8'));
        const document = prefix.endsWith('/invalid') ? value.input : value;
        const fileName = `${document.id ?? 'invalid'}.json`;
        const parsed = parsePage(document);
        vectors.push({name, fileName, document, expected: parsed.ok ? fileNameErrors(fileName, parsed.page) : parsed.errors});
      }
    }
    const data = path.join(isolated, 'vectors.json');
    await writeFile(data, JSON.stringify(vectors));
    const runner = path.join(isolated, 'verify.mjs');
    await writeFile(runner, `import {readFileSync} from 'node:fs';\nimport {inspectPageDocument} from './skill/scripts/validate-page.mjs';\nconst cases=JSON.parse(readFileSync(new URL('./vectors.json',import.meta.url),'utf8'));\nconsole.log(JSON.stringify(cases.map(c=>({name:c.name,errors:inspectPageDocument(c.fileName,c.document)}))));\n`);
    const result = spawnSync(process.execPath, [runner], {cwd: isolated, encoding:'utf8',timeout:20_000,env:{PATH:process.env.PATH}});
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(vectors.map(v=>({name:v.name,errors:v.expected})));
    expect(vectors.length).toBeGreaterThan(100);
  });
});
