#!/usr/bin/env python3
"""生成 docs/adr/README.md 的速查表与主题索引。

两处真源，本脚本都只读不写：
- 每份 ADR 的 frontmatter 是状态真源（status / superseded-by / revised-by / note）。
- docs/adr/topics/*.md 是主题页真源，索引里「覆盖的 ADR」由它们实际引用的编号推出。

顺带守三类一致性：frontmatter 取值与关系合法、主题页里的 ADR 链接都指向真实文件、
以及每份 ADR 至少被一个主题页收录（未收录的会列进索引，不许无声漂着）。

    python3 tools/scripts/adr-index.py          # 重新生成
    python3 tools/scripts/adr-index.py --check  # 只校验，不一致时退出码 1
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ADR_DIR = Path(__file__).resolve().parents[2] / "docs" / "adr"
TOPICS_DIR = ADR_DIR / "topics"
README = ADR_DIR / "README.md"
START = "<!-- adr-index:start 由 tools/scripts/adr-index.py 生成，不要手改 -->"
END = "<!-- adr-index:end -->"
TOPICS_START = "<!-- adr-topics:start 由 tools/scripts/adr-index.py 生成，不要手改 -->"
TOPICS_END = "<!-- adr-topics:end -->"

STATUS_LABEL = {"accepted": "现行", "proposed": "提议中", "superseded": "已取代"}

# 主题页的阅读顺序。新增主题页必须登记在这里，否则本脚本报错。
TOPIC_ORDER = [
    "ioc-operation-map-batch.md",
    "tech-stack-and-strategy.md",
    "domain-modeling-and-package-boundaries.md",
    "page-document-structure.md",
    "data-fetching-and-query-model.md",
    "product-forms-and-lifecycle.md",
    "ask-orchestration-and-scope-governance.md",
    "page-lifecycle-and-publish-governance.md",
    "ai-summary-component.md",
    "open-questions.md",
    "numbering-and-history.md",
]


class AdrError(Exception):
    pass


def parse(path: Path) -> dict[str, str]:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        raise AdrError(f"{path.name}: 缺少 frontmatter")
    end = text.find("\n---\n", 3)
    if end == -1:
        raise AdrError(f"{path.name}: frontmatter 未闭合")
    fields: dict[str, str] = {}
    for line in text[4:end].splitlines():
        key, _, value = line.partition(":")
        fields[key.strip()] = value.strip()
    heading = re.search(r"^# (.+)$", text[end:], re.M)
    if not heading:
        raise AdrError(f"{path.name}: 找不到 H1 标题")
    fields["title"] = heading.group(1).strip()
    fields["file"] = path.name
    return fields


def refs(raw: str) -> list[str]:
    return re.findall(r"\d{4}", raw)


def status_cell(fields: dict[str, str], path_of: dict[str, str]) -> str:
    status = fields.get("status", "")
    if status not in STATUS_LABEL:
        raise AdrError(f"{fields['file']}: status 取值非法 {status!r}")
    parts = [STATUS_LABEL[status]]
    superseded = refs(fields.get("superseded-by", ""))
    revised = refs(fields.get("revised-by", ""))
    if status == "superseded" and not superseded:
        raise AdrError(f"{fields['file']}: status 为 superseded 但缺 superseded-by")
    if superseded and status != "superseded":
        raise AdrError(f"{fields['file']}: 有 superseded-by 但 status 不是 superseded")
    if superseded:
        parts[0] += "，见 " + "、".join(f"[{n}](./{path_of[n]})" for n in superseded)
    if revised:
        parts.append("部分由 " + "、".join(f"[{n}](./{path_of[n]})" for n in revised) + " 修订")
    note = fields.get("note", "")
    if note:
        parts.append(note)
    return "；".join(parts)


def read_topic(path: Path, path_of: dict[str, str]) -> dict[str, object]:
    text = path.read_text(encoding="utf-8")
    heading = re.search(r"^# (.+)$", text, re.M)
    if not heading:
        raise AdrError(f"topics/{path.name}: 找不到 H1 标题")
    blurb = re.search(r"^> (.+)$", text, re.M)
    if not blurb:
        raise AdrError(f"topics/{path.name}: 缺少 H1 下的一句话说明（以 '> ' 开头）")
    covered = set()
    for link in re.findall(r"\]\((\.\./\d{4}-[^)]+)\)", text):
        name = link[3:]
        num = name[:4]
        if path_of.get(num) != name:
            raise AdrError(f"topics/{path.name}: 链接 {link} 指向不存在的 ADR 文件")
        covered.add(num)
    for stray in re.findall(r"\]\((\./\d{4}-[^)]+)\)", text):
        raise AdrError(f"topics/{path.name}: {stray} 少了一级路径，主题页里应写 ../{stray[2:]}")
    return {"file": path.name, "title": heading.group(1).strip(), "blurb": blurb.group(1).strip(), "covered": covered}


def build_index(entries: list[dict[str, str]], path_of: dict[str, str]) -> str:
    counts = {k: sum(1 for e in entries if e["status"] == k) for k in STATUS_LABEL}
    lines = [
        START,
        "",
        f"共 {len(entries)} 份 ADR（{entries[0]['file'][:4]}–{entries[-1]['file'][:4]}）："
        f"现行 {counts['accepted']}、提议中 {counts['proposed']}、已取代 {counts['superseded']}。"
        f"状态真源是每份 ADR 自己的 frontmatter，本表由 `tools/scripts/adr-index.py` 生成。",
        "",
        "| 编号 | 标题 | 现状 |",
        "|---|---|---|",
    ]
    for e in entries:
        num = e["file"][:4]
        lines.append(f"| [{num}](./{e['file']}) | {e['title']} | {status_cell(e, path_of)} |")
    lines += ["", END]
    return "\n".join(lines)


def readme_prose_refs(readme: str, path_of: dict[str, str]) -> set[str]:
    """README 自身正文（两块生成区之外）引用的 ADR，也算已收录。"""
    prose = re.sub(
        rf"{re.escape(START)}.*?{re.escape(END)}|{re.escape(TOPICS_START)}.*?{re.escape(TOPICS_END)}",
        "",
        readme,
        flags=re.S,
    )
    return {link[2:6] for link in re.findall(r"\]\((\./\d{4}-[^)]+)\)", prose)}


def build_topics(entries: list[dict[str, str]], path_of: dict[str, str], readme: str) -> str:
    on_disk = {p.name for p in TOPICS_DIR.glob("*.md")}
    if on_disk != set(TOPIC_ORDER):
        missing = sorted(set(TOPIC_ORDER) - on_disk)
        extra = sorted(on_disk - set(TOPIC_ORDER))
        raise AdrError(f"主题页与 TOPIC_ORDER 不符：缺少 {missing}，未登记 {extra}")

    topics = [read_topic(TOPICS_DIR / name, path_of) for name in TOPIC_ORDER]
    lines = [
        TOPICS_START,
        "",
        "主题页是**人写的现行结论**；「覆盖的 ADR」由 `tools/scripts/adr-index.py` 从主题页正文实际引用的编号推出，"
        "不是手写的。编号点开见上面的速查表。",
        "",
        "| 主题 | 讲什么 | 覆盖的 ADR |",
        "|---|---|---|",
    ]
    for t in topics:
        nums = sorted(t["covered"])
        cell = " ".join(nums) if nums else "—"
        lines.append(f"| [{t['title']}](./topics/{t['file']}) | {t['blurb']} | {cell} |")

    all_covered = set().union(*(t["covered"] for t in topics)) if topics else set()
    all_covered |= readme_prose_refs(readme, path_of)
    orphans = sorted(e["file"][:4] for e in entries if e["file"][:4] not in all_covered)
    lines += [""]
    if orphans:
        lines.append(
            "**结论尚未落进任何主题页：** "
            + "、".join(f"[{n}](./{path_of[n]})" for n in orphans)
            + "。新 ADR 落盘后要把结论并进对应主题页，这一行才会消失。"
        )
    else:
        lines.append("每份 ADR 的结论都至少落在一个主题页（或本页正文）里，没有孤儿。")
    lines += ["", TOPICS_END]
    return "\n".join(lines)


def replace_block(text: str, start: str, end: str, body: str, label: str) -> str:
    if start not in text or end not in text:
        raise AdrError(f"{README} 缺少 {label} 标记，请先手工插入一次")
    head, rest = text.split(start, 1)
    _, tail = rest.split(end, 1)
    return head + body + tail


def main() -> int:
    try:
        paths = sorted(p for p in ADR_DIR.glob("0*.md"))
        entries = [parse(p) for p in paths]
        path_of = {e["file"][:4]: e["file"] for e in entries}
        for e in entries:
            for n in refs(e.get("superseded-by", "")) + refs(e.get("revised-by", "")):
                if n not in path_of:
                    raise AdrError(f"{e['file']}: 引用了不存在的 ADR {n}")

        readme = README.read_text(encoding="utf-8")
        updated = replace_block(readme, START, END, build_index(entries, path_of), "adr-index")
        updated = replace_block(
            updated, TOPICS_START, TOPICS_END, build_topics(entries, path_of, readme), "adr-topics"
        )
    except AdrError as exc:
        print(f"ADR 索引错误: {exc}", file=sys.stderr)
        return 1

    if updated == readme:
        print("速查表与主题索引已是最新")
        return 0
    if "--check" in sys.argv:
        print("README 两张表与真源不一致，请跑 python3 tools/scripts/adr-index.py", file=sys.stderr)
        return 1
    README.write_text(updated, encoding="utf-8")
    print("速查表与主题索引已重新生成")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
