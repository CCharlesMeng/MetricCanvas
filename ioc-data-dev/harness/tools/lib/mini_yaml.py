#!/usr/bin/env python3
"""mini_yaml.py — IOC 套件自带的 YAML 子集解析器(零依赖)。

覆盖本套件 YAML 文件实际使用的子集:
  - 缩进嵌套的 map(key: value)
  - 列表项 `- key: value`(list of maps)与 `- 裸标量`
  - 内联数组 [a, b, c](元素不含逗号/引号)
  - 双引号标量(值内可含 `: ` 与 `,`)
  - 注释(# 到行尾)、空行
  - 块类型延迟决定(首个子行是 `- ` → list,否则 → dict)

不做的事:多行字符串、锚点/别名、流式 map、block 标量(| >)、嵌套内联数组。
超出子集时抛 MiniYamlError。
"""
from __future__ import annotations

import re
import sys


class MiniYamlError(ValueError):
    pass


class _Block:
    """引用单元:value 由首个子行决定为 dict 或 list。"""
    __slots__ = ('value',)

    def __init__(self):
        self.value = None


def _strip_comment(line: str) -> str:
    out = []
    in_q = False
    for ch in line:
        if ch == '"':
            in_q = not in_q
        if ch == '#' and not in_q:
            break
        out.append(ch)
    return ''.join(out).rstrip()


def _split_kv(line: str):
    """在引号外第一个 ': ' 或行尾 ':' 处切分 key/value。"""
    in_q = False
    for i, ch in enumerate(line):
        if ch == '"':
            in_q = not in_q
        elif ch == ':' and not in_q:
            rest = line[i + 1:].strip()
            if rest == '' or rest.startswith('#'):
                return line[:i].strip(), None
            return line[:i].strip(), rest
    return None, None


def _parse_scalar(s):
    s = s.strip()
    if s == '' or s is None:
        return None
    if s.startswith('"') and s.endswith('"') and len(s) >= 2:
        return s[1:-1]
    if s.startswith('[') and s.endswith(']'):
        inner = s[1:-1].strip()
        if inner == '':
            return []
        return [x.strip().strip('"') for x in inner.split(',')]
    low = s.lower()
    if low in ('null', '~'):
        return None
    if low == 'true':
        return True
    if low == 'false':
        return False
    if re.fullmatch(r'-?\d+', s):
        return int(s)
    if re.fullmatch(r'-?\d+\.\d+', s):
        return float(s)
    return s


def load(text: str):
    items = []
    for raw in text.splitlines():
        line = _strip_comment(raw)
        if not line.strip():
            continue
        indent = len(line) - len(line.lstrip(' '))
        items.append((indent, line.strip()))
    if not items:
        return {}

    root = _Block()
    stack = []  # (indent, container): container 为 _Block 或已物化的 dict/list

    def container_for(indent, content):
        """物化最内层未定块并返回可写容器。"""
        if stack:
            _, c = stack[-1]
            if isinstance(c, _Block) and c.value is None:
                c.value = [] if content.startswith('- ') else {}
            return c
        if root.value is None:
            root.value = [] if content.startswith('- ') else {}
        return root

    for indent, content in items:
        while stack and indent <= stack[-1][0]:
            stack.pop()
        cont = container_for(indent, content)
        if isinstance(cont, _Block):
            cont = cont.value
        if content.startswith('- '):
            rest = content[2:].strip()
            if not rest:
                raise MiniYamlError(f'空列表项: {content!r}')
            key, value = _split_kv(rest)
            if key is None:
                cont.append(_parse_scalar(rest))
            else:
                item = {}
                if value is None:
                    item[key] = _Block()
                    cont.append(item)
                    stack.append((indent, item[key]))
                else:
                    item[key] = _parse_scalar(value)
                    cont.append(item)
                    stack.append((indent, item))
        else:
            key, value = _split_kv(content)
            if key is None:
                raise MiniYamlError(f'无法解析的行: {content!r}')
            if isinstance(cont, dict):
                if value is None:
                    cont[key] = _Block()
                    stack.append((indent, cont[key]))
                else:
                    cont[key] = _parse_scalar(value)
            elif isinstance(cont, list):
                if not cont or not isinstance(cont[-1], dict):
                    raise MiniYamlError(f'列表内键值对父级不是 dict: {content!r}')
                if value is None:
                    cont[-1][key] = _Block()
                    stack.append((indent, cont[-1][key]))
                else:
                    cont[-1][key] = _parse_scalar(value)
            else:
                raise MiniYamlError(f'无法写入: {content!r}')

    def unwrap(node):
        """把树中残留的 _Block 引用替换为其真实值。"""
        if isinstance(node, _Block):
            return unwrap(node.value)
        if isinstance(node, dict):
            return {k: unwrap(v) for k, v in node.items()}
        if isinstance(node, list):
            return [unwrap(x) for x in node]
        return node

    return unwrap(root.value)


def load_file(path: str):
    with open(path, 'r', encoding='utf-8') as f:
        return load(f.read())


if __name__ == '__main__':
    ok = True
    for p in sys.argv[1:]:
        try:
            data = load_file(p)
            print(f'{p}: OK ({type(data).__name__})')
        except Exception as e:  # noqa: BLE001
            print(f'{p}: FAIL {e}', file=sys.stderr)
            ok = False
    sys.exit(0 if ok else 1)
