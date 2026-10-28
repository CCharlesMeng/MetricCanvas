# 本次交付范围

集成基线：`3ee6ef9d02c993bb109e8c5346879cc8bf3f81aa`。原主工作区的未提交修改不在本批范围。

手工真源、测试、示例与验收文件：

- `PAGE-METADATA.md`
- `docs/evidence/mc-content-layout/business-report.json`
- `docs/evidence/mc-content-layout/diagnostics.json`
- `docs/evidence/mc-content-layout/usage-report.json`
- `docs/evidence/metric-card-primary-detail/README.md`
- [docs/evidence/metric-card-primary-detail/browser-main.json](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/metric-card-primary-detail/browser-main.json)
- [docs/evidence/metric-card-primary-detail/browser.json](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/metric-card-primary-detail/browser.json)
- [docs/evidence/metric-card-primary-detail/complexity-main.json](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/metric-card-primary-detail/complexity-main.json)
- [docs/evidence/metric-card-primary-detail/complexity.json](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/metric-card-primary-detail/complexity.json)
- [docs/evidence/metric-card-primary-detail/desktop.png](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/metric-card-primary-detail/desktop.png)
- [docs/evidence/metric-card-primary-detail/mobile.png](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/metric-card-primary-detail/mobile.png)
- [docs/evidence/metric-card-primary-detail/standalone-main.json](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/metric-card-primary-detail/standalone-main.json)
- [docs/evidence/metric-card-primary-detail/standalone.json](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/metric-card-primary-detail/standalone.json)
- `docs/page-metadata/components/metricCard.md`
- `docs/page-metadata/reference-map.json`
- `packages/engine/widgets/src/components/metric-card/MetricCard.svelte`
- `packages/engine/widgets/tests/composite-card-surface.test.ts`
- `packages/engine/widgets/tests/responsive-contract.test.ts`
- `packages/engine/widgets/tests/responsive-fixtures.ts`
- `packages/page/fixtures/contract-valid/metric-card-primary-detail.json`
- `packages/page/src/metric-card.ts`
- `packages/page/src/schema/components/metric-card.ts`
- `packages/page/src/validate.ts`
- `packages/page/src/version.ts`
- `packages/page/tests/metric-primary-detail.test.ts`
- `packages/page/tests/pie-table-legend.test.ts`
- `packages/page/tests/version.test.ts`
- `pages/README.md`
- `pages/capabilities/layout/README.md`
- `pages/capabilities/layout/mc-content-layout-demo.json`
- `pages/capabilities/layout/mc-layout-business-report.json`
- `pages/capabilities/layout/mc-layout-usage-report.json`
- `pages/capabilities/layout/metric-card-primary-detail.json`
- `pages/capabilities/layout/schema-upgrade-demo.json`
- `tools/scripts/page-conformance-vectors.ts`

其余均由当前产品真源的authoring:contracts生成，涵盖产品契约、local-authoring、MC和既有分发投影；未手工合并生成脚本或哈希。

- `metriccanvas-authoring/`：1025项生成差异。
- `contracts/`：73项生成差异。

MC诊断页与报告由mc:content:fixtures生成；旧页升级示例从冻结旧输入经独立CLI重建，仅同步版本。
