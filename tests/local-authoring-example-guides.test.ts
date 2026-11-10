import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildExampleGuides, declaredExampleGuidePages, exampleGuideText } from '../tools/scripts/local-authoring-example-guides';

function page(id: string, components = ['table']): string {
  return JSON.stringify({id, sections: [{id: 'main', components: components.map(id => ({id, type: 'table', props: {}}))}]});
}

function scenario(id: string, task = 'task'): string {
  return `## ${id}\n\n<!-- example-guide: task=${task}; page=${id}; components=table -->\n\n入口 /pages/${id}\n\n复用用途：格式显示。\n\n参考对象：组件 table。\n\n移植边界：保留查询与筛选。\n\n可观察预期与环境：点击筛选，再导出。\n\n第二步切换 Tab，状态保持。\n`;
}

function build(text: string, ids = ['first', 'second']) {
  return buildExampleGuides(new Map([['pages/demo/README.md', text]]), new Map(ids.map(id => [`examples/${id}.json`, page(id)])));
}

describe('README example guides', () => {
  it('预读发现仅返回显式页面身份并去重，沿用生成的语法与重复关联检查', () => {
    const text = '## 旧页\n/pages/unrelated\n' + scenario('first') + scenario('second') + scenario('first', 'other');
    const readmes = new Map([['pages/demo/README.md', text]]);
    expect(declaredExampleGuidePages(readmes)).toEqual(['first', 'second']);
    expect(() => declaredExampleGuidePages(new Map([['README.md', scenario('first').replace('components=table', 'unknown=value')]]))).toThrow('Unknown or duplicate');
    expect(() => declaredExampleGuidePages(new Map([['README.md', scenario('first').replace('components=table', 'page=first')]]))).toThrow('Unknown or duplicate');
    expect(() => declaredExampleGuidePages(new Map([['README.md', scenario('first') + scenario('first')]]))).toThrow('Duplicate example-guide association');
  });

  it('只提取显式关联，默认候选且不从校验通过推断验证层级', () => {
    const index = build('## 历史\n/pages/first 校验通过、浏览器成功。\n' + scenario('first'));
    const guide = index.byPageId.get('first')![0]!;
    expect(index.byPageId.size).toBe(1);
    expect(guide).toMatchObject({id: 'guide:first:task', route: '/pages/first', lifecycle: 'candidate', verified: [],
      verification: {basis: 'author-declared', current: 'not-assessed'}});
    expect(guide.fields.purpose).toMatchObject({status: 'provided', summary: '格式显示。'});
    const content = index.references.get(guide.content.file)!;
    expect(exampleGuideText(guide, 'expectations', content)).toBe('可观察预期与环境：点击筛选，再导出。\n\n第二步切换 Tab，状态保持。');
    expect(content).not.toContain('浏览器成功');
    expect(() => exampleGuideText(guide, 'expectations', content + 'changed')).toThrow('content mismatch');
  });

  it('同一大 README 局部编辑只改变对应页，不把其他章节灌入索引', () => {
    const before = build(scenario('first') + scenario('second'));
    const after = build(scenario('first').replace('格式显示。', '时间显示。') + scenario('second'));
    expect(after.byPageId.get('second')).toEqual(before.byPageId.get('second'));
    const guide = before.byPageId.get('second')![0]!;
    expect(after.references.get(guide.content.file)).toBe(before.references.get(guide.content.file));
    expect(after.byPageId.get('first')![0]!.content.sha256).not.toBe(before.byPageId.get('first')![0]!.content.sha256);
    expect(JSON.stringify(before.byPageId.get('second'))).not.toContain('first');
  });

  it('允许同页多个稳定任务与同节多页，各自身份唯一', () => {
    const shared = scenario('first').replace('入口 /pages/first', '<!-- example-guide: task=shared; page=second; components=table -->\n\n入口 /pages/first 和 /pages/second');
    const index = build(shared + scenario('first', 'other'));
    expect(index.byPageId.get('first')!.map(guide => guide.task)).toEqual(['task', 'other']);
    expect(index.byPageId.get('second')![0]!.id).toBe('guide:second:shared');
    expect(index.references.size).toBe(3);
  });

  it('缺项保留 not-provided，显式验证仅记录作者声明', () => {
    const text = '## 缺项\n<!-- example-guide: task=one; page=first; verified=structure,sim -->\n/pages/first\n\n复用用途：用途。\n';
    const guide = build(text).byPageId.get('first')![0]!;
    expect(guide.fields.references).toEqual({status: 'not-provided', summary: '', passages: []});
    expect(guide.verified).toEqual(['structure', 'sim']);
    expect(guide.verification.current).toBe('not-assessed');
  });

  it('代码围栏及行内标记样例不成为声明，围栏内标题不切断场景', () => {
    const sample = '## 写法示例\n```md\n<!-- example-guide: task=sample; page=missing -->\n### 示例标题\n~~~\n```\n\n行内 `<!-- example-guide: task=inline; page=missing -->`。\n';
    const index = build(sample + scenario('first'));
    expect([...index.byPageId.keys()]).toEqual(['first']);
    expect(index.byPageId.get('first')![0]!.task).toBe('task');
  });

  it('作者声明关联实际页面内容，页面变化也不冒充本轮验收', () => {
    const text = scenario('first');
    const before = build(text).byPageId.get('first')![0]!;
    const changed = page('first').replace('"props":{}', '"props":{"title":"changed"}');
    const after = buildExampleGuides(new Map([['pages/demo/README.md', text]]), new Map([['examples/first.json', changed]])).byPageId.get('first')![0]!;
    expect(after.source.pageSha256).not.toBe(before.source.pageSha256);
    expect(after.content).toEqual(before.content);
    expect(after.verification.current).toBe('not-assessed');
  });

  it('推荐要求完整角色、焦点与明确层级，且不隐含真实服务', () => {
    const complete = scenario('first').replace('components=table', 'components=table; lifecycle=recommended; verified=structure');
    expect(build(complete).byPageId.get('first')![0]!.verified).toEqual(['structure']);
    expect(() => build(complete.replace('移植边界：', '边界：'))).toThrow('Incomplete recommended');
    expect(() => build(complete.replace('; verified=structure', ''))).toThrow('Incomplete recommended');
  });

  it('分发局部副本把仓内链接与 localhost 入口保留为文字来源', () => {
    const input = scenario('first').replace('格式显示。', '[页面](first.json)、[入口](http://localhost:5173/pages/first)。');
    const index = build(input), guide = index.byPageId.get('first')![0]!;
    const content = index.references.get(guide.content.file)!;
    expect(content).toContain('页面（原入口：`first.json`）');
    expect(content).toContain('`http://localhost:5173/pages/first`');
    expect(content).not.toMatch(/\]\(/);
  });

  it.each([
    ['page=first', 'page=missing', 'Unknown example-guide page'],
    ['components=table', 'components=missing', 'Unknown example-guide component'],
    ['components=table', 'components=table,table', 'Invalid example-guide list'],
    ['components=table', 'lifecycle=unknown', 'Unknown example-guide lifecycle'],
    ['components=table', 'verified=validated', 'Unknown example-guide verified'],
    ['components=table', 'unrecognized=table', 'Unknown or duplicate'],
    ['components=table', 'page=first', 'Unknown or duplicate'],
    ['task=task', 'task=../bad', 'Invalid example-guide task'],
    ['/pages/first', '/pages/second', 'Missing example-guide route'],
    ['example-guide:', 'example-guide ', 'Malformed example-guide marker']
  ])('错误声明 %s → %s 阻断生成', (from, to, error) => {
    expect(() => build(scenario('first').replace(from, to))).toThrow(error);
  });

  it('重复关联、页面身份、歧义组件或缺标题均阻断生成', () => {
    expect(() => build(scenario('first') + scenario('first'))).toThrow('Duplicate example-guide association');
    const readmes = new Map([['README.md', scenario('first')]]);
    expect(() => buildExampleGuides(readmes, new Map([['a.json', page('first')], ['b.json', page('first')]]))).toThrow('Duplicate example-guide page');
    expect(() => buildExampleGuides(readmes, new Map([['a.json', page('first', ['table', 'table'])]]))).toThrow('Ambiguous example-guide component');
    expect(() => build(scenario('first').replace('## first\n', ''))).toThrow('requires a Markdown heading');
  });

  it('消费真实时间格式与枚举维护样板，保留操作、依赖与未验边界', () => {
    const ids = ['table-time-format', 'table-column-enums'];
    const readme = 'pages/capabilities/table/README.md';
    const pages = new Map(ids.map(id => [`examples/${id}.json`, readFileSync(`pages/capabilities/table/${id}.json`, 'utf8')]));
    const index = buildExampleGuides(new Map([[readme, readFileSync(readme, 'utf8')]]), pages);
    expect([...index.byPageId.keys()]).toEqual(['table-column-enums', 'table-time-format']);
    const time = index.byPageId.get('table-time-format')![0]!;
    const enums = index.byPageId.get('table-column-enums')![0]!;
    expect(time.components).toEqual(['times']);
    expect(enums.components).toEqual(['business-types']);
    expect(Object.values(time.fields).every(field => field.status === 'provided')).toBe(true);
    expect(time.fields.boundary.summary).toContain('保留查询、筛选、分页与导出关系');
    expect(enums.fields.expectations.summary).toContain('真实查询的下推行为另');
    expect(time.verified).toEqual([]);
    expect(index.references.get(time.content.file)).not.toContain('无行键子表');
  });
});
