# MetricCanvas UI 与页面管理工程设计

依据：../2026-10-12-platform-page-management-design.md、../2026-10-12-platform-os-theme-component-architecture.md、../2026-10-12-platform-ui-management-implementation.md。

## 工程决策

REQ-DEC-1：UI 独立包与独立版本，四产品包仍锁步；共用构建/CI。REQ-DEC-2：UI 不导入 page/engine/DQE/ECharts/页面资产，领域适配器拥有协议校验。REQ-DEC-3：固定官方 OS Theme 样式在组件内拥有，不覆盖 RuntimeView。REQ-DEC-4：实例拥有工作会话，人工本地保护与明确远端保存分离，AI 工具单次保存保持。REQ-DEC-5：服务能力未知不开放危险资产操作，不猜 DTO。

用户在 2026-10-12 本会话明确授权实施并连续推进，无需阶段审批。该授权覆盖既定基线及阶段推进；新增实质规格冲突仍单独报告。
