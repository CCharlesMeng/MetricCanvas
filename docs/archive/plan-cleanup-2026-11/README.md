# 计划目录整理结论（2026-11-28）

## 1. 这批做了什么

本次结合 Wave 1 治理任务 `W1-2`，对 `docs/plan/` 中**已完成本仓实现与本地验收、已合入主线、或属于一次性历史交接/评测输入**且**在 `docs/adr/`、`docs/agents/`、源码、测试及构建脚本中均无引用**的 20 项计划/交接（共 22 个文件）进行安全归档，统一移入 `docs/archive/plan-cleanup-2026-11/`，并补齐 `docs/plan/README.md` 索引以消除未登记孤儿项。

说明：仍有未完成外部接入、尚未合并或被 `docs/adr/`、`docs/agents/`、原型及测试直接引用的计划与子目录继续保留在 `docs/plan/`，不破坏任何现有引用链。

## 2. 最终结论落在哪

| 归档主题 | 现行结论与代码/协议落点 |
|---|---|
| 下钻详情页自动返回（`6.96`） | [ADR-0048](../../adr/0048-navigation-intent-and-host-routing.md)、[导航协议](../../page-metadata/actions-and-navigation.md) 与统一运行时导航模块 |
| IOC Header 迁入 section 组件（`6.81`） | [IOC 页头组件协议](../../page-metadata/components/iocHeader.md)、[组件与容器协议](../../page-metadata/sections-and-layout.md)、`packages/page/src/header-binding.ts` |
| 重点国代与 IOC Region 约束 | [ADR-0124](../../adr/0124-ioc-region-single-tree.md)、[筛选协议](../../page-metadata/filters.md) |
| 图表局部筛选数据源候选（`6.90`） | [筛选协议](../../page-metadata/filters.md)、`packages/page/src/` |
| 指标卡前置连接文字（`6.34`） | [ADR-0111](../../adr/0111-metric-card-before-connection-layout.md)、[指标卡协议](../../page-metadata/components/metricCard.md) |
| 指标值切换同页 Tab（`6.126`） | [指标卡协议](../../page-metadata/components/metricCard.md)、`packages/page/src/metric-card.ts` |
| Dashboard 期间筛选（`6.27`） | [筛选协议](../../page-metadata/filters.md) |
| Report 高清 PNG 导出（`6.31`） | [ADR-0097](../../adr/0097-report-date-filter-and-instance-export-view.md) |
| DQE object 查询 | `packages/page/src/dqe-object.ts` 与[数据源协议](../../page-metadata/data-sources.md) |
| MC 内容包分发防护与 Report 章节组合审核 | `tools/mc-content/layouts/report-composition.md`、`tools/mc-content/` 与 `metriccanvas-authoring/` |
| local-authoring 上下文优化 | `metriccanvas-authoring/skill/metriccanvas-local-authoring/` |
| 页面试验场目录与数据联动改进 | `apps/playground/scenarios/` 与 `pages/README.md` |
| MetricCanvas UI 与页面管理历史交接 | `packages/ui/`、`apps/platform/` 与仍保留在 `docs/plan/` 的[实施计划](../../plan/2026-10-12-platform-ui-management-implementation.md) |
| 能力同步合并（`6.67`→`6.68`） | 已全部并入主线（当前页面 Schema 主次版本见 `packages/page/src/version.ts`） |

## 3. 过程中被推翻的方向与完整移动表

- **被推翻/不再维持的方向**：
  - Report 布局首轮审核中的 `C3-B`（阶段拆分为独立小表）被正式否定，保留 `C3-A` 单张分组表头表；
  - 独立评测/验收一次性 handoff（如 R3 评测与 2026-10-27 验收 brief）与历史能力合并手账（`6.67`→`6.68`）不再作为长期执行入口；
  - 归档不代表真实集成环境（真实 DQE、Relay、Java 页面资产服务、集成门户或 Edge 现场验证）已全部通过，相关外部集成验证继续遵循正式验收边界。

### 旧路径 → 新路径映射表（共 22 文件）

| 原路径 | 归档路径 |
|---|---|
| `docs/plan/2026-10-12-platform-ui-management-handoff.md` | `docs/archive/plan-cleanup-2026-11/2026-10-12-platform-ui-management-handoff.md` |
| `docs/plan/2026-10-15-dashboard-period-filter.md` | `docs/archive/plan-cleanup-2026-11/2026-10-15-dashboard-period-filter.md` |
| `docs/plan/2026-10-16-report-png-export.md` | `docs/archive/plan-cleanup-2026-11/2026-10-16-report-png-export.md` |
| `docs/plan/2026-10-19-metric-card-before-layout.md` | `docs/archive/plan-cleanup-2026-11/2026-10-19-metric-card-before-layout.md` |
| `docs/plan/2026-10-21-local-authoring-context-optimization.md` | `docs/archive/plan-cleanup-2026-11/2026-10-21-local-authoring-context-optimization.md` |
| `docs/plan/2026-10-23-dqe-object-query.md` | `docs/archive/plan-cleanup-2026-11/2026-10-23-dqe-object-query.md` |
| `docs/plan/2026-10-24-playground-information-architecture.md` | `docs/archive/plan-cleanup-2026-11/2026-10-24-playground-information-architecture.md` |
| `docs/plan/2026-10-27-report-container-principles-r3-handoff.md` | `docs/archive/plan-cleanup-2026-11/2026-10-27-report-container-principles-r3-handoff.md` |
| `docs/plan/2026-10-27-report-layout-acceptance-brief.md` | `docs/archive/plan-cleanup-2026-11/2026-10-27-report-layout-acceptance-brief.md` |
| `docs/plan/2026-10-27-report-layout-independent-r2-handoff.md` | `docs/archive/plan-cleanup-2026-11/2026-10-27-report-layout-independent-r2-handoff.md` |
| `docs/plan/2026-10-27-report-layout-mc-content-acceptance-handoff.md` | `docs/archive/plan-cleanup-2026-11/2026-10-27-report-layout-mc-content-acceptance-handoff.md` |
| `docs/plan/2026-10-27-report-layout-standards-review.md` | `docs/archive/plan-cleanup-2026-11/2026-10-27-report-layout-standards-review.md` |
| `docs/plan/2026-10-27-unmerged-capability-integration.md` | `docs/archive/plan-cleanup-2026-11/2026-10-27-unmerged-capability-integration.md` |
| `docs/plan/2026-10-29-key-office-filter-integration.md` | `docs/archive/plan-cleanup-2026-11/2026-10-29-key-office-filter-integration.md` |
| `docs/plan/2026-10-31-mc-content-distribution-hardening.md` | `docs/archive/plan-cleanup-2026-11/2026-10-31-mc-content-distribution-hardening.md` |
| `docs/plan/2026-10-31-mc-content-distribution-hardening/audit.md` | `docs/archive/plan-cleanup-2026-11/2026-10-31-mc-content-distribution-hardening/audit.md` |
| `docs/plan/2026-10-31-mc-content-distribution-hardening/complexity.md` | `docs/archive/plan-cleanup-2026-11/2026-10-31-mc-content-distribution-hardening/complexity.md` |
| `docs/plan/2026-10-31-mc-content-distribution-hardening/implementation.md` | `docs/archive/plan-cleanup-2026-11/2026-10-31-mc-content-distribution-hardening/implementation.md` |
| `docs/plan/2026-11-02-ioc-header-section-component.md` | `docs/archive/plan-cleanup-2026-11/2026-11-02-ioc-header-section-component.md` |
| `docs/plan/2026-11-05-filter-source-candidates.md` | `docs/archive/plan-cleanup-2026-11/2026-11-05-filter-source-candidates.md` |
| `docs/plan/2026-11-06-drill-through-auto-back.md` | `docs/archive/plan-cleanup-2026-11/2026-11-06-drill-through-auto-back.md` |
| `docs/plan/2026-11-19-metric-card-select-tab.md` | `docs/archive/plan-cleanup-2026-11/2026-11-19-metric-card-select-tab.md` |
