import { pageFilesById } from '../tools/scripts/page-files.mjs';
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
import { pagePattern, pagePatternSources } from '../tools/scripts/local-authoring-patterns';
import { flattenPageComponents } from '../packages/page/src/component-walk';

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
  it('仓外使用复数正式声明，并保留 6.52 单数旧拼写的读取与版本约束', async () => {
    const page = JSON.parse(files.get('references/page-metadata/examples/report-ai-summary.json')!);
    const target = path.join(await mkdtemp(path.join(isolated, 'summary-')), `${page.id}.json`);
    await writeFile(target, JSON.stringify(page));
    expect(run([target]).status).toBe(0);
    const props = page.sections[3].components[0].props;
    expect(props.relatedDataSources).toEqual(['comparison']);
    delete props.relatedDataSources;
    props.relatedDataSource = ['comparison'];
    for (const section of page.sections) for (const component of section.components) {
      if (component.type === 'aiSummary' && component.props.body) component.props.mode = 'provided';
    }
    page.schemaVersion = '6.52';
    await writeFile(target, JSON.stringify(page));
    expect(run([target]).status).toBe(0);
    page.schemaVersion = '6.51';
    await writeFile(target, JSON.stringify(page));
    const old = run([target]);
    expect(old.status).toBe(1);
    expect(JSON.parse(old.stdout).errors).toContainEqual(expect.objectContaining({ message: expect.stringContaining('6.52') }));
  });
  it('仓外安装能校验区域摘要与顶部位置，不依赖仓库源码', async () => {
    const page = JSON.parse(files.get('references/page-metadata/examples/report-ai-summary-regions.json')!);
    const target = path.join(await mkdtemp(path.join(isolated, 'regions-')), `${page.id}.json`);
    await writeFile(target, JSON.stringify(page));
    expect(run(['--expected-layout', 'report', target]).status).toBe(0);
    const children = page.sections[3].components[0].props.components;
    children.reverse();
    await writeFile(target, JSON.stringify(page));
    const invalid = run([target]);
    expect(invalid.status).toBe(1);
    expect(JSON.parse(invalid.stdout).errors).toContainEqual(expect.objectContaining({
      path: '/sections/3/components/0/props/components/2', message: expect.stringContaining('区域内容顶部')
    }));
  });
  it.each([
    ['report', 'report', 0],
    ['dashboard', 'dashboard', 0],
    ['report', 'dashboard', 1],
    [undefined, 'dashboard', 1],
    [undefined, 'report', 0]
  ] as const)('仓外按确认形态核对：文档 %s，确认 %s', async (layout, expected, status) => {
    const page = JSON.parse(files.get('references/page-metadata/examples/inline-report.json')!);
    delete page.layoutForm;
    if (layout) page.layout = layout;
    else delete page.layout;
    const target = path.join(await mkdtemp(path.join(isolated, 'layout-')), `${page.id}.json`);
    await writeFile(target, JSON.stringify(page));
    // The same document is a legal Page; failure must come from the user's expected form.
    expect(parsePage(page).ok).toBe(true);
    const result = run(['--expected-layout', expected, target]);
    expect(result.status, result.stderr).toBe(status);
    const receipt = JSON.parse(result.stdout);
    if (status) expect(receipt.errors).toEqual([{
      type: 'SCHEMA_ERROR', path: '/layout',
      message: '布局形态与本次确认不一致：预期 dashboard，实际 report'
    }]);
    else expect(receipt.errors).toEqual([]);
  });

  it('拒绝未知或缺失的确认形态参数', () => {
    expect(run(['--expected-layout', 'unknown', 'page.json']).status).toBe(2);
    expect(run(['--expected-layout']).status).toBe(2);
  });

  it('仓外安装递归校验嵌套目录，并拒绝跨目录同名页面', async () => {
    const directory = await mkdtemp(path.join(isolated, 'nested-pages-'));
    const document = JSON.parse(files.get('references/page-metadata/examples/inline-report.json')!);
    await mkdir(path.join(directory, 'business/report'), { recursive: true });
    await writeFile(path.join(directory, 'business/report', `${document.id}.json`), JSON.stringify(document));
    const result = run([directory]);
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout).ok).toBe(true);
    await writeFile(path.join(directory, `${document.id}.json`), JSON.stringify(document));
    const duplicate = run([directory]);
    expect(duplicate.status).toBe(2);
    expect(duplicate.stderr).toContain(`重复页面 ID ${document.id}`);
  });

  it('成型页面范式覆盖真实布局和全部嵌套组件，且仓外知识仅保留结构', async () => {
    for (const source of pagePatternSources) {
      const content = await readFile(pageFilesById('pages').get(source.pageId)!, 'utf8');
      const parsed = parsePage(JSON.parse(content));
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) continue;
      const pattern = JSON.parse(files.get(`references/page-patterns/${source.id}.json`)!);
      expect(pattern.source).toEqual({pageId: source.pageId, sha256: createHash('sha256').update(content).digest('hex')});
      expect(pattern.layout).toBe(source.layout);
      expect(pattern.sections.map((section: {columnTracks?: number[]}) => section.columnTracks))
        .toEqual(parsed.page.sections.map(section => section.columnTracks));
      // Generic object traversal is independent of the projection's container dispatch.
      const types: string[] = [];
      const visit = (value: unknown): void => {
        if (Array.isArray(value)) value.forEach(visit);
        else if (value && typeof value === 'object') {
          for (const [key, item] of Object.entries(value)) {
            expect(['rows', 'query', 'dataSources', 'data', 'href', 'queryField', 'title', 'label']).not.toContain(key);
            if (key === 'type' && typeof item === 'string') types.push(item);
            else visit(item);
          }
        }
      };
      visit(pattern.sections);
      expect(types).toEqual(flattenPageComponents(parsed.page).map(component => component.type));
    }
    const detail = JSON.parse(files.get('references/page-patterns/dashboard-detail.json')!);
    expect(detail.legacyHeader).toBe('content');
    for(const id of ['dashboard-map','dashboard-analysis','dashboard-list']) {
      const example=JSON.parse(files.get(`references/page-patterns/${id}.json`)!);
      expect(example.iocHeader).toMatchObject({hasIdentity:true,presentation:{layout:'inline',collapse:'overflow'}});
      expect(example.dashboardToolbar).toBeUndefined();
    }
    expect(detail.sections[0].components[0]).toMatchObject({type: 'reportHeader', variant: 'projectDetail'});
    expect(detail.layout).toBe('dashboard');
  });

  it('范式生成拒绝形态漂移、损坏页面与身份错配，且不复制自由文本', async () => {
    const source = pagePatternSources[5];
    const page = JSON.parse(await readFile(pageFilesById('pages').get(source.pageId)!, 'utf8'));
    page.sections[0].components[0].props.title = 'PRIVATE-CONTENT-MUST-STAY-IN-SOURCE';
    expect(JSON.stringify(pagePattern(source, JSON.stringify(page)))).not.toContain('PRIVATE-CONTENT');
    page.layout = 'dashboard';
    expect(() => pagePattern(source, JSON.stringify(page))).toThrow('identity/layout changed');
    page.layout = 'report';
    page.id = 'another-page';
    expect(() => pagePattern(source, JSON.stringify(page))).toThrow('identity/layout changed');
    delete page.sections;
    expect(() => pagePattern(source, JSON.stringify(page))).toThrow('Invalid pattern source');
  });

  it('查询标量容错可在仓外独立校验，结构和缺字段仍被拒绝', async () => {
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
    expect(run([target]).status).toBe(0);
    page.dataSources.samples.source.initial.rows[0]['容错样例'] = { invalid: true };
    await writeFile(target, JSON.stringify(page));
    expect(run([target]).status).toBe(1);
    page.dataSources.samples.source.initial.rows[0]['容错样例'] = '正常';
    delete page.dataSources.samples.source.initial.rows[0]['容错数值'];
    await writeFile(target, JSON.stringify(page));
    expect(run([target]).status).toBe(1);
  });

  it('仓外支持独立置顶槽，并拒绝将明细主槽作为汇总', async () => {
    const page = JSON.parse(files.get('references/page-metadata/examples/table-pinned-summary-page.json')!);
    const target = path.join(isolated, page.id + '.json');
    await writeFile(target, JSON.stringify(page));
    expect(run(['--expected-layout', 'dashboard', target]).status).toBe(0);
    page.sections[0].components[0].props.pinnedTop.data = 'main';
    await writeFile(target, JSON.stringify(page));
    expect(run([target]).status).toBe(1);
  });

  it('仓外支持 output_dims 现成计数作为度量，并拒绝旧版本及维度系列', async () => {
    const document = JSON.parse(files.get('references/page-metadata/examples/stored-count-measures.json')!);
    const target = path.join(isolated, `${document.id}.json`);
    await writeFile(target, JSON.stringify(document));
    expect(run(['--expected-layout', 'dashboard', target]).status).toBe(0);
    document.schemaVersion = '6.55';
    await writeFile(target, JSON.stringify(document));
    const old = run([target]);
    expect(old.status).toBe(1);
    expect(old.stdout).toContain('由 6.56 引入');
    document.schemaVersion = '6.56';
    document.sections[0].components[0].props.series[0].field = 'regionId';
    await writeFile(target, JSON.stringify(document));
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
    const folders = ['contracts/metriccanvas/page/conformance/valid', 'contracts/metriccanvas/page/conformance/invalid'];
    const batches = await Promise.all(folders.map(async prefix => {
      const names = (await readdir(prefix)).filter(name => name.endsWith('.json'));
      return Promise.all(names.map(async name => ({prefix, name, value: JSON.parse(await readFile(path.join(prefix,name),'utf8'))})));
    }));
    for (const {prefix, name, value} of batches.flat()) {
      const document = prefix.endsWith('/invalid') ? value.input : value;
      const fileName = `${document.id ?? 'invalid'}.json`;
      const parsed = parsePage(document);
      vectors.push({name, fileName, document, expected: parsed.ok ? fileNameErrors(fileName, parsed.page) : parsed.errors});
    }
    const data = path.join(isolated, 'vectors.json');
    await writeFile(data, JSON.stringify(vectors));
    const runner = path.join(isolated, 'verify.mjs');
    await writeFile(runner, `import {readFileSync} from 'node:fs';\nimport {inspectPageDocument} from './skill/scripts/validate-page.mjs';\nconst cases=JSON.parse(readFileSync(new URL('./vectors.json',import.meta.url),'utf8'));\nconsole.log(JSON.stringify(cases.map(c=>({name:c.name,errors:inspectPageDocument(c.fileName,c.document)}))));\n`);
    const result = spawnSync(process.execPath, [runner], {cwd: isolated, encoding:'utf8',timeout:20_000,env:{PATH:process.env.PATH}});
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(vectors.map(v=>({name:v.name,errors:v.expected})));
    expect(vectors.length).toBeGreaterThan(100);
    // The isolated process retains its 20s deadline; include collection/serialization in the host budget.
  }, 30_000);
});
