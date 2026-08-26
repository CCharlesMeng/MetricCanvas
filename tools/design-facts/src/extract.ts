/**
 * 从 Figma 导出的设计稿 HTML 里抽出可静态读取的字面量,产出一份可入库的取证 JSON。
 *
 * 为什么要落盘:`参考/` 被 gitignore,不随仓交付,而 sdd 仓外 baseline 的 `PATTERN-STYLE-4`
 * 要求 `design_fact_source` 三件齐全(哪个文件、哪个 `data-node-name` 节点、哪个类名),
 * 一条 `rg` 能复现。别人 clone 下来手里没有设计稿,这条指路就是空的。落盘的是抽出来的
 * 字面量,不是整份设计稿。
 *
 * 边界:只抽,不判。JSON 里不出现"这个应该是环形图"这类推断。
 */

import { createHash } from 'node:crypto';
import { decodeEntities, scanElements, type ScannedElement } from './html-scan';
import {
  parseClassToken,
  splitClassAttribute,
  type LiteralDeclaration,
  type ParsedToken
} from './class-tokens';
import { TAILWIND_BASIS, resolveUtility } from './tailwind-theme';

/**
 * 产物结构版本。改了抽取语义就要 +1,并重跑生成。
 * 校验会比对它与已入库 JSON 的一致性,所以即使拿不到设计稿也能发现"抽取器变了、产物没重生成"。
 */
export const ARTIFACT_VERSION = '1.1.0';

export type DesignFactNode = {
  /** 文件内唯一引用键:有 `data-node-id` 时用它,否则用文档序 `@n`(此类节点不可作 `design_fact_source`) */
  ref: string;
  /** `data-node-name`,PATTARN-STYLE-4 要求的节点锚点;没有该属性时为 null */
  nodeName: string | null;
  /** `data-node-id` 原值 */
  nodeId: string | null;
  tag: string;
  /** 从根到父的 ref 链,用于"Tab 卡右上角那个"这类定位 */
  path: string[];
  /** 与 path 等长的 `data-node-name` 链,未命名节点为 null */
  namePath: (string | null)[];
  parentRef: string | null;
  /** 在同父元素子节点中的序号,从 0 起 */
  siblingIndex: number;
  depth: number;
  /** `class` 属性的原样值。保留它是因为它才是可 `rg` 复现的那一环 */
  classRaw: string;
  /** 字面量层:值写在类名里 */
  literals: LiteralDeclaration[];
  /** 计算层:类名里没有值,实际量由布局算法或 Tailwind 主题决定。只留原样 token */
  computed: string[];
  /** 文本叶(tag 为 span、有直接文本、无元素子节点)才有 */
  text?: string;
  textLeaf?: true;
  /** `img@src` / `[background-image:url(...)]` 引用到的资源路径 */
  assetRefs?: string[];
};

/**
 * 计算层 utility 按 Tailwind 默认主题解出来的值。
 *
 * 这些值**不是设计稿里读到的**,所以单列在这里,不进 `nodes[].literals`。
 * 按节点查:拿 `nodes[].computed` 里的 token 到 `resolved` / `unresolved` 里查即得。
 */
export type ThemeResolution = {
  basis: typeof TAILWIND_BASIS;
  resolved: Record<
    string,
    { occurrences: number; declarations: Record<string, string>; origin: string }
  >;
  unresolved: Record<string, { occurrences: number; family: string; reason: string }>;
  /** 已解声明的取值闭集:CSS 属性 → 值 → 出现次数。R3 那类"闭集只有 400/500"的判据直接读这里 */
  byProperty: Record<string, Record<string, number>>;
};

export type ParseWarning = {
  code: string;
  /** 出问题的 token 原样 */
  token: string;
  nodeRef: string;
  /** 开标签的源文本原样切片,让被截断的字面量在 JSON 里仍然可读 */
  tagSource: string;
};

export type DesignFactArtifact = {
  artifact: 'design-facts';
  artifactVersion: string;
  generator: {
    package: string;
    command: string;
    generatedAt: string;
  };
  source: {
    path: string;
    bytes: number;
    sha256: string;
  };
  reading: Record<string, string>;
  stats: {
    nodes: number;
    namedNodes: number;
    distinctNodeNames: number;
    textLeaves: number;
    classTokens: number;
    literals: number;
    computed: number;
    malformed: number;
    fontMeasured: number;
    /** 计算层 token 中,能按 Tailwind 默认主题解出值的出现次数 */
    themeResolved: number;
    themeUnresolved: number;
    /** 出现在稿里但对照表未收录的 utility 出现次数。测试断言为 0,防止新 utility 被静默忽略 */
    unlistedUtilities: number;
    literalsByForm: Record<string, number>;
    literalsByCategory: Record<string, number>;
    literalsByProperty: Record<string, number>;
    computedByToken: Record<string, number>;
  };
  themeResolution: ThemeResolution;
  /** 稿内引用到的资源路径。该目录整体不存在,任何依赖图形本身的结论都没有来源 */
  assetReferences: {
    total: number;
    distinct: number;
    paths: string[];
  };
  parseWarnings: ParseWarning[];
  /** nodeName → ref[]。名字不唯一(如 `text` 出现数百次),所以是数组 */
  nodeNameIndex: Record<string, string[]>;
  nodes: DesignFactNode[];
};

const READING_NOTES: Record<string, string> = {
  layer:
    '分层判据只有一条,且是机械的:值有没有写在类名里。写了进 literals,没写进 computed。computed 里的 token(flex / justify-between / w-full 等)是「读不到具体值」的标记,不是值本身。其中一部分能按 Tailwind 默认主题解出定值(如 font-normal 是 400),那些解在 themeResolution 里单列——那是 Tailwind 的值,不是设计稿的值,所以不在 literals 里。',
  'literals[].raw':
    '源文件 token 的原样切片,HTML 实体未解码。这是可 rg 复现的那一环;要复现就检索它,不要检索 value。',
  'literals[].value':
    '解码后的 CSS 值:HTML 实体已还原,Tailwind 的 `_` 已还原为空格(url() 内部除外,否则资源名会被改坏)。',
  'literals[].category':
    'form 为 arbitrary-value 时是归并桶(size/position/color/fontSize/lineHeight/radius/opacity/background/other);form 为 arbitrary-property 时等于 CSS 属性名本身,不再归并。要按属性精确统计请用 stats.literalsByProperty。',
  fontMeasured:
    '标在文本叶节点(tag 为 span、有直接文本、无元素子节点)的 w / h 字面量上。Figma 给每个文本 span 都写了这串字在设计稿字体栈(HarmonyOS Sans SC)下的实测盒宽高——它是测量结果,不是排版意图,运行时字体不同就永远对不上。消费方应把它过滤掉;同一节点上的 text-[Npx] 与 leading-[Npx] 是排版设置,不带此标记,可以照用。',
  citation:
    'PATTERN-STYLE-4 的 design_fact_source 三件套 = source.path + nodes[].nodeName + literals[].raw。nodeName 为 null 的节点(body 与三层画布外壳)没有锚点,不能作来源;nodeName 重名时(text / row 1 / graph 等)用 nodeId 或 namePath 消歧。',
  'missing assets':
    '稿内引用的 assets/ 目录整体不存在,assetReferences 里的路径无一命中。任何依赖图形本身的结论(图标形状、地图底图、分隔线画法、装饰件)都没有来源,只登记引用,不做还原。',
  'not extracted':
    '设计稿有 0 个 <style> 块、0 张外链样式表、0 个 style= 属性,CSS 规则确为 0,全部规则由 Tailwind CDN 在运行时生成。因此本产物只覆盖类名里的字面量。',
  themeResolution:
    '计算层 utility 按 Tailwind 默认主题解出来的值,单列在 themeResolution,**不是设计稿里读到的**——所以它不在 literals 里,别把两者混为一谈。按节点查:拿 nodes[].computed 里的 token 到 themeResolution.resolved / unresolved 里查。只解取值固定、且该值就是要比的那个量的 utility;凡是由布局算法分配尺寸与间距的(flex / flex-col / justify-between / items-* / block / inline-block / absolute / relative)一律不解,留在计算层,理由逐条记在 unresolved[].reason。themeResolution.byProperty 给出已解声明的取值闭集与次数。',
  staleness:
    '过期检测比对 source.sha256(设计稿原始字节的 sha256)与 artifactVersion(抽取语义版本)。设计稿变了、或抽取器语义变了而产物没重生成,pnpm design:facts:check 与 tools/design-facts 的测试都会失败;设计稿不在本机时哈希那条跳过,版本那条仍然生效。',
  'children reconstruction':
    '产物只存向上的 parentRef / path,不存 children。子节点按 parentRef 反查即得,nodes 保持文档序,同父节点的 siblingIndex 即为原始顺序。'
};

function sha256(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function bump(counter: Record<string, number>, key: string): void {
  counter[key] = (counter[key] ?? 0) + 1;
}

/** 只留有 class 或有 data-node-id 的元素:preload link、meta、title、script 不承载任何字面量 */
function isFactBearing(element: ScannedElement): boolean {
  return 'class' in element.attributes || 'data-node-id' in element.attributes;
}

export type ExtractInput = {
  /** 仓库相对的 POSIX 路径,写进产物 */
  sourcePath: string;
  html: string;
  /** 用于哈希的原始字节;缺省则用 html 的 utf8 编码 */
  bytes?: Buffer;
  generatedAt: string;
  command: string;
  packageName: string;
};

export function extractDesignFacts(input: ExtractInput): DesignFactArtifact {
  const elements = scanElements(input.html);
  const retained = elements.filter(isFactBearing);
  const retainedSet = new Set(retained.map((element) => element.index));

  const refByIndex = new Map<number, string>();
  const nameByIndex = new Map<number, string | null>();
  for (const [order, element] of retained.entries()) {
    const nodeId = element.attributes['data-node-id'] ?? null;
    refByIndex.set(element.index, nodeId ?? `@${order}`);
    nameByIndex.set(element.index, element.attributes['data-node-name'] ?? null);
  }

  /** 最近的一个被保留的祖先。被丢掉的元素(html/head/preload link)不该在层级里留空洞 */
  const nearestRetainedAncestor = (element: ScannedElement): number | null => {
    let cursor = element.parentIndex;
    while (cursor !== null && !retainedSet.has(cursor)) cursor = elements[cursor]!.parentIndex;
    return cursor;
  };

  /** 保留树上的父 → 子表。siblingIndex 要按这张表数,否则跨过被丢掉的中间层就数不到 */
  const parentByIndex = new Map<number, number | null>();
  const retainedChildren = new Map<number | null, number[]>();
  for (const element of retained) {
    const parentIndex = nearestRetainedAncestor(element);
    parentByIndex.set(element.index, parentIndex);
    const siblings = retainedChildren.get(parentIndex);
    if (siblings === undefined) retainedChildren.set(parentIndex, [element.index]);
    else siblings.push(element.index);
  }

  const stats: DesignFactArtifact['stats'] = {
    nodes: 0,
    namedNodes: 0,
    distinctNodeNames: 0,
    textLeaves: 0,
    classTokens: 0,
    literals: 0,
    computed: 0,
    malformed: 0,
    fontMeasured: 0,
    themeResolved: 0,
    themeUnresolved: 0,
    unlistedUtilities: 0,
    literalsByForm: {},
    literalsByCategory: {},
    literalsByProperty: {},
    computedByToken: {}
  };
  const parseWarnings: ParseWarning[] = [];
  const nodeNameIndex: Record<string, string[]> = {};
  const assetRefTotals: string[] = [];
  const nodes: DesignFactNode[] = [];

  for (const element of retained) {
    const ref = refByIndex.get(element.index)!;
    const parentIndex = parentByIndex.get(element.index)!;

    const path: string[] = [];
    const namePath: (string | null)[] = [];
    for (let cursor = parentIndex; cursor !== null; cursor = parentByIndex.get(cursor)!) {
      path.unshift(refByIndex.get(cursor)!);
      namePath.unshift(nameByIndex.get(cursor)!);
    }

    const decodedText = decodeEntities(element.rawText).trim();
    // 判"无元素子节点"用扫描器原始的子节点表,不用保留树:span 里夹一个 <br>
    // 也说明文本不是该节点的全部内容,不该算文本叶
    const textLeaf =
      element.tag === 'span' && element.childIndexes.length === 0 && decodedText.length > 0;

    const classRaw = element.attributes['class'] ?? '';
    const tokens = splitClassAttribute(classRaw);
    const literals: LiteralDeclaration[] = [];
    const computed: string[] = [];
    const assetRefs: string[] = [];

    for (const token of tokens) {
      stats.classTokens += 1;
      const parsed: ParsedToken = parseClassToken(token);
      if (parsed.layer === 'literal') {
        const declaration = parsed.declaration;
        if (textLeaf && (declaration.property === 'w' || declaration.property === 'h')) {
          declaration.fontMeasured = true;
          stats.fontMeasured += 1;
        }
        literals.push(declaration);
        stats.literals += 1;
        bump(stats.literalsByForm, declaration.form);
        bump(stats.literalsByCategory, declaration.category);
        bump(stats.literalsByProperty, declaration.property);
        const url = /url\((['"]?)([^'")]+)\1\)/.exec(declaration.value);
        if (url !== null) assetRefs.push(url[2]!);
        continue;
      }
      if (parsed.layer === 'computed') {
        computed.push(parsed.raw);
        stats.computed += 1;
        bump(stats.computedByToken, parsed.raw);
        continue;
      }
      stats.malformed += 1;
      parseWarnings.push({
        code: parsed.reason,
        token: parsed.raw,
        nodeRef: ref,
        tagSource: element.openTagSource
      });
    }

    const src = element.attributes['src'];
    if (src !== undefined && !/^[a-z]+:/i.test(src)) assetRefs.push(src);

    const nodeName = nameByIndex.get(element.index)!;
    if (nodeName !== null) {
      stats.namedNodes += 1;
      (nodeNameIndex[nodeName] ??= []).push(ref);
    }
    if (textLeaf) stats.textLeaves += 1;
    assetRefTotals.push(...assetRefs);
    stats.nodes += 1;

    nodes.push({
      ref,
      nodeName,
      nodeId: element.attributes['data-node-id'] ?? null,
      tag: element.tag,
      path,
      namePath,
      parentRef: parentIndex === null ? null : refByIndex.get(parentIndex)!,
      siblingIndex: (retainedChildren.get(parentIndex) ?? []).indexOf(element.index),
      depth: path.length,
      classRaw,
      literals,
      computed,
      ...(textLeaf ? { text: decodedText, textLeaf: true as const } : {}),
      ...(assetRefs.length > 0 ? { assetRefs } : {})
    });
  }

  stats.distinctNodeNames = Object.keys(nodeNameIndex).length;

  // 计算层 token 逐个查对照表。表是按 utility 聚合的,不下发到节点上——
  // 值不是节点的属性,是 utility + 主题的属性,分开放才不会被读成稿里的字面量。
  const themeResolution: ThemeResolution = {
    basis: TAILWIND_BASIS,
    resolved: {},
    unresolved: {},
    byProperty: {}
  };
  for (const [token, occurrences] of Object.entries(stats.computedByToken)) {
    const resolution = resolveUtility(token);
    if (resolution.resolved) {
      themeResolution.resolved[token] = {
        occurrences,
        declarations: resolution.declarations,
        origin: resolution.origin
      };
      stats.themeResolved += occurrences;
      for (const [property, value] of Object.entries(resolution.declarations)) {
        const values = (themeResolution.byProperty[property] ??= {});
        values[value] = (values[value] ?? 0) + occurrences;
      }
      continue;
    }
    themeResolution.unresolved[token] = {
      occurrences,
      family: resolution.family,
      reason: resolution.reason
    };
    stats.themeUnresolved += occurrences;
    if (resolution.family === 'unlisted') stats.unlistedUtilities += occurrences;
  }

  // preload link 的 href 也是资源引用,虽然那些 link 不承载字面量
  for (const element of elements) {
    if (element.tag !== 'link') continue;
    const href = element.attributes['href'];
    if (href !== undefined && !/^[a-z]+:/i.test(href)) assetRefTotals.push(href);
  }

  return {
    artifact: 'design-facts',
    artifactVersion: ARTIFACT_VERSION,
    generator: {
      package: input.packageName,
      command: input.command,
      generatedAt: input.generatedAt
    },
    source: {
      path: input.sourcePath,
      bytes: (input.bytes ?? Buffer.from(input.html, 'utf8')).length,
      sha256: sha256(input.bytes ?? Buffer.from(input.html, 'utf8'))
    },
    reading: READING_NOTES,
    stats,
    themeResolution,
    assetReferences: {
      total: assetRefTotals.length,
      distinct: new Set(assetRefTotals).size,
      paths: [...new Set(assetRefTotals)].sort()
    },
    parseWarnings,
    nodeNameIndex,
    nodes
  };
}

/** 忽略 generatedAt 的等价比较:设计稿没变时重跑不应产生 diff */
export function stripVolatile(artifact: DesignFactArtifact): unknown {
  const { generator, ...rest } = artifact;
  const { generatedAt: _generatedAt, ...stableGenerator } = generator;
  return { ...rest, generator: stableGenerator };
}

export { sha256 };
