# knowledge-base/ — 知识底座
# 基线真源,先查后写(CORE-AX4)。

| 目录 | 内容 | 谁消费 |
|------|------|--------|
| ontology/ | 语义层:域目录、一致性维度、六层调用规则 | ioc-data-design / ioc-ads-design |
| specification/ | 规范约束:分层命名、领域模式、引擎差异、平台约定 | sql-generator / sql-validator / 校验器 |
| architecture/ | 架构基线:维度注册表、代码仓索引 | ioc-ads-design / archive |
| feature-tree/ | 特性树(L1→L4) | archive(ADDED/MODIFIED 回写) |

## 使用顺序

1. 设计前:读 ontology(目录→维度→六层规则)
2. 建模时:读 specification(约束/模式/引擎)
3. 写 SQL:读 specification/data-design/domain-source-patterns.yaml + engine-differences.yaml
4. 归档时:更新 feature-tree + dimension-registry + catalog,经 baseline-update.md 登记
