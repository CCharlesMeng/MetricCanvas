# IOC 作战地图批次（2026-08 ~ 09，已收口）

## 这批做了什么

第一个与既有场景形状不同的需求：一个**多页数据应用**——「概览 → 机会点清单 → 项目详情」三级下钻，取数协议全是 GraphQL 而不是 DQE，应用外壳由已有门户提供。来源规格是 `参考/项目地图/` 下的链路契约、三份页面规格、55+ 指标逐字段口径与三张 Figma 导出稿。

交付分两段：页面协议按 5.1 / 5.2 做纯增量扩展，三个页面用内联数据源落地。

## 结论落在哪

**九份 ADR，状态以[速查表](../../adr/README.md#速查表)为准，现行结论见[IOC 作战地图批次主题页](../../adr/topics/ioc-operation-map-batch.md)：**

| 已生效 | 内容 |
|---|---|
| [ADR-0046](../../adr/0046-controlled-computation-with-named-operators.md) | 封闭具名算子第一批进入页面数据源 |
| [ADR-0047](../../adr/0047-first-class-page-parameters.md) | 顶层 `params`，按「页面打开后还能不能变」分开 URL 输入与筛选器 |
| [ADR-0048](../../adr/0048-navigation-intent-and-host-routing.md) | 跨页路由交给宿主，运行时只上抛导航意图 |
| [ADR-0050](../../adr/0050-filter-type-closure-and-hierarchical-dimensions.md) | 筛选器闭集扩到六类 + 层级维度 |
| [ADR-0051](../../adr/0051-additive-minor-versions-for-page-schema.md) | 页面协议改为增量次版本演进 |
| [ADR-0052](../../adr/0052-dashboard-layout-form-backdrop-and-safe-area.md) | `layoutForm`、铺底层与运行时安全区 |
| [ADR-0053](../../adr/0053-composite-card-component-level-grouping-container.md) | 组合卡 + 分类明细 |

| 仍是提议 | 卡在哪 |
|---|---|
| [ADR-0045](../../adr/0045-graphql-query-branch-with-structured-predicates.md) | GraphQL 结构化谓词分支未落地，`QUERY_LANGUAGES` 至今只有 `dqe` |
| [ADR-0049](../../adr/0049-table-server-side-and-presentation-capabilities.md) | 呈现能力已落地，查询分页下排序与表头筛选的拒绝规则未解除 |

协议能力写进 [`PAGE-METADATA.md`](../../../PAGE-METADATA.md)；装箱与布局的现行结论见[页面文档结构与书写原则](../../adr/topics/page-document-structure.md)。

## 被推翻的方向

- **「多页应用」没有成为一等概念。** 应用外壳归已有门户，所以本批没引入导航树、页面成员或面包屑规则。ADR-0048 明确留给第二个多页应用出现时再裁决。
- **前端计算不下推数据侧。** 改表要走完整数据开发链路、周期不可控，所以计算进了页面协议——这是 ADR-0046 存在的前提，不是通用偏好。
- **`archive-not-a-source/opportunity-lits.html` 被判定为失效设计源**，其中的 KPI 卡片与透视表结构不得迁入机会点明细列表（见 [`ioc-project-map-wip-closeout.md`](./ioc-project-map-wip-closeout.md)）。
- **ADR-0048 的导航目标此后被 [ADR-0067](../../adr/0067-url-navigation-with-explicit-parameter-bindings.md) / [ADR-0068](../../adr/0068-plain-url-navigation-protocol.md) 取代**并完成 #109 迁移。本批里关于 pageId 导航的描述是已替换的历史实现，不是接入要求。

## 里面有什么

`ioc-operation-map.md` 是执行计划总索引；`ioc-project-map-wip-closeout.md` 是 5.2 收口记录；`ioc-legacy-handoff.md` 是发给旧项目源码持有者的寻源问卷（`packages/engine/widgets/src/assets/` 的两个 svg 至今引用它的 D.6 条目）；`ioc-1980-width/` 是 1980 宽度适配的 19 份过程件；其余是计算、响应式布局与数据开发的专项交接。

同批的两份长期证据不在这里，在 [`docs/evidence/`](../../evidence/README.md)：`2026-08-frontend-calculation-reconciliation.md`（空值语义的替代真源）与 `2026-08-ioc-harness-capability-review.md` + `-action-pack.md`。
