# main 交付验收

2026-10-15。隔离检出 `chart-filter-delivery/DataDashboard`，最终基线 `9f1e5431c48691f1cad4be9c30963a8972dce850`。原工作区未提交修改未移入。本次能力使用 Schema 6.29；早期 6.26 过程记录不作为最终协议版本。

期间筛选基线 `d38959c9` 之后只纳入 Python Bridge 的复杂度重构。`ui-input-sha256.json` 保存 UI/查询验收输入；逐项复核 apps、packages、tools 与锁文件摘要与最终输入相同。最终 Python Bridge 另执行规则层与复杂度检查。

## 最终输入与检查

`input-sha256.json` 记录最终基线、全部本批产品/派生文件和锁文件摘要。保留 main 的 PDF、期间筛选及其他并行提交；共享筛选状态按两边意图合并，全部协议派生物从该检出重新生成。

- `pnpm test` 定向运行 chart-local-filter、chart-filter-state、Sim、version、canonical-writers、report-date-filters、public-api、page-reference、local-authoring-skill、两组 period-filter：11 文件 83 项通过。另运行 period-execution，3 项通过。
- `pnpm check`：通过，所有 Svelte 检查 0 错误/0 警告。
- `pnpm build:packages && pnpm --filter @metriccanvas/embed build`：通过。
- Playwright 在独立端口 4286 启动当前 embed 构建，Chrome/headless，直接读取正式页面；chart-local-filter 3 项通过，period-filter 3 项通过，无跳过。使用 `output/chart-filter-delivery/playwright.config.cjs`，webServer 命令 `node tests/serve.mjs`，环境 `MC_EMBED_EXAMPLE_PORT=4286`，不复用用户预览端口 4175。
- `pnpm authoring:contracts:check`：725 product / 4 authoring / 1 interface，产物一致。`python3 metriccanvas-authoring/scripts/check_bundle.py`：2631 摘要检查通过。
- 最终 Python Bridge：`run_tests.py --layer rules` 156 项通过；`check-authoring-complexity.py`（radon 6.0.1）364 函数、最大复杂度 15、0 超限。
- 本地 Skill 测试实际将完整安装目录复制到仓外，验证链接、内容摘要、页面及全部契约向量；包含在上述 83 项中。

## 较早基线的完整回归与限制

`full-suite.txt`、`authoring.txt` 来自前一基线 `b57fff40da91a2f7341bf0fd3dd2e88d80cf36ff`：全量 JavaScript 2108 通过、4 跳过、2 超时失败；Python 537 项通过、跳过 1 项，确定性脚本不调用模型。不得将这些结果当作最终合并基线的全量验收。

两个超时分别为复制 Bundle 的默认 5 秒预算（本批改为 30 秒，最终定向 6 项通过）与本地模型评估产物隔离用例的 30 秒子进程预算（独立重试 1 项通过，其他 18 项未运行）。后者未放宽产品/子进程超时。最终完整结果以本次提交 CI 为准。

历史执行过一次兼容性命令，但该工具默认消费 Git HEAD，当时输入是旧 main，因此不将该结果作为本功能证据。最终提交的安装消费者检查交由 CI 对精确提交执行。

浏览器与 Sim 为合成数据。真实 DQE、Relay、DS 模型、部署未执行。
