# 文档导航

查能力和写页面时，从现行协议、代码定义及可运行示例进入；继续实施时，再查对应计划。计划中的提案、历史截图与旧验收记录有各自的时间和范围，不能直接作为当前页面字段的依据。

## 按任务阅读

| 任务 | 入口 |
|---|---|
| 理解产品目标与领域术语 | [产品目标](../origin.md)、[领域词汇表](../CONTEXT.md)、[整体方案](solution.md) |
| 定位代码包边界与改动验证 | [代码架构与维护者指南](../ARCHITECTURE.md)、[源码依赖门禁](agents/architecture-ratchet.md)、[代码复杂度规则](agents/code-complexity.md) |
| 编写或修复页面 JSON | [页面协议](../PAGE-METADATA.md)、[协议演进日志](changelog/page-metadata.md)、[模块参考](page-metadata/README.md)、[可运行示例](../pages/README.md) |
| 配置参数、筛选和查询 | [页面参数](../PAGE-PARAMETERS.md)、[数据源](page-metadata/data-sources.md)、[查询定义](page-metadata/queries-and-bindings.md)、[Schema 元数据](schema-metadata.md) |
| 接入或打包渲染引擎 | [Embed 接入](../packages/embed/README.md)、[集成应用契约](host-contract.md)、[运行态架构](runtime-architecture.md)、[前端运行能力概览](frontend-runtime-capabilities.md) |
| 接入创作能力 | [创作架构](../metriccanvas-authoring/ARCHITECTURE.md)、[页面构建流程](page-building-process.md)、[Relay 隔离边界](relay-authoring-isolation.md) |
| 查设计依据与现行裁决 | [ADR 速查](adr/README.md) → 对应主题页 → 必要时读 ADR 原文 |
| 接续未完成工作 | [执行与接入待办](plan/README.md) |
| 追溯历史 | [证据索引](evidence/README.md)、[归档索引](archive/README.md)、Git 固定提交 |

## 页面字段的依据

字段名称、层级和版本以 [`packages/page/src/version.ts`](../packages/page/src/version.ts)、[产品 Schema](../packages/page/src/schema/) 与 [页面协议](../PAGE-METADATA.md) 为准。仓内 Skill 的协议知识由产品真源生成，维护方式见 [local-authoring 维护约定](agents/local-authoring-skill-maintenance.md)。

例如，查询排序由数据源/查询侧声明（普通查询使用 `order.order_by_field/type`，`pagedJoin` / `pagedUnion` 使用数据源 `ordering.default`）；完整本地结果表格可在组件侧声明 `props.defaultSort`（Schema 6.108 起）。配置与示例见 [查询默认排序](page-metadata/components/table.md#查询默认排序的首屏方向) 与 [本地默认排序](page-metadata/components/table.md#local-default-sort)。

## 文档保留与清理

- 正式协议、架构、接入说明随产品实现更新，保留一个现行入口。
- `plan/` 保留未完成任务和验收缺口；已被正式文档承接的旧提案与重复交接退出执行入口。
- 日志、截图、完整扫描、运行回执等过程件保存在本地忽略目录。已有材料移出源码树前，检查测试消费者和引用；必要输入保留在消费者旁，历史引用指向清理前的固定提交。
- 历史材料的迁移与删除不改变原验收范围；真实 DQE、Relay、门户和部署没有验收证据时，继续保留为待办。

现存分类与提交规则见 [文档寿命](plan/README.md#四种寿命四个去处) 和 [附件规则](evidence/README.md)。
