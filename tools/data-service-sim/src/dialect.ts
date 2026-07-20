/**
 * apiQuery 方言解析(《中间层分析.md》§2):三种查询模式中仿真支持 COMMON 与 REST,
 * DATA_PROCESS(@connect)一期不用、显式报错。
 * 解析器是"报告读成代码":凡报告未记录的语法,这里选择报错而非容忍——
 * 服务端真实容忍度是待核对假设(#3),报错让分歧尽早暴露。
 */

export interface DirectiveArgs {
  [key: string]: string | number | boolean;
}

export interface FieldNode {
  name: string;
  directives: Record<string, DirectiveArgs>;
}

export interface TableNode {
  name: string;
  where?: string;
  fields: FieldNode[];
}

export type ParsedQuery =
  | { kind: 'introspection'; alias: string; typeName: string }
  | { kind: 'rest'; resolver: string; request: DirectiveArgs; fields: string[] }
  | {
      kind: 'common';
      limit?: number;
      offset?: number;
      where?: string;
      tables: TableNode[];
    };

export class DialectError extends Error {}

export function parseApiQuery(apiQuery: string): ParsedQuery {
  const tokens = tokenize(apiQuery);
  const p = new Parser(tokens);
  p.expect('{');

  // ── REST 模式:{restQuery{ Resolver(request:{...}){ fields } }}
  if (p.peekIdent() === 'restQuery') {
    p.next();
    p.expect('{');
    const resolver = p.ident();
    p.expect('(');
    p.expectIdent('request');
    p.expect(':');
    p.expect('{');
    const request: DirectiveArgs = {};
    while (p.peek() !== '}') {
      const key = p.ident();
      p.expect(':');
      request[key] = p.value();
      if (p.peek() === ',') p.next();
    }
    p.expect('}');
    p.expect(')');
    p.expect('{');
    const fields: string[] = [];
    while (p.peek() !== '}') fields.push(p.ident());
    p.expect('}');
    p.expect('}');
    p.expect('}');
    return { kind: 'rest', resolver, request, fields };
  }

  // ── 内省:{ alias:__type(name:"X"){fields{name}} }(别名可省)
  const first = p.ident();
  let alias = first;
  let head = first;
  if (p.peek() === ':') {
    p.next();
    head = p.ident();
  }
  if (head === '__type') {
    p.expect('(');
    p.expectIdent('name');
    p.expect(':');
    const typeName = String(p.value());
    p.expect(')');
    p.expect('{');
    p.expectIdent('fields');
    p.expect('{');
    p.expectIdent('name');
    p.expect('}');
    p.expect('}');
    p.expect('}');
    return { kind: 'introspection', alias: alias === '__type' ? '__type' : alias, typeName };
  }

  // ── COMMON 模式:{ (alias:)query @global指令* { TABLE (@where)? { field @指令* ... } ... } }
  if (head !== 'query') {
    throw new DialectError(`无法识别的查询头 ${head}:仿真支持 query/restQuery/__type 三种形态`);
  }
  const globals = p.directives();
  if (globals['connect']) {
    throw new DialectError('@connect(DATA_PROCESS 模式)一期不用,仿真不支持');
  }
  p.expect('{');
  const tables: TableNode[] = [];
  while (p.peek() !== '}') {
    const name = p.ident();
    const tableDirectives = p.directives();
    for (const d of Object.keys(tableDirectives)) {
      if (d !== 'where') throw new DialectError(`表级只支持 @where,收到 @${d}`);
    }
    p.expect('{');
    const fields: FieldNode[] = [];
    while (p.peek() !== '}') {
      const fieldName = p.ident();
      fields.push({ name: fieldName, directives: p.directives() });
    }
    p.expect('}');
    tables.push({
      name,
      where: tableDirectives['where'] ? String(tableDirectives['where'].value) : undefined,
      fields
    });
  }
  p.expect('}');
  p.expect('}');

  return {
    kind: 'common',
    limit: numberArg(globals['limit']),
    offset: numberArg(globals['offset']),
    where: globals['where'] ? String(globals['where'].value) : undefined,
    tables
  };
}

function numberArg(args?: DirectiveArgs): number | undefined {
  if (!args) return undefined;
  const value = args.value;
  if (typeof value !== 'number') throw new DialectError(`@limit/@offset 的 value 须为数字,收到 ${String(value)}`);
  return value;
}

// ── 词法与递归下降 ─────────────────────────────────────────────

type Token = { t: 'sym'; v: string } | { t: 'ident'; v: string } | { t: 'str'; v: string } | { t: 'num'; v: number };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (/\s/.test(ch)) {
      i++;
    } else if ('{}():,@'.includes(ch)) {
      tokens.push({ t: 'sym', v: ch });
      i++;
    } else if (ch === '"') {
      let j = i + 1;
      let out = '';
      while (j < input.length && input[j] !== '"') {
        if (input[j] === '\\' && j + 1 < input.length) {
          out += input[j + 1];
          j += 2;
        } else {
          out += input[j];
          j++;
        }
      }
      if (j >= input.length) throw new DialectError('字符串未闭合');
      tokens.push({ t: 'str', v: out });
      i = j + 1;
    } else if (/[-\d]/.test(ch)) {
      const m = /^-?\d+(\.\d+)?/.exec(input.slice(i))!;
      tokens.push({ t: 'num', v: Number(m[0]) });
      i += m[0].length;
    } else if (/[A-Za-z_]/.test(ch)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(input.slice(i))!;
      tokens.push({ t: 'ident', v: m[0] });
      i += m[0].length;
    } else {
      throw new DialectError(`无法识别的字符 ${ch}(位置 ${i})`);
    }
  }
  return tokens;
}

class Parser {
  private pos = 0;
  constructor(private tokens: Token[]) {}

  peek(): string | undefined {
    const token = this.tokens[this.pos];
    return token?.t === 'sym' ? token.v : undefined;
  }

  peekIdent(): string | undefined {
    const token = this.tokens[this.pos];
    return token?.t === 'ident' ? token.v : undefined;
  }

  next(): Token {
    const token = this.tokens[this.pos++];
    if (!token) throw new DialectError('查询意外结束');
    return token;
  }

  expect(sym: string): void {
    const token = this.next();
    if (token.t !== 'sym' || token.v !== sym) {
      throw new DialectError(`期望 ${sym},收到 ${String(token.v)}`);
    }
  }

  ident(): string {
    const token = this.next();
    if (token.t !== 'ident') throw new DialectError(`期望标识符,收到 ${String(token.v)}`);
    return token.v;
  }

  expectIdent(name: string): void {
    const got = this.ident();
    if (got !== name) throw new DialectError(`期望 ${name},收到 ${got}`);
  }

  value(): string | number | boolean {
    const token = this.next();
    if (token.t === 'str') return token.v;
    if (token.t === 'num') return token.v;
    if (token.t === 'ident') {
      if (token.v === 'true') return true;
      if (token.v === 'false') return false;
      return token.v;
    }
    throw new DialectError(`期望值,收到 ${String(token.v)}`);
  }

  /** 连续的 @name(arg:value,...) 指令序列 */
  directives(): Record<string, DirectiveArgs> {
    const out: Record<string, DirectiveArgs> = {};
    while (this.peek() === '@') {
      this.next();
      const name = this.ident();
      const args: DirectiveArgs = {};
      this.expect('(');
      while (this.peek() !== ')') {
        const key = this.ident();
        this.expect(':');
        args[key] = this.value();
        if (this.peek() === ',') this.next();
      }
      this.expect(')');
      out[name] = args;
    }
    return out;
  }
}
