# IOC Region 最终 JSON 变更清单

2026-11-02。基于当前独立工作树相对交付基线 `bf2cc88ebc257a328bf74dbe41b60143f0755df3` 的最终差异：56 个原有 JSON 修改、27 个新 JSON，合计 83 个产品/分发与派生验收 JSON。验收回执另列，不冒充业务页面。

业务示例新增 `pages/capabilities/filters/ioc-region-url-demo.json`，另由 MC 生成器更新 `pages/capabilities/layout/mc-content-layout-demo.json` 的主题计数；16 个原有活动 IOC 页面恢复原声明，没有批量修改。页面 Schema JSON 与版本策略未改，仍为 6.78。Skill 最终版本为 1.16.0，仅本工作树分发目录已更新，未同步主工作区或外部安装副本。

## 产品契约与参考（10）

- [contracts/metriccanvas/manifest.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/contracts/metriccanvas/manifest.json)
- [contracts/metriccanvas/page/conformance/coverage.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/contracts/metriccanvas/page/conformance/coverage.json)
- [contracts/metriccanvas/page/conformance/invalid/ioc-region-url-no-custom-map.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/contracts/metriccanvas/page/conformance/invalid/ioc-region-url-no-custom-map.json)
- [contracts/metriccanvas/page/conformance/invalid/ioc-region-url-reserved-key.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/contracts/metriccanvas/page/conformance/invalid/ioc-region-url-reserved-key.json)
- [contracts/metriccanvas/page/conformance/valid/ioc-region-url-demo.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/contracts/metriccanvas/page/conformance/valid/ioc-region-url-demo.json)
- [contracts/metriccanvas/page/reference/errors/ioc-region-url-no-custom-map.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/contracts/metriccanvas/page/reference/errors/ioc-region-url-no-custom-map.json)
- [contracts/metriccanvas/page/reference/errors/ioc-region-url-reserved-key.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/contracts/metriccanvas/page/reference/errors/ioc-region-url-reserved-key.json)
- [contracts/metriccanvas/page/reference/examples/ioc-region-url-demo.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/contracts/metriccanvas/page/reference/examples/ioc-region-url-demo.json)
- [contracts/metriccanvas/page/reference/index.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/contracts/metriccanvas/page/reference/index.json)
- [contracts/metriccanvas/page/reference/rules.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/contracts/metriccanvas/page/reference/rules.json)

## 手写协议索引（1）

- [docs/page-metadata/reference-map.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/docs/page-metadata/reference-map.json)

## 契约与分发锁（2）

- [metriccanvas-authoring/bundle.lock.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/bundle.lock.json)
- [metriccanvas-authoring/contract-lock.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/contract-lock.json)

## 契约快照（10）

- [metriccanvas-authoring/contract-snapshot/manifest.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/contract-snapshot/manifest.json)
- [metriccanvas-authoring/contract-snapshot/page/conformance/coverage.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/contract-snapshot/page/conformance/coverage.json)
- [metriccanvas-authoring/contract-snapshot/page/conformance/invalid/ioc-region-url-no-custom-map.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/contract-snapshot/page/conformance/invalid/ioc-region-url-no-custom-map.json)
- [metriccanvas-authoring/contract-snapshot/page/conformance/invalid/ioc-region-url-reserved-key.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/contract-snapshot/page/conformance/invalid/ioc-region-url-reserved-key.json)
- [metriccanvas-authoring/contract-snapshot/page/conformance/valid/ioc-region-url-demo.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/contract-snapshot/page/conformance/valid/ioc-region-url-demo.json)
- [metriccanvas-authoring/contract-snapshot/page/reference/errors/ioc-region-url-no-custom-map.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/contract-snapshot/page/reference/errors/ioc-region-url-no-custom-map.json)
- [metriccanvas-authoring/contract-snapshot/page/reference/errors/ioc-region-url-reserved-key.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/contract-snapshot/page/reference/errors/ioc-region-url-reserved-key.json)
- [metriccanvas-authoring/contract-snapshot/page/reference/examples/ioc-region-url-demo.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/contract-snapshot/page/reference/examples/ioc-region-url-demo.json)
- [metriccanvas-authoring/contract-snapshot/page/reference/index.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/contract-snapshot/page/reference/index.json)
- [metriccanvas-authoring/contract-snapshot/page/reference/rules.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/contract-snapshot/page/reference/rules.json)

## MC 内容包（43）

- [metriccanvas-authoring/mc-content/index.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/mc-content/index.json)
- [metriccanvas-authoring/mc-content/knowledge/actions-and-navigation.overview.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/mc-content/knowledge/actions-and-navigation.overview.json)
- [metriccanvas-authoring/mc-content/knowledge/actions-and-navigation.section-0fa29653.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/mc-content/knowledge/actions-and-navigation.section-0fa29653.json)
- [metriccanvas-authoring/mc-content/knowledge/actions-and-navigation.section-43dfac61.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/mc-content/knowledge/actions-and-navigation.section-43dfac61.json)
- [metriccanvas-authoring/mc-content/knowledge/actions-and-navigation.section-8044e7e5.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/mc-content/knowledge/actions-and-navigation.section-8044e7e5.json)
- [metriccanvas-authoring/mc-content/knowledge/actions-and-navigation.section-8e9f2f0d.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/mc-content/knowledge/actions-and-navigation.section-8e9f2f0d.json)
- [metriccanvas-authoring/mc-content/knowledge/actions-and-navigation.section-b71ad302.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/mc-content/knowledge/actions-and-navigation.section-b71ad302.json)
- [metriccanvas-authoring/mc-content/knowledge/filters.futureTime.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/mc-content/knowledge/filters.futureTime.json)
- [metriccanvas-authoring/mc-content/knowledge/filters.overview.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/mc-content/knowledge/filters.overview.json)
- [metriccanvas-authoring/mc-content/knowledge/filters.period.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/mc-content/knowledge/filters.period.json)
- [metriccanvas-authoring/mc-content/knowledge/filters.section-1124728a.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/mc-content/knowledge/filters.section-1124728a.json)
- [metriccanvas-authoring/mc-content/knowledge/filters.section-19a999cb.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/mc-content/knowledge/filters.section-19a999cb.json)
- [metriccanvas-authoring/mc-content/knowledge/filters.section-2bd436ef.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/mc-content/knowledge/filters.section-2bd436ef.json)
- [metriccanvas-authoring/mc-content/knowledge/filters.section-33987daa.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/mc-content/knowledge/filters.section-33987daa.json)
- [metriccanvas-authoring/mc-content/knowledge/filters.section-5838935b.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/mc-content/knowledge/filters.section-5838935b.json)
- [metriccanvas-authoring/mc-content/knowledge/filters.section-6328469e.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/mc-content/knowledge/filters.section-6328469e.json)
- [metriccanvas-authoring/mc-content/knowledge/filters.section-659e5fe6.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/mc-content/knowledge/filters.section-659e5fe6.json)
- [metriccanvas-authoring/mc-content/knowledge/filters.section-68726eb3.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/mc-content/knowledge/filters.section-68726eb3.json)
- [metriccanvas-authoring/mc-content/knowledge/filters.section-6cfc7bce.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/mc-content/knowledge/filters.section-6cfc7bce.json)
- [metriccanvas-authoring/mc-content/knowledge/filters.section-8044e7e5.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/mc-content/knowledge/filters.section-8044e7e5.json)
- [metriccanvas-authoring/mc-content/knowledge/filters.section-868890a7.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/mc-content/knowledge/filters.section-868890a7.json)
- [metriccanvas-authoring/mc-content/knowledge/filters.section-978d773b.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/mc-content/knowledge/filters.section-978d773b.json)
- [metriccanvas-authoring/mc-content/knowledge/filters.section-b71ad302.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/mc-content/knowledge/filters.section-b71ad302.json)
- [metriccanvas-authoring/mc-content/knowledge/filters.section-e50ee65a.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/mc-content/knowledge/filters.section-e50ee65a.json)
- [metriccanvas-authoring/mc-content/knowledge/filters.section-e52ee450.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/mc-content/knowledge/filters.section-e52ee450.json)
- [metriccanvas-authoring/mc-content/knowledge/filters.time.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/mc-content/knowledge/filters.time.json)
- [metriccanvas-authoring/mc-content/knowledge/filters.timeModes.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/mc-content/knowledge/filters.timeModes.json)
- [metriccanvas-authoring/mc-content/knowledge/filters.timePoint.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/mc-content/knowledge/filters.timePoint.json)
- [metriccanvas-authoring/mc-content/mc-content.version.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/mc-content/mc-content.version.json)
- [metriccanvas-authoring/mc-content/product-contracts/manifest.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/mc-content/product-contracts/manifest.json)
- [metriccanvas-authoring/mc-content/product-contracts/page/conformance/coverage.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/mc-content/product-contracts/page/conformance/coverage.json)
- [metriccanvas-authoring/mc-content/product-contracts/page/conformance/invalid/ioc-region-url-no-custom-map.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/mc-content/product-contracts/page/conformance/invalid/ioc-region-url-no-custom-map.json)
- [metriccanvas-authoring/mc-content/product-contracts/page/conformance/invalid/ioc-region-url-reserved-key.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/mc-content/product-contracts/page/conformance/invalid/ioc-region-url-reserved-key.json)
- [metriccanvas-authoring/mc-content/product-contracts/page/conformance/valid/ioc-region-url-demo.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/mc-content/product-contracts/page/conformance/valid/ioc-region-url-demo.json)
- [metriccanvas-authoring/mc-content/references/authoring-knowledge/model.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/mc-content/references/authoring-knowledge/model.json)
- [metriccanvas-authoring/mc-content/references/page-metadata/errors/ioc-region-url-no-custom-map.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/mc-content/references/page-metadata/errors/ioc-region-url-no-custom-map.json)
- [metriccanvas-authoring/mc-content/references/page-metadata/errors/ioc-region-url-reserved-key.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/mc-content/references/page-metadata/errors/ioc-region-url-reserved-key.json)
- [metriccanvas-authoring/mc-content/references/page-metadata/examples/ioc-region-url-demo.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/mc-content/references/page-metadata/examples/ioc-region-url-demo.json)
- [metriccanvas-authoring/mc-content/references/page-metadata/index.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/mc-content/references/page-metadata/index.json)
- [metriccanvas-authoring/mc-content/references/page-metadata/rules.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/mc-content/references/page-metadata/rules.json)
- [metriccanvas-authoring/mc-content/runtime/contract-alignment.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/mc-content/runtime/contract-alignment.json)
- [metriccanvas-authoring/mc-content/runtime/coverage.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/mc-content/runtime/coverage.json)
- [metriccanvas-authoring/mc-content/runtime/source-identity.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/mc-content/runtime/source-identity.json)

## local-authoring Skill（7）

- [metriccanvas-authoring/skill/metriccanvas-local-authoring/references/authoring-knowledge/model.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/skill/metriccanvas-local-authoring/references/authoring-knowledge/model.json)
- [metriccanvas-authoring/skill/metriccanvas-local-authoring/references/knowledge.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/skill/metriccanvas-local-authoring/references/knowledge.json)
- [metriccanvas-authoring/skill/metriccanvas-local-authoring/references/page-metadata/errors/ioc-region-url-no-custom-map.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/skill/metriccanvas-local-authoring/references/page-metadata/errors/ioc-region-url-no-custom-map.json)
- [metriccanvas-authoring/skill/metriccanvas-local-authoring/references/page-metadata/errors/ioc-region-url-reserved-key.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/skill/metriccanvas-local-authoring/references/page-metadata/errors/ioc-region-url-reserved-key.json)
- [metriccanvas-authoring/skill/metriccanvas-local-authoring/references/page-metadata/examples/ioc-region-url-demo.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/skill/metriccanvas-local-authoring/references/page-metadata/examples/ioc-region-url-demo.json)
- [metriccanvas-authoring/skill/metriccanvas-local-authoring/references/page-metadata/index.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/skill/metriccanvas-local-authoring/references/page-metadata/index.json)
- [metriccanvas-authoring/skill/metriccanvas-local-authoring/references/page-metadata/rules.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/skill/metriccanvas-local-authoring/references/page-metadata/rules.json)

## 同源兼容参考投影（5）

- [metriccanvas-authoring/skill/metriccanvas-page-builder/references/page-metadata/errors/ioc-region-url-no-custom-map.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/skill/metriccanvas-page-builder/references/page-metadata/errors/ioc-region-url-no-custom-map.json)
- [metriccanvas-authoring/skill/metriccanvas-page-builder/references/page-metadata/errors/ioc-region-url-reserved-key.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/skill/metriccanvas-page-builder/references/page-metadata/errors/ioc-region-url-reserved-key.json)
- [metriccanvas-authoring/skill/metriccanvas-page-builder/references/page-metadata/examples/ioc-region-url-demo.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/skill/metriccanvas-page-builder/references/page-metadata/examples/ioc-region-url-demo.json)
- [metriccanvas-authoring/skill/metriccanvas-page-builder/references/page-metadata/index.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/skill/metriccanvas-page-builder/references/page-metadata/index.json)
- [metriccanvas-authoring/skill/metriccanvas-page-builder/references/page-metadata/rules.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/metriccanvas-authoring/skill/metriccanvas-page-builder/references/page-metadata/rules.json)

## 页面 JSON（2）

- [pages/capabilities/filters/ioc-region-url-demo.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/pages/capabilities/filters/ioc-region-url-demo.json)

- [pages/capabilities/layout/mc-content-layout-demo.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/pages/capabilities/layout/mc-content-layout-demo.json)

## MC 诊断派生夹具（3）

- [docs/evidence/mc-content-layout/business-report.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/docs/evidence/mc-content-layout/business-report.json)
- [docs/evidence/mc-content-layout/diagnostics.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/docs/evidence/mc-content-layout/diagnostics.json)
- [docs/evidence/mc-content-layout/usage-report.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/docs/evidence/mc-content-layout/usage-report.json)

## 本地验收 JSON（不属于业务页面或生成分发清单）

- [complexity.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/docs/evidence/ioc-region-url-20261102/complexity.json)
- [default-complexity.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/docs/evidence/ioc-region-url-20261102/default-complexity.json)
- [default-standalone-skill-1.15.0.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/docs/evidence/ioc-region-url-20261102/default-standalone-skill-1.15.0.json)
- [default-standalone-skill.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/docs/evidence/ioc-region-url-20261102/default-standalone-skill.json)
- [standalone-skill.json](/Users/moon/.codex/worktrees/ioc-region-url/DataDashboard/docs/evidence/ioc-region-url-20261102/standalone-skill.json)

`default-standalone-skill.json` 为最终 Skill 1.16.0 回执；带 1.15.0 的回执及显式映射方案记录仅保留为已替代的过程证据。
