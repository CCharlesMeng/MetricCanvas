# Skill 对接 DS 模型验收流程

本流程用于 MetricCanvas Skill 新增或调整后，对接 DS（DeepSeek）真实模型并验收创作期主流程。工具 Schema、MCP 组合根、数据与页面资产 Adapter、Skill 引导或模型传输层发生变更时，也按本流程回归。

“对接 DS 模型通过”只表示真实模型在受控测试组合中完成了已声明用例。生产身份、生产数据、保存/发布、Relay 及其他外部服务需要各自的真实联调证据。

## 1. 冻结验收面

改代码前写出用例矩阵。每个用例必须声明用户指令、创作轮次模式、创作基线、所需数据上下文快照、允许工具、预期业务结果和禁止变化。同步列出排除流程，报告通过率时不把排除项计入分母。

下列变化先进行 grill，取得明确决定后再实施：

- 生产组合入口或工具可见性；
- 身份、权限或用户确认归属；
- 页面保存、发布或修订所有权；
- 页面协议、页面文档格式或兼容策略；
- Relay 职责、完整产物/模型摘要通道；
- 扩张用户已限定的主流程范围。

普通失败修复、夹具数据、日志、随机端口和断言完善属于验收实现，不单独触发架构决策。

**完成判据：** 用例和排除项已进入机器可读清单；所有架构变化都有现行决策依据或已完成 grill。

## 2. 分层验收

每层使用独立结论。低层通过不会自动使高层通过。

| 层次 | 要证明的事 | 不能替代的证据 |
|---|---|---|
| 无模型预检 | Skill 源、工具名称与输入 Schema 已就绪 | 模型会按流程调用工具 |
| 确定性主流程 | 用例、MCP stdio、正式组合根、HTTP Adapter 和评分器可重放 | 真实 DS 模型行为 |
| 真实模型 | 固定模型配置下，Skill 能驱动同一工具链完成用例 | 页面协议、业务组织或视觉已合格 |
| 页面产物 | 最终 `document.json` 可直接消费，数据、差分与业务含义正确 | 保存后的真实渲染与重新取数 |
| 浏览器 | 已保存页面重开、重新请求 DQE，且宽窄屏可读 | 生产 Java/Relay 联调 |
| 回归与分发 | 代码、契约和 Bundle 在最终文件树上自洽 | 上述任一业务层结论 |

每次执行先建立全新的证据根目录；后续命令共用这三个变量：

```sh
RUN_TAG="$(date +%Y%m%d-%H%M%S)"
EVIDENCE_ROOT="/tmp/metriccanvas-skill-${RUN_TAG}"
AUTHORING_PYTHON="metriccanvas-authoring/tool/.venv/bin/python"
mkdir -p "$EVIDENCE_ROOT"
```

### 2.1 无模型预检

1. 从当前 Skill 和用例清单读取注入源，记录文件 hash。
2. 通过 MCP introspection 检查实际注册的工具名称和输入 Schema。
3. 验证模型不能自报身份、授权、创作基线 token 或其他宿主事实。
4. 预检不读取模型密钥、不发模型请求；报告的 `modelRequests` 必须为 `0`。

当前 Platform 创作 Skill 的入口：

```sh
"$AUTHORING_PYTHON" \
  metriccanvas-authoring/test-harness/model-evals/preflight.py \
  --surface unified-content \
  --output "$EVIDENCE_ROOT/preflight.json"
```

**完成判据：** 进程退出码为零，introspection 通过，注入源无缺失，无历史路径或旧工具前置残留。

### 2.2 确定性主流程

1. 确定性传输与真实模型共用用例清单、MCP stdio 子进程、正式平台组合根、HTTP Adapter、工具执行器和验收器。
2. 夹具只提供可信宿主事实：身份、创作基线、授权、源描述、Java 语义、DQE 结果和页面资产。模型参数中不增加设置这些事实的测试后门。
3. 创建与调整分开创作轮次。调整轮次通过已保存资产重建创作基线，不依赖创建进程的内存页面。
4. 取数用例经过语义发现和真实 HTTP DQE 路径；配置调整用例断言取数次数为零。
5. 为错身份、未知查询、过期修订和非法页面保留失败关闭的负向探针，防止固定响应造成假绿。

```sh
"$AUTHORING_PYTHON" \
  metriccanvas-authoring/test-harness/model-evals/run_platform_v2.py \
  --scripted \
  --output "$EVIDENCE_ROOT/scripted"
```

**完成判据：** 所有必需用例通过；报告列出 requested、executed 和 not-run；`modelCalls=0`；HTTP 日志证明预期的语义、DQE 与页面资产路径确实被调用。

### 2.3 真实 DS 模型

1. 使用与确定性阶段相同的用例和工具执行链，真实模型只替换传输层。
2. 冻结模型名、采样参数、请求上限和 token 预算；当前 runner 从 `apps/platform/.env` 读取已授权配置，报告记录非秘密配置与用量，不复制密钥。
3. 模型只接收用户需求、Skill、工具 Schema 和可信有界证据。预期页面 JSON、确定性工具调用脚本和评分器规则不进入模型消息。
4. 保留首次运行和每次重试目录。重试必须对应已记录的外部瞬断、预算问题或代码/Skill 修复，不删除失败轨迹。
5. 每个必需用例至少有一条真实模型通过轨迹。发布前优先取得同一次全量运行全绿；若外部连接阻止这一点，可报告“按用例合并完整”，同时明确“未取得单次全量全绿”。

```sh
"$AUTHORING_PYTHON" \
  metriccanvas-authoring/test-harness/model-evals/run_platform_v2.py \
  --output "$EVIDENCE_ROOT/model"
```

**完成判据：** 每个必需用例有可归因的真实模型结论；工具轨迹符合 Skill 流程和预算；所有失败、阻塞与重试均在报告中可见。

### 2.4 最终页面产物

验收对象是可直接消费的 `document.json`；`artifact.json` 只用于校验产物引用、保存回执和程序通道。逐项检查：

- 页面文档通过当前作者版本 Schema 校验；
- 时间、单位、指标、维度、筛选和行数据与 DQE 证据一致；
- 业务章节、主次信息、图表/明细关系与用户需求一致；
- 纯配置调整只改授权字段，其他页面内容精确相等，且不重新取数；
- 新增数据组件保留原组件与数据源，只增加本轮获授权的查询、结果引用和必要布局；
- 模型消息、产物与脱敏日志不含凭据、物理 SQL 或提供方私有错误原文。

**完成判据：** 页面 Schema、数据和业务组织分别有明确断言；局部调整有创作基线差分证据；人工检查直接打开 `document.json`，不从模型最终文字推测页面内容。

### 2.5 保存后浏览器验收

1. 用页面资产模拟服务播种已保存的真实模型产物，由 Platform 工作台重新打开。
2. 断言浏览器通过正式数据网关重新请求 DQE，不只消费 `previewJson` 的初始行。
3. 检查标题、关键业务值、单位与期间，记录 pageerror 和 DQE 调用。
4. 至少在宽屏与窄屏检查横向溢出、组件重叠/截断和内容层次，保留截图并人工查看。几何断言通过不代表业务组织和视觉质量自动合格。

当前脚本接收“产物路径 + 全新输出目录”两个位置参数：

```sh
node apps/platform/tests/workbench/main-flow-browser.mjs \
  "$EVIDENCE_ROOT/model/edit-report/artifact.json" \
  "$EVIDENCE_ROOT/browser"
```

**完成判据：** `browser-report.json` 通过，HTTP 日志存在重开后的 DQE 请求，所有要求视口的截图已人工查看并记录结论。

### 2.6 回归与分发自洽

```sh
metriccanvas-authoring/tool/.venv/bin/python metriccanvas-authoring/test-harness/run_tests.py --check
metriccanvas-authoring/tool/.venv/bin/python metriccanvas-authoring/test-harness/run_tests.py
pnpm --filter platform check
pnpm authoring:contracts:check
metriccanvas-authoring/tool/.venv/bin/python metriccanvas-authoring/scripts/check_bundle.py
git diff --check
```

修改产品或 Authoring 契约源时，先执行 `pnpm authoring:contracts`，再运行检查。契约副本、manifest 和 digest lock 由生成器管理。

**完成判据：** 命令全部退出为零，测试清单无漂移，契约与 Bundle 在准备提交的最终文件树上一致。

## 3. 失败分类与重试

“状态”与“原因”分开记录：

| 状态 | 含义 |
|---|---|
| `pass` | 本层全部断言已执行且通过 |
| `fail` | 断言已执行，实际行为不符合预期 |
| `blocked` | 外部连接、认证、配额、运行环境或前置用例使断言未完成 |
| `not-run` | 已在范围内，但尚未执行 |
| `out-of-scope` | 已明确排除，不计入通过率 |

原因至少区分 Skill/产品缺陷、测试设施缺陷、模型外部故障和未集成的生产依赖。`ConnectError`、认证不可用、token 预算耗尽或前置用例阻塞都不是 `pass`；没有产品证据时也不直接记为产品 `fail`。

重试使用全新证据目录，保留原目录和失败报告。代码或 Skill 修复后记录修改理由和关联失败；外部瞬断时记录重试理由和时间。不用重复运行筛选一个成功样本来替换整体结论。

## 4. 交付报告

交付一张“用例 × 证据层”矩阵：

| 用例 | 确定性 | 真实 DS | 产物 | 浏览器 | 证据目录 | 状态/原因 |
|---|---|---|---|---|---|---|
| `<case-id>` | pass/fail/... | pass/fail/... | pass/fail/... | pass/fail/... | `<absolute-path>` | `<classification>` |

报告同时包含：

- Skill 与用例清单 hash，模型名与非秘密参数；
- 每次运行的模型请求、工具调用、DQE 调用、token 用量与耗时；
- 首次失败、所有修复和未解决的 blocked/not-run 项；
- 可直接消费的最终 `document.json` 绝对路径；
- 浏览器报告与截图路径；
- 本轮使用的本地替身及未执行的生产联调。

只有确定性主流程、全部必需真实模型用例、页面产物和相关回归都通过，才可写“Skill 对接 DS 模型验收通过”。浏览器通过后可另行写“本地工作台视觉与重开取数通过”。只有相应生产依赖已真实联调，才将它写入生产就绪结论。

## 5. 当前实现入口

同类任务先从以下实现查找当前参数和产物结构，不从本文复制内部实现：

- 执行说明：`metriccanvas-authoring/test-harness/model-evals/README.md`
- 用例清单：`metriccanvas-authoring/test-harness/model-evals/platform-authoring.cases.json`
- 无模型预检：`metriccanvas-authoring/test-harness/model-evals/preflight.py`
- 确定性/真实模型 runner：`metriccanvas-authoring/test-harness/model-evals/run_platform_v2.py`
- 可信测试组合：`metriccanvas-authoring/test-harness/model-evals/trusted_fixture_server.py`
- 保存后浏览器：`apps/platform/tests/workbench/main-flow-browser.mjs`
- Platform 组合根：`metriccanvas-authoring/tool/metriccanvas_authoring/bootstrap/platform.py`
- 契约生成真源：`tools/scripts/export-authoring-contracts.ts`
