import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseClassToken } from '../src/class-tokens';
import { ARTIFACT_VERSION, extractDesignFacts, sha256, stripVolatile } from '../src/extract';
import { scanElements } from '../src/html-scan';
import { formatJson } from '../src/format-json';
import { resolveUtility } from '../src/tailwind-theme';
import {
  DEFAULT_SOURCES,
  GENERATE_COMMAND,
  PACKAGE_NAME,
  REPO_ROOT,
  buildArtifact,
  outputPathFor,
  readCommitted,
  serialize,
  sourceExists
} from '../src/artifact-io';

const extractFixture = (html: string) =>
  extractDesignFacts({
    sourcePath: 'fixture.html',
    html,
    generatedAt: '2026-01-01T00:00:00.000Z',
    command: GENERATE_COMMAND,
    packageName: PACKAGE_NAME
  });

describe('类名 token 分层', () => {
  it('任意值写法解析出前缀与字面量', () => {
    expect(parseClassToken('w-[580px]')).toEqual({
      layer: 'literal',
      declaration: {
        raw: 'w-[580px]',
        form: 'arbitrary-value',
        property: 'w',
        value: '580px',
        shape: 'length',
        category: 'size',
        number: 580,
        unit: 'px'
      }
    });
  });

  it('任意属性写法解析出 CSS 属性名,`_` 还原为空格', () => {
    const parsed = parseClassToken('[border:1px_dashed_#dcdbdb]');
    expect(parsed).toMatchObject({
      layer: 'literal',
      declaration: {
        form: 'arbitrary-property',
        property: 'border',
        value: '1px dashed #dcdbdb',
        category: 'border'
      }
    });
  });

  it('url() 内的下划线保持原样,否则资源名会被改坏', () => {
    const parsed = parseClassToken('[background-image:url(&#39;assets/207_7820.svg&#39;)]');
    expect(parsed).toMatchObject({
      declaration: { value: "url('assets/207_7820.svg')", shape: 'url' }
    });
  });

  it('text- 按值形状区分字号与色值', () => {
    expect(parseClassToken('text-[14px]')).toMatchObject({ declaration: { category: 'fontSize' } });
    expect(parseClassToken('text-[#191919]')).toMatchObject({ declaration: { category: 'color' } });
  });

  it('没有字面量的 token 归计算层', () => {
    for (const token of ['flex', 'justify-between', 'w-full', 'whitespace-nowrap', 'm-0']) {
      expect(parseClassToken(token)).toEqual({ layer: 'computed', raw: token });
    }
  });

  it('残缺的任意属性写法登记为 malformed,不静默丢弃', () => {
    expect(parseClassToken('[font-family:')).toEqual({
      layer: 'malformed',
      raw: '[font-family:',
      reason: 'unterminated-arbitrary-property'
    });
  });
});

describe('文本盒标记', () => {
  const html =
    '<div data-node-id="1:1" data-node-name="卡片" class="w-[580px] h-[280px] flex justify-between">' +
    '<span data-node-id="1:2" data-node-name="text" class="w-[24px] h-[18px] text-[12px] leading-[18px] text-[#191919]">欧洲</span>' +
    '</div>';

  it('文本叶上的 w / h 打 fontMeasured,同节点的字号行高不打', () => {
    const artifact = extractFixture(html);
    const span = artifact.nodes.find((node) => node.tag === 'span')!;
    expect(span.textLeaf).toBe(true);
    expect(span.text).toBe('欧洲');
    const marked = span.literals.filter((literal) => literal.fontMeasured === true).map((l) => l.raw);
    expect(marked).toEqual(['w-[24px]', 'h-[18px]']);
    const unmarked = span.literals.filter((literal) => literal.fontMeasured === undefined).map((l) => l.raw);
    expect(unmarked).toEqual(['text-[12px]', 'leading-[18px]', 'text-[#191919]']);
  });

  it('非文本叶上的 w / h 不打标记', () => {
    const artifact = extractFixture(html);
    const card = artifact.nodes.find((node) => node.tag === 'div')!;
    expect(card.literals.every((literal) => literal.fontMeasured === undefined)).toBe(true);
    expect(card.computed).toEqual(['flex', 'justify-between']);
  });
});

describe('节点层级与引用', () => {
  it('父子路径按 data-node-name 可读,重名靠 namePath 消歧', () => {
    const artifact = extractFixture(
      '<div data-node-id="1:1" data-node-name="Tab 卡" class="w-[580px]">' +
        '<div data-node-id="1:2" data-node-name="row 1" class="flex">' +
        '<span data-node-id="1:3" data-node-name="text" class="w-[24px] h-[18px]">左</span>' +
        '<span data-node-id="1:4" data-node-name="text" class="w-[24px] h-[18px]">右</span>' +
        '</div></div>'
    );
    const right = artifact.nodes.find((node) => node.text === '右')!;
    expect(right.namePath).toEqual(['Tab 卡', 'row 1']);
    expect(right.path).toEqual(['1:1', '1:2']);
    expect(right.siblingIndex).toBe(1);
    expect(artifact.nodeNameIndex['text']).toEqual(['1:3', '1:4']);
  });

  it('不承载字面量的中间层被跳过后,层级不留空洞、siblingIndex 仍按保留树数', () => {
    const artifact = extractFixture(
      '<html><body class="bg-[#fff]"><nav><div data-node-id="1:1" data-node-name="左" class="w-[1px]"></div>' +
        '<div data-node-id="1:2" data-node-name="右" class="w-[2px]"></div></nav></body></html>'
    );
    expect(artifact.nodes.map((node) => node.ref)).toEqual(['@0', '1:1', '1:2']);
    const right = artifact.nodes.find((node) => node.ref === '1:2')!;
    expect(right.parentRef).toBe('@0');
    expect(right.path).toEqual(['@0']);
    expect(right.siblingIndex).toBe(1);
  });

  it('span 里夹了元素就不是文本叶', () => {
    const artifact = extractFixture(
      '<span data-node-id="1:1" data-node-name="t" class="w-[24px]">上<br/>下</span>'
    );
    const span = artifact.nodes[0]!;
    expect(span.textLeaf).toBeUndefined();
    expect(span.literals[0]!.fontMeasured).toBeUndefined();
  });

  it('属性值里的 `>` 不会把标签切断', () => {
    const elements = scanElements('<div class="[content:a>b]" data-node-id="1:1"><span>x</span></div>');
    expect(elements).toHaveLength(2);
    expect(elements[0]!.attributes['class']).toBe('[content:a>b]');
  });

  it('img / link 是 void 元素,不吞掉后续兄弟节点', () => {
    const elements = scanElements('<div><img src="a.png" /><link rel="preload" href="b.svg"/><span>x</span></div>');
    expect(elements.map((element) => element.tag)).toEqual(['div', 'img', 'link', 'span']);
    expect(elements.slice(1).every((element) => element.parentIndex === 0)).toBe(true);
  });
});

describe('Tailwind 默认值对照表', () => {
  it('字重解出 400 / 500,出处记到 theme key', () => {
    expect(resolveUtility('font-normal')).toEqual({
      resolved: true,
      declarations: { 'font-weight': '400' },
      origin: 'theme.fontWeight.normal'
    });
    expect(resolveUtility('font-medium')).toEqual({
      resolved: true,
      declarations: { 'font-weight': '500' },
      origin: 'theme.fontWeight.medium'
    });
  });

  it('由布局算法分配量的 utility 一律不解,并留下理由', () => {
    for (const token of [
      'flex',
      'flex-col',
      'justify-between',
      'items-start',
      'items-center',
      'block',
      'inline-block',
      'absolute',
      'relative'
    ]) {
      const resolution = resolveUtility(token);
      expect(resolution.resolved, token).toBe(false);
      expect(resolution).toMatchObject({ family: 'layout-allocation' });
      expect((resolution as { reason: string }).reason.length).toBeGreaterThan(0);
    }
  });

  it('表外的 utility 记成 unlisted 并计数,不猜值也不静默忽略', () => {
    expect(resolveUtility('font-bold')).toMatchObject({ resolved: false, family: 'unlisted' });

    const artifact = extractFixture(
      '<span data-node-id="1:1" data-node-name="t" class="font-bold tracking-wide">粗</span>'
    );
    expect(artifact.stats.unlistedUtilities).toBe(2);
    expect(artifact.themeResolution.unresolved['font-bold']).toMatchObject({ family: 'unlisted' });
    expect(artifact.themeResolution.byProperty['font-weight']).toBeUndefined();
  });

  it('解出来的值不进 literals', () => {
    const artifact = extractFixture(
      '<span data-node-id="1:1" data-node-name="t" class="font-medium text-[14px]">标题</span>'
    );
    const node = artifact.nodes[0]!;
    expect(node.literals.map((literal) => literal.raw)).toEqual(['text-[14px]']);
    expect(node.computed).toEqual(['font-medium']);
    expect(artifact.themeResolution.resolved['font-medium']).toMatchObject({
      occurrences: 1,
      declarations: { 'font-weight': '500' }
    });
    expect(artifact.themeResolution.byProperty['font-weight']).toEqual({ '500': 1 });
  });
});

describe('序列化', () => {
  it('全标量容器压成一行,结构层保持缩进', () => {
    const text = formatJson({ stats: { a: 1, b: 2 }, nodes: [{ ref: 'x', path: ['a', 'b'] }] });
    expect(text).toContain('"stats": { "a": 1, "b": 2 }');
    expect(text).toContain('"path": ["a", "b"]');
    expect(text.endsWith('}\n')).toBe(true);
  });

  it('产物往返 JSON.parse 不丢内容', () => {
    const artifact = extractFixture('<div data-node-id="1:1" data-node-name="a" class="w-[8px]"></div>');
    expect(JSON.parse(serialize(artifact))).toEqual(JSON.parse(JSON.stringify(artifact)));
  });
});

const committedArtifacts = DEFAULT_SOURCES.map((sourcePath) => ({
  sourcePath,
  artifact: readCommitted(sourcePath)
}));

describe('已入库产物的自洽性(不需要设计稿)', () => {
  /**
   * R3 要判的就是这条:设计稿的字重闭集只有 {400, 500}。实现里出现的 600 / 700
   * 在稿里零命中,这条断言把这个事实锁住——闭集变了必须是设计稿真的变了。
   */
  it('两份稿的字重闭集恰为 {400, 500},600 / 700 零命中', () => {
    const weights: Record<string, number> = {};
    for (const { artifact } of committedArtifacts) {
      for (const [value, count] of Object.entries(artifact!.themeResolution.byProperty['font-weight'] ?? {})) {
        weights[value] = (weights[value] ?? 0) + count;
      }
    }
    expect(Object.keys(weights).sort()).toEqual(['400', '500']);
    expect(weights).toEqual({ '400': 427, '500': 108 });
  });

  it('已归档的第三份稿不在抽取范围内', () => {
    expect(DEFAULT_SOURCES.some((path) => path.includes('archive-not-a-source'))).toBe(false);
    expect(DEFAULT_SOURCES.some((path) => path.includes('opportunity-lits'))).toBe(false);
  });

  for (const { sourcePath, artifact } of committedArtifacts) {
    describe(sourcePath, () => {
      it('产物存在', () => {
        expect(artifact, `缺少 ${outputPathFor(sourcePath)},跑 ${GENERATE_COMMAND} 生成`).not.toBeNull();
      });

      it('结构版本与当前抽取器一致(抽取器改了但产物没重生成会在这里失败)', () => {
        expect(artifact!.artifactVersion).toBe(ARTIFACT_VERSION);
      });

      it('stats 与 nodes 逐项对得上', () => {
        const nodes = artifact!.nodes;
        const stats = artifact!.stats;
        expect(stats.nodes).toBe(nodes.length);
        expect(stats.namedNodes).toBe(nodes.filter((node) => node.nodeName !== null).length);
        expect(stats.textLeaves).toBe(nodes.filter((node) => node.textLeaf === true).length);
        expect(stats.literals).toBe(nodes.reduce((sum, node) => sum + node.literals.length, 0));
        expect(stats.computed).toBe(nodes.reduce((sum, node) => sum + node.computed.length, 0));
        expect(stats.malformed).toBe(artifact!.parseWarnings.length);
        expect(stats.classTokens).toBe(stats.literals + stats.computed + stats.malformed);
        expect(stats.fontMeasured).toBe(
          nodes.reduce(
            (sum, node) => sum + node.literals.filter((literal) => literal.fontMeasured === true).length,
            0
          )
        );
        expect(stats.distinctNodeNames).toBe(Object.keys(artifact!.nodeNameIndex).length);
      });

      it('classRaw 仍能还原出全部 token(原始类名没有被解析结果替换掉)', () => {
        for (const node of artifact!.nodes) {
          const tokens = node.classRaw.split(/\s+/).filter((token) => token.length > 0);
          const parsed = [
            ...node.literals.map((literal) => literal.raw),
            ...node.computed,
            ...artifact!.parseWarnings.filter((warning) => warning.nodeRef === node.ref).map((w) => w.token)
          ];
          expect(new Set(parsed)).toEqual(new Set(tokens));
        }
      });

      it('ref 唯一,parentRef 与 path 都能解析到已有节点', () => {
        const refs = new Set(artifact!.nodes.map((node) => node.ref));
        expect(refs.size).toBe(artifact!.nodes.length);
        for (const node of artifact!.nodes) {
          expect(node.path).toHaveLength(node.depth);
          expect(node.namePath).toHaveLength(node.depth);
          if (node.parentRef !== null) expect(refs.has(node.parentRef)).toBe(true);
          for (const ancestor of node.path) expect(refs.has(ancestor)).toBe(true);
        }
      });

      it('nodeNameIndex 与节点上的 nodeName 互为反查', () => {
        for (const node of artifact!.nodes) {
          if (node.nodeName === null) continue;
          expect(artifact!.nodeNameIndex[node.nodeName]).toContain(node.ref);
        }
      });

      it('对照表覆盖稿里出现的每个计算层 utility,没有漏网的', () => {
        const { resolved, unresolved } = artifact!.themeResolution;
        expect(new Set([...Object.keys(resolved), ...Object.keys(unresolved)])).toEqual(
          new Set(Object.keys(artifact!.stats.computedByToken))
        );
        expect(
          artifact!.stats.unlistedUtilities,
          '稿里出现了对照表未收录的 utility,先去 tailwind-theme.ts 核过再加'
        ).toBe(0);
      });

      it('themeResolved + themeUnresolved 等于计算层总数,byProperty 与 resolved 对得上', () => {
        const stats = artifact!.stats;
        expect(stats.themeResolved + stats.themeUnresolved).toBe(stats.computed);

        const expected: Record<string, Record<string, number>> = {};
        for (const entry of Object.values(artifact!.themeResolution.resolved)) {
          for (const [property, value] of Object.entries(entry.declarations)) {
            const values = (expected[property] ??= {});
            values[value] = (values[value] ?? 0) + entry.occurrences;
          }
        }
        expect(artifact!.themeResolution.byProperty).toEqual(expected);
      });

      it('literals 里全是任意值 / 任意属性写法,主题解出的值没有混进来', () => {
        for (const node of artifact!.nodes) {
          for (const literal of node.literals) {
            expect(literal.raw, `${node.ref} 的 ${literal.raw} 不是任意值写法`).toContain('[');
          }
        }
      });

      it('fontMeasured 只出现在文本叶的 w / h 上', () => {
        for (const node of artifact!.nodes) {
          for (const literal of node.literals) {
            if (literal.fontMeasured !== true) continue;
            expect(node.textLeaf).toBe(true);
            expect(['w', 'h']).toContain(literal.property);
          }
        }
      });
    });
  }
});

/**
 * 设计稿在 `参考/` 下、已被 gitignore,clone 下来的机器上没有,所以这组按存在性跳过。
 * 跳过时上一组的自洽性与版本断言仍然生效。
 */
const sourcesPresent = DEFAULT_SOURCES.every(sourceExists);
const describeAgainstSource = sourcesPresent ? describe : describe.skip;

describeAgainstSource('产物与设计稿一致(需要 参考/ 在本机)', () => {
  for (const sourcePath of DEFAULT_SOURCES) {
    describe(sourcePath, () => {
      it('内容哈希与设计稿现状一致', () => {
        const committed = readCommitted(sourcePath)!;
        expect(
          sha256(readFileSync(join(REPO_ROOT, sourcePath))),
          `设计稿已变更而产物未重新生成,跑 ${GENERATE_COMMAND}`
        ).toBe(committed.source.sha256);
      });

      it('重跑抽取得到逐字节相同的产物(生成时间除外)', () => {
        const committed = readCommitted(sourcePath)!;
        const fresh = buildArtifact(sourcePath, committed.generator.generatedAt);
        expect(stripVolatile(fresh), `跑 ${GENERATE_COMMAND} 重新生成`).toEqual(stripVolatile(committed));
      });
    });
  }
});
