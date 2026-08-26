/**
 * 类名 token 的分层与解析。
 *
 * 分层判据只有一条,且是机械的:**值本身有没有写在 token 里**。
 * - 写了 → `literal`。两种写法:任意值 `<前缀>-[<值>]` 与任意属性 `[<属性>:<值>]`。
 * - 没写 → `computed`。`flex` / `justify-between` / `w-full` 这类,实际值要么由布局算法
 *   在运行时分配,要么来自 Tailwind 主题表,不在设计稿文件里。
 *
 * 这里不判断某个值"应该"是什么(是不是环形图、该不该用),只把字面量原样取出并归类。
 */

import { decodeEntities } from './html-scan';

export type ClassLayer = 'literal' | 'computed';

export type ArbitraryForm = 'arbitrary-value' | 'arbitrary-property';

export type ValueShape =
  | 'length'
  | 'percentage'
  | 'number'
  | 'color'
  | 'url'
  | 'gradient'
  | 'function'
  | 'list'
  | 'keyword';

export type LiteralDeclaration = {
  /** 源文件里的 token 原样切片,实体未解码——这是可 `rg` 复现的那一环,不要改写 */
  raw: string;
  form: ArbitraryForm;
  /**
   * `arbitrary-value` 时为 Tailwind 前缀(`w` / `left` / `leading`);
   * `arbitrary-property` 时为 CSS 属性名(`box-shadow` / `border`)。
   */
  property: string;
  /** 解码后的 CSS 值:HTML 实体已还原,`_` 已按 Tailwind 规则还原为空格(`url()` 内除外) */
  value: string;
  shape: ValueShape;
  /**
   * `arbitrary-value` 时是归并到 PATTERN-STYLE-4 依据样本口径的桶
   * (size/position/color/fontSize/lineHeight/radius/opacity/other);
   * `arbitrary-property` 时等于 CSS 属性名本身,不再归并。
   */
  category: string;
  /** 数值 + 单位,仅当 shape 为 length/percentage/number */
  number?: number;
  unit?: string;
  /**
   * 该字面量是 Figma 量出来的文本盒,不是排版意图。见 extract 侧 `fontMeasured` 规则。
   * 只在 true 时出现。
   */
  fontMeasured?: true;
};

export type ComputedDeclaration = {
  raw: string;
  layer: 'computed';
};

const SIZE_PREFIXES = new Set([
  'w',
  'h',
  'min-w',
  'max-w',
  'min-h',
  'max-h',
  'size',
  'basis',
  'm',
  'mx',
  'my',
  'mt',
  'mr',
  'mb',
  'ml',
  'p',
  'px',
  'py',
  'pt',
  'pr',
  'pb',
  'pl',
  'gap',
  'gap-x',
  'gap-y',
  'space-x',
  'space-y'
]);

const POSITION_PREFIXES = new Set([
  'left',
  'top',
  'right',
  'bottom',
  'inset',
  'inset-x',
  'inset-y',
  'z',
  'translate-x',
  'translate-y'
]);

const ARBITRARY_VALUE_PATTERN = /^(-?[a-z][a-zA-Z0-9-]*)-\[([^\]]*)\]$/;
const ARBITRARY_PROPERTY_PATTERN = /^\[([a-zA-Z-]+):([^\]]*)\]$/;
const NUMERIC_PATTERN = /^(-?(?:\d+\.?\d*|\.\d+))([a-z%]*)$/;

/**
 * Tailwind 任意值里 `_` 代表空格,`\_` 代表真下划线;但 `url()` 内的 `_` 保持原样
 * (设计稿的资源名如 `207_7820.svg` 依赖这条,否则文件名会被改坏)。
 */
function decodeArbitraryValue(raw: string): string {
  const decoded = decodeEntities(raw);
  let out = '';
  let urlDepth = 0;
  for (let i = 0; i < decoded.length; i += 1) {
    const char = decoded[i]!;
    if (char === '\\' && decoded[i + 1] === '_') {
      out += '_';
      i += 1;
      continue;
    }
    if (decoded.startsWith('url(', i)) {
      urlDepth += 1;
      out += 'url(';
      i += 3;
      continue;
    }
    if (char === ')' && urlDepth > 0) {
      urlDepth -= 1;
      out += ')';
      continue;
    }
    out += char === '_' && urlDepth === 0 ? ' ' : char;
  }
  return out;
}

function detectShape(value: string): ValueShape {
  if (/^#[0-9a-fA-F]{3,8}$/.test(value)) return 'color';
  if (/^(rgb|rgba|hsl|hsla|color)\(/i.test(value)) return 'color';
  if (/^url\(/i.test(value)) return 'url';
  if (/gradient\(/i.test(value)) return 'gradient';
  if (value.includes(' ')) return 'list';
  const numeric = NUMERIC_PATTERN.exec(value);
  if (numeric !== null) {
    if (numeric[2] === '%') return 'percentage';
    return numeric[2] === '' ? 'number' : 'length';
  }
  if (/^[a-z-]+\(/i.test(value)) return 'function';
  return 'keyword';
}

function categorizeArbitraryValue(prefix: string, shape: ValueShape): string {
  if (shape === 'color') return 'color';
  if (prefix === 'text') return 'fontSize';
  if (prefix === 'leading') return 'lineHeight';
  if (prefix === 'tracking') return 'letterSpacing';
  if (prefix === 'opacity') return 'opacity';
  if (prefix === 'rounded' || prefix.startsWith('rounded-')) return 'radius';
  if (SIZE_PREFIXES.has(prefix)) return 'size';
  if (POSITION_PREFIXES.has(prefix)) return 'position';
  if (prefix === 'bg') return 'background';
  return 'other';
}

export type ParsedToken =
  | { layer: 'literal'; declaration: LiteralDeclaration }
  | { layer: 'computed'; raw: string }
  | { layer: 'malformed'; raw: string; reason: string };

export function parseClassToken(raw: string): ParsedToken {
  const arbitraryValue = ARBITRARY_VALUE_PATTERN.exec(raw);
  if (arbitraryValue !== null) {
    const property = arbitraryValue[1]!;
    const value = decodeArbitraryValue(arbitraryValue[2]!);
    const shape = detectShape(value);
    return {
      layer: 'literal',
      declaration: {
        raw,
        form: 'arbitrary-value',
        property,
        value,
        shape,
        category: categorizeArbitraryValue(property, shape),
        ...numericParts(value, shape)
      }
    };
  }

  const arbitraryProperty = ARBITRARY_PROPERTY_PATTERN.exec(raw);
  if (arbitraryProperty !== null) {
    const property = arbitraryProperty[1]!.toLowerCase();
    const value = decodeArbitraryValue(arbitraryProperty[2]!);
    const shape = detectShape(value);
    return {
      layer: 'literal',
      declaration: {
        raw,
        form: 'arbitrary-property',
        property,
        value,
        shape,
        category: property,
        ...numericParts(value, shape)
      }
    };
  }

  if (raw.includes('[') || raw.includes(']')) {
    return {
      layer: 'malformed',
      raw,
      reason: raw.startsWith('[') && raw.endsWith(':')
        ? 'unterminated-arbitrary-property'
        : 'unrecognized-arbitrary-syntax'
    };
  }

  return { layer: 'computed', raw };
}

function numericParts(value: string, shape: ValueShape): { number?: number; unit?: string } {
  if (shape !== 'length' && shape !== 'percentage' && shape !== 'number') return {};
  const numeric = NUMERIC_PATTERN.exec(value);
  if (numeric === null) return {};
  return { number: Number.parseFloat(numeric[1]!), unit: numeric[2] === '' ? undefined : numeric[2] };
}

export function splitClassAttribute(value: string): string[] {
  return value.split(/\s+/).filter((token) => token.length > 0);
}
