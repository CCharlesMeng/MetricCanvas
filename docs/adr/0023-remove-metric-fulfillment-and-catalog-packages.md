---
status: accepted
---

# 删除指标履约与目录发现的空壳包,完成 ADR-0014 迁移

`packages/catalog-discovery`、`packages/dp-catalog`、`packages/metric-fulfillment`、`tools/data-service-sim`、`tools/dp-sim` 与顶层 `catalog/` 此前承载"从数据服务目录派生查询字段"(ADR-0011)与"查询 DP 并以数据服务目录验真完成指标履约"(ADR-0012)的实现,以及配套的 DP / 数据服务测试仿真器。ADR-0014 已把治理对象从预定义指标改为查询产物,并在其 Consequences 中把 `StructuredQuery.metrics`、指标目录、`METRIC_GAP`、指标履约 Module 和相关 MCP 工具列为"待迁移的旧实现";ADR-0017 进一步一次性删除了旧结构化查询与 `catalog/snapshot.json`。这些包的源码已在此前的迁移中清空,只剩空的 `src/`、`tests/` 与彼此指向的悬空 `node_modules` 软链,长期占位于 workspace 却不被任何构建目标引用。

本次改动物理删除这六个目录,不再保留空壳。这不改变任何运行时行为——它们已经零源文件、零消费者、零 typecheck 覆盖,且已缺失 `package.json` 而不再是有效的 pnpm workspace 项目;`pnpm-lock.yaml` 中也已不含相关依赖记录。

## 取代关系

本 ADR 取代以下前提,把它们从"决策仍有效但实现已下线"明确为"决策与实现均已完成下线":

- ADR-0011 中"query 字段角色与类型由结构化查询和 `CatalogSnapshot`(元数据快照)解析补全"的实现前提——`packages/catalog-discovery` 是该元数据快照之上 `search_catalog` 搜索能力的实现,现已删除;查询字段契约改由 ADR-0014 的查询产物结果字段契约直接声明,不再存在运行时目录搜索这一环节。
- ADR-0012 全部实现前提——`packages/dp-catalog` 承载的"按稳定 ID 查询 DP 指标并向数据服务目录验真"能力、`packages/metric-fulfillment` 承载的指标需求组/DP 关联/人工确认/审计编排,以及 `tools/dp-sim`、`tools/data-service-sim` 两个仅供该流程使用的测试仿真器。ADR-0012 本身已标注 `superseded by ADR-0014`,本 ADR 补上其实现侧已被物理删除这一事实。
- ADR-0014 Consequences 中"现有 `StructuredQuery.metrics`、指标目录、`METRIC_GAP`、指标履约 Module 和相关 MCP 工具属于待迁移的旧实现"一句——该迁移到本 ADR 为止已完成,不再有待删除的指标履约实现残留。

## Consequences

- `packages/`、`tools/` 与顶层不再有这六个连 `package.json` 都已被清空的目录;它们在删除前已不具备有效 `package.json`,不再被 pnpm 识别为 workspace 项目,`pnpm install` 后其 `node_modules` 中互相指向的悬空符号链接一并消失。
- 新增包或目录不会再被开发者误认为"这是指标履约功能的占位符,需要补实现"。
- 顶层 `catalog/` 目录(曾承载 `catalog/snapshot.json`)不再存在;ADR-0017 中该文件的删除决定至此在文件系统层面完全落地。

## Considered Options

- 保留空壳目录作为未来可能复用的占位:与 ADR-0011/ADR-0012/ADR-0014 已经明确放弃这条路线的决策矛盾,且悬空软链持续污染 `node_modules`,被否决。
- 只清理 `node_modules` 悬空软链、保留空的 `src/`/`tests/`:不解决"空目录暗示存在未完成实现"的误导,被否决。
