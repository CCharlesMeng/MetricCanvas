import {
  componentCatalog,
  componentCatalogEntry,
  type ComponentCatalogEntry
} from '@metriccanvas/page';

/**
 * 自动可视化（创作期）：以组件能力目录 `componentCatalog` 为唯一硬闸来源，
 * 由取数单元真实执行后的结果形状推荐组件。硬闸不满足者一律 `ok: false`
 * 并携带原因；允许范围内按分析意图排序，首位标为推荐（ADR-0037）。
 * 纯函数：不依赖浏览器、不依赖统一运行时、不做 IO。
 */

/**
 * 结果形状：取数单元的结果字段契约与真实执行结果所能证明的结构事实。
 * 只承载字段角色计数与行数，不携带字段语义——语义不得从样例值推断。
 */
export interface ResultShape {
  /** 结果字段契约中 role 为 dimension 的标量字段数 */
  dimensionCount: number;
  /** 结果字段契约中 role 为 measure 的标量字段数 */
  measureCount: number;
  /** 真实执行得到的行数；未经真实执行证明时不填 */
  rowCount?: number;
  /** 维度字段中是否存在 date/datetime 类型（时间维度） */
  hasTimeDimension: boolean;
}

/** 分析意图的闭集；意图只影响允许范围内的排序，不放宽硬闸。 */
export const analysisIntents = [
  'trend',
  'comparison',
  'proportion',
  'ranking',
  'detail',
  'summary'
] as const;

export type AnalysisIntent = (typeof analysisIntents)[number];

export interface RecommendComponentsOptions {
  /** 分析意图；缺省时按硬闸结果与时间维度亲和度排序 */
  intent?: AnalysisIntent;
  /**
   * 用户显式钉住的组件。钉住的组件不得被自动改写：硬闸通过时它必为
   * 推荐首位；硬闸不通过时不把推荐让给其他组件（由调用方决定如何处置）。
   */
  pinned?: ComponentCatalogEntry['type'];
}

/** 一个组件候选：能力事实全部来自 componentCatalog 对应条目。 */
export interface ComponentCandidate {
  type: ComponentCatalogEntry['type'];
  label: string;
  /** 组件能力目录建议的默认宽度（12 列 Grid 跨度） */
  defaultSpan: number;
  /** 硬闸是否满足 */
  ok: boolean;
  /** 是否为用户显式钉住的组件 */
  pinned: boolean;
  /** 是否为本次推荐首位；ok 为 false 时恒为 false */
  recommended: boolean;
  /** 硬闸不满足的原因；ok 为 true 时为空数组 */
  reasons: string[];
}

/**
 * 意图与目录 chooseWhen/purpose 文本的对应关键词。亲和度由目录文本命中
 * 关键词得出，不在这里手写「意图 → 组件」的第二份清单。
 */
const intentKeywords: Record<AnalysisIntent, readonly string[]> = {
  trend: ['趋势'],
  comparison: ['对比'],
  proportion: ['占比'],
  ranking: ['排行'],
  detail: ['明细'],
  summary: ['核心指标', 'KPI']
};

/**
 * 由结果形状与分析意图输出排序后的组件候选。候选集恒等于
 * componentCatalog 全集：硬闸通过者按意图排序在前（首位标为推荐），
 * 硬闸不满足者一律 `ok: false` 且按目录顺序附在其后。
 */
export function recommendComponents(
  shape: ResultShape,
  options: RecommendComponentsOptions = {}
): ComponentCandidate[] {
  if (options.pinned !== undefined) {
    componentCatalogEntry(options.pinned);
  }

  const evaluated = componentCatalog.map((entry) => ({
    entry,
    candidate: evaluateCandidate(entry, shape, options.pinned)
  }));

  const allowed = evaluated.filter(({ candidate }) => candidate.ok);
  const rejected = evaluated.filter(({ candidate }) => !candidate.ok);

  const scored = allowed
    .map((item, catalogOrder) => ({
      ...item,
      catalogOrder,
      score: candidateScore(item.entry, item.candidate, shape, options.intent)
    }))
    .sort((a, b) => b.score - a.score || a.catalogOrder - b.catalogOrder);

  // 钉住的组件硬闸不通过时，不把推荐让给其他组件（不得自动改写钉住选择）。
  const pinnedBlocked =
    options.pinned !== undefined &&
    !allowed.some(({ candidate }) => candidate.pinned);
  const recommendedType =
    pinnedBlocked || scored.length === 0 ? undefined : scored[0]?.candidate.type;

  return [...scored, ...rejected].map(({ candidate }) => ({
    ...candidate,
    recommended: candidate.type === recommendedType
  }));
}

function evaluateCandidate(
  entry: ComponentCatalogEntry,
  shape: ResultShape,
  pinned: ComponentCatalogEntry['type'] | undefined
): ComponentCandidate {
  const reasons = hardGateReasons(entry, shape);
  return {
    type: entry.type,
    label: entry.label,
    defaultSpan: entry.defaultSpan,
    ok: reasons.length === 0,
    pinned: entry.type === pinned,
    recommended: false,
    reasons
  };
}

/** 硬闸：目录条目的 dataShape 机器判读 + 必填 props 可自动补齐性。 */
function hardGateReasons(entry: ComponentCatalogEntry, shape: ResultShape): string[] {
  const reading = entry.authoringShape;
  if (!reading.bindsData) {
    return [`数据形状「${entry.dataShape}」不消费页面数据源，不能承载取数单元结果`];
  }

  const reasons: string[] = [];
  for (const semantic of reading.requiresFieldSemantics ?? []) {
    reasons.push(
      `数据形状「${entry.dataShape}」要求「${semantic}」语义，` +
        '结果形状不携带字段语义，且不得从样例值推断'
    );
  }
  if (reading.dimensions !== undefined) {
    const { min, max } = reading.dimensions;
    if (shape.dimensionCount < min || (max !== undefined && shape.dimensionCount > max)) {
      reasons.push(
        `数据形状「${entry.dataShape}」不满足：结果形状含 ${shape.dimensionCount} 个维度字段，` +
          `要求 ${max === undefined ? `至少 ${min}` : min === max ? `恰好 ${min}` : `${min}–${max}`} 个`
      );
    }
  }
  if (reading.measures !== undefined) {
    const { min, max } = reading.measures;
    if (shape.measureCount < min || (max !== undefined && shape.measureCount > max)) {
      reasons.push(
        `数据形状「${entry.dataShape}」不满足：结果形状含 ${shape.measureCount} 个度量字段，` +
          `要求 ${max === undefined ? `至少 ${min}` : min === max ? `恰好 ${min}` : `${min}–${max}`} 个`
      );
    }
  }
  if (
    reading.minScalarFields !== undefined &&
    shape.dimensionCount + shape.measureCount < reading.minScalarFields
  ) {
    reasons.push(
      `数据形状「${entry.dataShape}」不满足：结果形状不含任何 dimension/measure 标量字段`
    );
  }
  if (reading.maxRows !== undefined) {
    if (shape.rowCount === undefined) {
      reasons.push(`行数未经真实执行证明，无法满足数据形状「${entry.dataShape}」的行数约束`);
    } else if (shape.rowCount > reading.maxRows) {
      reasons.push(
        `数据形状「${entry.dataShape}」不满足：结果有 ${shape.rowCount} 行，` +
          `机器判读上限为 ${reading.maxRows} 行`
      );
    }
  }
  reasons.push(...unfillableRequiredProps(entry).map(
    (prop) => `必填 props「${prop}」无法由结果字段契约自动补齐`
  ));
  return reasons;
}

/**
 * 目录 requiredProps 的可补齐性判读：以 field/Field 结尾的路径是字段绑定，
 * 可由结果字段契约补齐；label/title 可由字段 label 或组件标题补齐；
 * 其余必填 props（如 mapChart 的 map）无法自动推导，构成硬闸拒绝原因。
 */
function unfillableRequiredProps(entry: ComponentCatalogEntry): string[] {
  return entry.requiredProps.filter((path) => {
    const leaf = path.split('.').at(-1) ?? path;
    return !(/field$/iu.test(leaf) || leaf === 'label' || leaf === 'title');
  });
}

function candidateScore(
  entry: ComponentCatalogEntry,
  candidate: ComponentCandidate,
  shape: ResultShape,
  intent: AnalysisIntent | undefined
): number {
  let score = 0;
  if (candidate.pinned) score += 100;
  if (intent !== undefined) {
    const catalogText = [entry.purpose, ...entry.chooseWhen].join('；');
    if (intentKeywords[intent].some((keyword) => catalogText.includes(keyword))) {
      score += 10;
    }
  }
  // 目录 dataShape 声明时间横轴能力（date/datetime）且结果确有时间维度时加亲和度。
  if (shape.hasTimeDimension && /date/iu.test(entry.dataShape)) score += 1;
  return score;
}
