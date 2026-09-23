# 平台创作 0.3.1 本仓交付与轻量验收

日期：2026-09-23。范围依据 `docs/plan/2026-09-23-authoring-deployment-readiness-plan.md` 及用户确认的轻量验收边界。结论为**本仓完成，待内部 Adapter 接线与真实环境验证**。`ready` 仅表示页面产物已由内部 Adapter 精确接收，不表示用户已看到页面。

## 本仓实施

- 依据既有 DQE 查询样本和语义证据建立[结果字段来源对照](2026-09-23-authoring-result-field-sources.md)。普通查询的结果字段契约及查询字段映射从数据上下文和查询定义派生；按月时间字段使用真实结果键。稳定字段 ID 限于当前页面来源的确定性身份。未知金额、百分比尺度不推断；额外字段提供方保持可选，供确有来源的字段重映射、尺度和格式使用。
- 正式入口缺可信提供方时失败关闭；公共就绪报告分别说明提供方装配、按操作缺配与实际当前轮次。普通创建/编辑不因参数能力未配置受阻。包外入口示例使用同轮共享 SQLite 工作状态，复用现有生命周期 HTTP Adapter；不修改 Relay 核心。
- 固化 Adapter 可信边界、确认范围与请求及版本的绑定、未知保存冻结与核对、精确产物交接回执及失败语义。Skill 将装配、轮次、取数、保存、交接失败分别处理，不把 `ready` 解释为页面显示回执。
- SQLite 连接在状态操作后释放；DQE 响应校验覆盖全部行并拒绝非有限数；页面验证兼容既有时间列名及本次派生的粒度列名。
- 正式协议、Skill、包内快照与锁文件通过 `pnpm authoring:contracts` 生成到 0.3.1。九个 MCP 工具保持不变。

## 分层验证

| 层 | 执行与结果 | 限度 |
|---|---|---|
| 单元、Adapter、交付与评价测试 | `metriccanvas-authoring/tool/.venv/bin/python metriccanvas-authoring/test-harness/run_tests.py`：51 个文件，416 项通过；测试清单 `--check` 通过 | 本地测试与替身 |
| 页面与类型 | `pnpm --filter @metriccanvas/page exec vitest run tests/dqe-query.test.ts`：11 项通过；`pnpm --filter platform check`：0 错误、0 警告 | 本地静态/单元检查 |
| 契约与 Skill | `pnpm authoring:contracts:check`、`check_bundle.py`、Skill quick validator：通过；`git diff --check`：通过 | 生成副本与 0.3.1 锁一致 |
| 无模型预检 | `preflight.py --surface unified-content`：通过；9 个工具，模型请求 0 | 协议发现使用显式 discovery 模式 |
| 确定性主流程 | `run_platform_v2.py --scripted`：创建和编辑共 6 例通过，模型调用 0；每次工具调用独立 stdio 子进程，保持同轮状态 | 本地 HTTP 替身和脚本化业务输入 |
| 包外分发 | wheel、sdist 分别安装到仓库外 Python 3.12 虚拟环境并导入 0.3.1 包与内嵌契约；wheel 的九工具 stdio 发现通过；sdist 的未配置正式入口返回退出码 2、缺配报告且标准输出为空 | 未接真实内部 Adapter |
| 固定包完整性 | ZIP CRC 通过；解包后 `shasum -a 256 -c SHA256SUMS`：1081 项通过，`python3 scripts/check_bundle.py`：1613 项摘要通过；ZIP 哈希与侧车文件一致 | 仅证明交付文件完整性 |
| 真实 DS、浏览器、内部联调 | **not-run**；DS 试运行在用户收窄验收范围时中止，未形成结果；浏览器未启动 | 不声称真实模型或生产集成通过 |

## 固定版本产物

交付 ZIP：`metriccanvas-authoring/dist/metriccanvas-authoring-0.3.1-deployment.zip`。内部文件含 wheel、sdist、两个 Skill、正式契约、契约快照、锁文件、字段来源核查、包外示例和 `INTERNAL-VALIDATION-0.3.1.md`。同目录 `.zip.sha256` 为整体签收哈希，ZIP 内 `SHA256SUMS` 为逐文件校验。

| 文件 | SHA-256 |
|---|---|
| `metriccanvas-authoring-0.3.1-deployment.zip` | `090d8f23b0ed43ee19976c4b7762dfb647eca4c3a0cae18d423bbdcb69e5f703` |
| `metriccanvas_authoring-0.3.1-py3-none-any.whl` | `5cb32a577ef50d4e62fa2d78cf7146fe26056b5290b37c9bdc0382b209e3e8ee` |
| `metriccanvas_authoring-0.3.1.tar.gz` | `1743a35e24ee6011772a17b62f75de0d7b0321a8cbd5ac798d4db2887956af42` |

## 内部待办与回传

内部实现 `create_host_adapters()` 所需的可信当前轮次、身份、确认授权、数据上下文、DQE 与产物交接 Adapter；提供稳定共享工作状态和真实生命周期服务配置。依照 ZIP 内 `INTERNAL-VALIDATION-0.3.1.md` 执行逐次 oneshot 的装配、轮次、授权、查询、保存、交接与失败向量，使用其中 JSON 模板脱敏回传。跨节点迁移、实例故障恢复、前端显示回执、参数业务全链路、发布和删除属于后续范围。

本次没有改动工作区中已暂存的其他任务文件，也没有整体暂存。
