# IOC 作战地图批次（0045–0053）

> 一个多页 GraphQL 数据应用触发的九份决策：哪些已生效、哪些仍是提议、以及驱动它们的三条业务裁决。

触发这一批的是一个与既有场景形状不同的需求:一个多页数据应用,包含"概览 → 清单 → 详情"三级下钻,取数协议全部是 GraphQL 而非 DQE,应用外壳由已有门户提供。

**已生效:** [ADR-0046](../0046-controlled-computation-with-named-operators.md) 在页面数据源上引入封闭具名算子(第一批),**这是对 ADR-0003 措辞的一次修订与对 ADR-0033 的部分恢复**,但不恢复计算数据集聚合根;[ADR-0047](../0047-first-class-page-parameters.md) 新增顶层 `params`,按"页面打开后还能不能变"把 URL 输入与筛选器分开;[ADR-0048](../0048-navigation-intent-and-host-routing.md) 把跨页路由交给宿主,运行时只上抛导航意图,Canvas 用 sessionStorage 记来源并画返回;[ADR-0050](../0050-filter-type-closure-and-hierarchical-dimensions.md) 把筛选器闭集从两类扩到六类并引入层级维度,顺带偿还 ADR-0035 的落地欠账;[ADR-0051](../0051-additive-minor-versions-for-page-schema.md) 把版本演进定为增量次版本,本批交付 5.1。

**仍为提议:** [ADR-0045](../0045-graphql-query-branch-with-structured-predicates.md) 补齐 ADR-0034 留白的 GraphQL 分支形状,关键是把来源实现里的 WHERE 字符串模板换成结构化谓词,守住 ADR-0003——**本批未落地,`QUERY_LANGUAGES` 仍只有 `dqe`**;[ADR-0049](../0049-table-server-side-and-presentation-capabilities.md) 解除查询分页下的排序与列头筛选限制、改为按数据源模式整体下推(呈现已落地,拒绝规则未删)。

**驱动这批决策的三条业务裁决**(见 [`docs/archive/ioc-operation-map/ioc-operation-map.md`](../../archive/ioc-operation-map/ioc-operation-map.md) §1):取数协议全部走 GraphQL,因此 DQE 的 `formula` 与 `total_count` 都不可用;前端计算进页面协议而非下推数据侧,因为改表要走完整数据开发链路、周期不可控;应用外壳归已有门户,因此本批**没有**引入"多页应用"一等概念——[ADR-0048](../0048-navigation-intent-and-host-routing.md) 明确把它留给第二个多页应用出现时再裁决。

**协议增量与落地记录:** 本批的页面协议变更全部是纯增量——5.1 交付 IOC 基础能力,5.2 交付组合卡、分类明细、地图分档图例与提示扩展、`ratio.scale` 和单列键值面板([ADR-0052](../0052-dashboard-layout-form-backdrop-and-safe-area.md) 与 [ADR-0053](../0053-composite-card-component-level-grouping-container.md) 同属本批,形状细节见[页面文档结构与书写原则](./page-document-structure.md))。评审与落地记录见 [`docs/archive/ioc-operation-map/ioc-operation-map.md`](../../archive/ioc-operation-map/ioc-operation-map.md) 与 [`docs/archive/ioc-operation-map/ioc-project-map-wip-closeout.md`](../../archive/ioc-operation-map/ioc-project-map-wip-closeout.md)。每份 ADR 今天的状态以速查表为准,本页不重复列。
