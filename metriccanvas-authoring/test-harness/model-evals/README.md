# 创作主流程评测

当前入口使用 Platform protocol 2.0 和现行 `metriccanvas-platform-authoring` Skill。范围只含创建页面与调整页面：report/dashboard 创建、纯配置调整，以及新增不同口径的数据组件。参数、发布、回退、删除、普通问数和 AI 总结不计入本轮通过率。

所有命令从仓库根目录运行，Python 使用 `metriccanvas-authoring/tool/.venv/bin/python`；输出文件或目录必须是新路径。

| 目的 | 命令 | 证据 |
|---|---|---|
| 无模型预检 | `metriccanvas-authoring/tool/.venv/bin/python metriccanvas-authoring/test-harness/model-evals/preflight.py --surface unified-content --output /tmp/main-flow-preflight.json` | 九工具 Schema、Skill 注入源与 hash；模型请求为 0 |
| 确定性主流程 | `metriccanvas-authoring/tool/.venv/bin/python metriccanvas-authoring/test-harness/model-evals/run_platform_v2.py --scripted --output /tmp/main-flow-scripted` | 五个 case 通过同一 stdio、正式工厂和 HTTP Adapter；模型请求为 0 |
| 真实模型主流程 | `metriccanvas-authoring/tool/.venv/bin/python metriccanvas-authoring/test-harness/model-evals/run_platform_v2.py --output /tmp/main-flow-model` | 从 `apps/platform/.env` 读取已授权的 `deepseek-v4-flash` 配置，执行同一清单 |
| 选择 case | 在 runner 命令中增加 `--cases edit-add-data` | 自动执行其依赖；report 区分 requestedCases、executedCases 和 notRun |
| 保存后浏览器重开 | `node apps/platform/tests/workbench/main-flow-browser.mjs /tmp/main-flow-scripted/edit-report/artifact.json /tmp/main-flow-browser` | 真实 Platform 工作台从本地 Java 替身 GET 保存文档并重新请求 DQE，检查 1440/640 几何并截图 |

runner 每个 case 输出 `trajectory.json`、`artifact.json`、`document.json`、`result.json` 和脱敏 `http.jsonl`；根目录输出 `report.json`、完整 HTTP 日志、Skill hash 与场景 hash。脚本模式的 `evidenceKind` 是 deterministic，不能当作真实模型证据。首次失败输出应保留，修复后的运行写入新目录。

本地 HTTP 服务严格匹配受支持的语义、查询、身份和条件修订，页面资产在一次 runner 会话内跨 stdio 进程保存。只有 `modelSummary` 进入模型通道；物理 SQL、完整页面和预览留在程序通道。

这些结果证明本地受控链路和自主模型行为，不证明真实 Java 权限、生产 DQE、Relay 身份注入或生产发布联调。`history/` 与冻结证据保留历史语义，不能计为当前平台通过。
