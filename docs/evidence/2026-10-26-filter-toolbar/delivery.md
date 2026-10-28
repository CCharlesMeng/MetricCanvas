# main 交付验证

交付检出：`/Users/moon/.codex/worktrees/filter-toolbar-delivery/DataDashboard`。基线 `85144cb3ead6b61e859ab0ef8df43da43b29e7f5`，main 当时 Schema 为 6.62；本批工具栏作为增量 6.63 交付。此前记录中的 6.52 是旧工作区实施时的临时编号，以本次交付协议为准。

仅迁入本对话的下拉宽度修复、组合卡显式筛选工具栏、同场景示例、说明、测试及对应派生物。保留最新 main 中的 AI 总结、表格渲染、分页和可见列逻辑。契约、local-authoring 与 MC 内容从本检出重新生成。当前版本升级示例及 MC 诊断页面/回执由原生成器同步，未修改其业务流程或放宽测试。原工作区并行修改保持。

验证：

- `pnpm check`：全仓类型与 Svelte 检查通过；`pnpm build:packages` 构建通过。
- 项目 `pnpm test` 入口执行 11 个相关测试文件，197 项通过；包括版本、工具栏、筛选、组合卡、Sim、local-authoring 独立安装及升级。见 [delivery-tests.log](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/2026-10-26-filter-toolbar/delivery-tests.log)。
- UI Chrome 选择组件 9 项通过，含普通 DOM 与 ShadowRoot 宽度回归，见 [delivery-ui-browser.log](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/2026-10-26-filter-toolbar/delivery-ui-browser.log)。
- `pnpm authoring:contracts:check` 与 MC 来源覆盖检查通过；MC 内容 Python 30 项通过。诊断生成/校验最后在所有页面版本稳定后执行，见 [delivery-contracts-check.log](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/2026-10-26-filter-toolbar/delivery-contracts-check.log)、[delivery-fixtures-check.log](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/2026-10-26-filter-toolbar/delivery-fixtures-check.log)。
- 隔离 Playground 5178、DQE Sim 18232，实际三条件页面显示订单量 1,857；左边距 0、右边距 0、下拉间距 12px，各宽 160px，见 [delivery-browser.jpg](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/2026-10-26-filter-toolbar/delivery-browser.jpg)。
- AST 口径 `metriccanvas-ts-ast/1` / TypeScript 5.9.3：新分组函数 CC=5，新版本检测与谓词 CC=1/2，新测试回调 CC≤3；其他函数仅移入原行为或改固定版本表，无新增复杂度超限项。

Python 依赖复用已锁定依赖环境 `/tmp/mc-content-completeness-venv/bin/python`（FastMCP 3.4.7），未修改 requirements.lock 或 pnpm-lock.yaml。真实 DQE、Relay 与生产部署未复验。远端提交与精确 SHA 的 CI 结果由交付消息分别报告；本记录不将 push/规则 bypass 当作 CI 通过。
