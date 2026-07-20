import { DialectError } from './dialect';
import type { SimRow } from './tables';

/**
 * @where 的类 SQL 条件解析(《中间层分析.md》§2.3.2):
 * 支持 = != > < >= <=、in (...)、between ... and ...,多条件以 and 连接。
 * 【假设,#3 核对】报告明言"value 为自由文本,由后端解析,前端无校验":
 * or/括号/SQL 函数(coalesce/case when 等)的服务端容忍度未知,仿真选择报错,
 * 逼适配器只生成白名单内的形态。
 */
export type Predicate = (row: SimRow) => boolean;

export function parseWhere(text: string): Predicate {
  const parts = splitTopLevel(text, /\s+and\s+/i);
  // between 自带一个 and:被顶层切分吃掉时,把上界段并回去
  const merged: string[] = [];
  for (const part of parts) {
    const prev = merged[merged.length - 1];
    if (prev && /\bbetween\b/i.test(prev) && !/\bbetween\b[\s\S]+\band\b/i.test(prev)) {
      merged[merged.length - 1] = `${prev} and ${part}`;
    } else {
      merged.push(part);
    }
  }
  const clauses = merged.map(parseClause);
  return (row) => clauses.every((clause) => clause(row));
}

function parseClause(clause: string): Predicate {
  const trimmed = clause.trim();

  const between = /^([A-Za-z_][A-Za-z0-9_]*)\s+between\s+(.+?)\s+and\s+(.+)$/i.exec(trimmed);
  if (between) {
    const [, column, low, high] = between;
    const lo = literal(low);
    const hi = literal(high);
    return (row) => row[column] >= lo && row[column] <= hi;
  }

  const inClause = /^([A-Za-z_][A-Za-z0-9_]*)\s+in\s*\((.+)\)$/i.exec(trimmed);
  if (inClause) {
    const [, column, list] = inClause;
    const values = splitTopLevel(list, /,/).map((v) => literal(v.trim()));
    return (row) => values.some((v) => looseEqual(row[column], v));
  }

  const cmp = /^([A-Za-z_][A-Za-z0-9_]*)\s*(>=|<=|!=|=|>|<)\s*(.+)$/.exec(trimmed);
  if (cmp) {
    const [, column, op, raw] = cmp;
    const value = literal(raw.trim());
    return (row) => {
      const cell = row[column];
      switch (op) {
        case '=':
          return looseEqual(cell, value);
        case '!=':
          return !looseEqual(cell, value);
        case '>':
          return cell > value;
        case '<':
          return cell < value;
        case '>=':
          return cell >= value;
        case '<=':
          return cell <= value;
      }
      return false;
    };
  }

  throw new DialectError(`@where 条件无法解析:${trimmed}(仿真只支持比较/in/between + and 连接)`);
}

/** 字面量:'单引号字符串' 或数字;有残留内容(如 or 连接)即报错,不静默吞掉 */
function literal(raw: string): string | number {
  const quoted = /^'([^']*)'$/.exec(raw);
  if (quoted) return quoted[1];
  const n = Number(raw);
  if (!Number.isNaN(n) && raw !== '') return n;
  throw new DialectError(`@where 字面量无法解析:${raw}(须为 '字符串' 或数字)`);
}

/** 数字列与数字字面量、字符串列与字符串字面量比较;跨类型按字符串比(与松散后端一致的保守假设) */
function looseEqual(cell: string | number | undefined, value: string | number): boolean {
  if (cell === undefined) return false;
  return typeof cell === typeof value ? cell === value : String(cell) === String(value);
}

/** 按分隔符切分,但不切进单引号字符串内部 */
function splitTopLevel(text: string, sep: RegExp): string[] {
  const parts: string[] = [];
  let current = '';
  let inString = false;
  let i = 0;
  while (i < text.length) {
    if (text[i] === "'") {
      inString = !inString;
      current += text[i];
      i++;
      continue;
    }
    if (!inString) {
      const m = new RegExp('^(?:' + sep.source + ')', sep.flags).exec(text.slice(i));
      if (m && m[0].length > 0) {
        parts.push(current);
        current = '';
        i += m[0].length;
        continue;
      }
    }
    current += text[i];
    i++;
  }
  parts.push(current);
  return parts;
}
