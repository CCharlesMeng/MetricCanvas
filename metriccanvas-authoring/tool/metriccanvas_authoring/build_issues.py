"""创作期构造失败的共同类型。

取数单元派生（`data`）与组件装配（`pages`）都会抛它，两侧互不依赖，因此放包根。
名字沿用既有 `PageBuildingIssue`，不随本次归位改动捕获方。
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class PageBuildingIssue(Exception):
    code: str
    path: str
    message: str
    candidates: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class PageBuildingIssues(Exception):
    issues: tuple[PageBuildingIssue, ...]
