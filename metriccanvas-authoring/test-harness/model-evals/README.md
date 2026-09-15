# Platform 创作真实模型评测（TB2）

本目录包含可运行的真实模型/生产内容 stdio runner、9 个冻结场景、证据校验器，以及历史 14 例的原样副本。本轮真实调用因自动审批拒绝而 **blocked**；不是模型成绩。代码测试通过不等于 S1 行为验收。

## 证据与边界

- `history/` 原样保留旧分支的用例、runner、评分器、结果和 provenance。历史评分器含写死的语义评审，只作为来源档案，不用于新样本。
- `platform-authoring.cases.json` 保留旧的 14 个 not_run 规划用例，不能与历史实际结果混淆。
- `unified-authoring.cases.json` 在看统一作者文本前独立冻结：3 个原误用、3 个关键正例、3 个留出场景，每例 3 次。SHA 见 preflight。留出不用于改提示词；若污染须另建新版本。
- `evidence/preflight.json`：旧 163 个原始文件 hash 全部匹配；真实内容服务器确实注册四工具；既有 Python 依赖可用。无模型请求。
- `evidence/baseline-audit.md`：来源、误用归因、版本与环境限制。
- `evidence/execution-plan.json`：本轮 108 个计划样本均 blocked，无伪造 response/token。
- `evidence/approval-request.md`：实际目标、载荷类别/样例、调用预算、停止条件、审批拒绝原文。用户具体批准前不运行真实命令。

模型只收到 Skill/参考、实际注册的工具说明/schema、任务和可信夹具摘要/安全工具结果。完整页面、行、查询和候选留在受限程序目录。使用生产 `metriccanvas.content_server`，没有模型替身，没有虚构 Relay API；本地 baseline token 不证明服务端 latest/路由/保存能力。无 Data Context/DQE 配置时数据创建保持 blocked。

## 环境与本地测试

Python >=3.12，依赖沿用 `metriccanvas-authoring/tool/requirements.lock`。本机已核验环境 `/private/tmp/metriccanvas-126-delivery-python/bin/python`，Python 3.12.13、fastmcp 3.4.7、httpx 0.28.1。不修改/安装旧 worktree 的环境。

以下命令从集成后的仓库根目录运行（当前独立分支 `/private/tmp/metriccanvas-unified-evals-20260915`）：

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s metriccanvas-authoring/test-harness/tests -p test_model_eval_harness.py -v
PYTHONDONTWRITEBYTECODE=1 /private/tmp/metriccanvas-126-delivery-python/bin/python metriccanvas-authoring/test-harness/model-evals/preflight.py --config "$EVAL_CONFIG" --output "$NEW_PREFLIGHT_JSON"
```

`EVAL_CONFIG` 指向用户批准的既有本机 DeepSeek 配置，不把值打印或写进命令。preflight 只内存校验所需键和目标，启动真实 stdio 并列工具，不请求模型。输出文件必须不存在。主实现集成前，统一 Skill 缺文件会按实际记录，不能从另一个 worktree 拼装半成品运行。

## 获得具体授权后执行

每个输出目录必须全新，拒绝覆盖历史/先前重复。四个独立批次：baseline/unified × diagnostic/production；每批 9×3。生产四工具与诊断当前相同，独立记录但没有工具集差异可归因。不要在同批次同时换模型、参数、参考或工具集合。

```sh
PYTHONDONTWRITEBYTECODE=1 /private/tmp/metriccanvas-126-delivery-python/bin/python metriccanvas-authoring/test-harness/model-evals/run_local.py --config "$EVAL_CONFIG" --output "$NEW_RAW_DIRECTORY" --arm unified --profile diagnostic --token-budget 600000
```

旧入口比较使用 `--arm baseline`；需在保留旧 Skill 的基线 checkout 运行本提交的设施。新旧两边均应固定 commit。生产批次用 `--profile production --production-tools discover_data_context compose_page create_content_page edit_page`，名单必须在真实 stdio 注册中存在。`--cases` 可用于调查子集，但子集不满足完整验收。

启动前按场景注入 SKILL + tools；创建/编辑加载对应 workflow；只读不加载 workflow；创建选定布局和显式切换加载布局参考。旧侧保持历史四文件注入。错误/examples 当前没有动态文件读取接线，未注入；如果模型依赖缺失参考，应记 blocked/inconclusive，不能用数据发现搜索。此限制已写入 manifest，不冒称已验收生产按需加载。

每轮最多 6 模型请求、12 工具调用；无重试。每批最高 600k token，按 UTF-8 字节数＋协议余量＋输出上限保守预留；预算不足停止并记剩余样本 blocked。固定 temperature=0/max_tokens=4096/thinking disabled。缺 usage、HTTP/配置/工具越界等失败停止整个批次。每次请求/响应、工具调用和耗时、usage、前后文档和产物 hash、注入 hash、依赖版本、源码 hash、HEAD、工作树状态均落盘。配置路径/密钥不进入 manifest。

## 评分与完整性

```sh
PYTHONDONTWRITEBYTECODE=1 /private/tmp/metriccanvas-126-delivery-python/bin/python metriccanvas-authoring/test-harness/model-evals/eval_evidence.py "$RAW_DIRECTORY" --reviews "$REVIEW_JSON" --output "$NEW_REPORT_JSON"
```

无 `--reviews` 仍可运行，但所有答案的语义检查保持 inconclusive。逐样本审阅文件格式如下，键为 `case-id/repeat`；resultSha256 必须绑定该次原始 `result.json`，改动后旧评审自动失效：

```json
{"case-id/1":{"resultSha256":"<sha256>","reviewer":"<reviewer>","status":"pass","reason":"<逐次答案和产物语义证据；检查冒称保存/发布、配置事实、明确布局和目标>"}}
```

pass 需要原始 request/response、实际调用、合法完整产物/保持检查（如适用），及独立语义理由。发现违规优先 fail；运行环境缺失 blocked；缺 trace/审阅 inconclusive。原文件 hash 清单随新报告写出，历史核验使用 `verify_hashes`。报告分样本和配置展示，routing/latest 始终另记 blocked。零关键违规须逐条检查后判断，不能从空列表或无工具调用推断。

不可把 6/14 当作完整平台成功率：历史 13 例实际调用、34 请求，路由全部未验；返回模型别名也不能当固定模型版本。文件行数不换算模型 token、费用或成功率。

## S2 surface 预检（独立于 S1 冻结评测）

`preflight.py --surface legacy-content|unified-content` 选择实际 stdio 模块。默认 `legacy-content` 保持上述 S1 四工具协议；历史记录、S1 用例和已有输入哈希均不改。

```sh
PYTHONDONTWRITEBYTECODE=1 /private/tmp/metriccanvas-126-delivery-python/bin/python metriccanvas-authoring/test-harness/model-evals/preflight.py --config "$EVAL_CONFIG" --output "$NEW_S2_PREFLIGHT_JSON" --surface unified-content
```

在已集成 S2 代码的仓库运行。`unified-content` 启动 `metriccanvas_authoring.unified_content_server`，预期 FastMCP 名为 `metriccanvas-platform-content`；只列工具，不调用内容工具或模型。验证工具集合恰为 `read_page_context / discover_data_context / compose_page / create_content_page / edit_page`，每个 Schema 要求字符串 `context_ref`；不得暴露 `page_id / baseline_token / source_token`。缺 S2 模块会失败，不回退旧服务器。

`introspection.status=pass` 仅表示注册集合/参数签名符合该 surface，不证明可写或 latest 已实现。`expectedServerName` 是核对源码后声明的预期名，不冒充远端握手验证。独立 stdio 未注入可信 current-turn 提供方，五工具必须 fail closed；本预检不执行五工具来替代提供方测试。

当前 `run_local.py` **仅支持 S1 legacy-content**。即使 `--arm unified` 也只是 S1 统一 Skill 文本，不能当 S2 五工具运行。S2 预检的 `modelRunner.status` 固定为 blocked（unsupported trusted port），`trustedCurrentTurn/latest/writeReadiness` 同样 blocked。不得拿旧 `baseline_token/source_token/page_id` 发模型请求并宣称 S2 验收；需后续真实可信轮次 Adapter 接入和另行冻结的 S2 输入，且获得主任务中的具体模型授权后再运行。

`run_local.py` 现已在读取模型配置、启动 stdio 和网络请求之前检查实际 SKILL frontmatter：只接受仓库当前 block-list 格式的 `metadata.mcp_servers: [metriccanvas-content]` 和 S1 工具子集。S2服务、`read_page_context`、缺失或无法确定的 metadata 会输出 `UNSUPPORTED_SKILL_PROTOCOL`、`status=blocked`、`modelRequests=0`，退出码2。此门禁检查实际文本及哈希，`--arm unified` 不能绕过。它不引入完整 S2 runner，也不改变 S1 冻结用例。

## S2–S7：可信本地统一服务 runner

`run_trusted_local.py` 是新版五工具共享循环。`ScriptedTransport` 与 `HttpTransport` 只负责产生同一 messages/tools 协议的 assistant 消息；实际 stdio、工具分派、候选校验、模型摘要过滤和下一轮构造均走同一路径。旧 `run_local.py` 继续供 S1 基线比较，旧协议门禁仍生效。**本次仅运行 scripted 和 mock HTTP 测试，未发送任何真实模型请求。**

本地版本从 `0a8454181217553fa3c6c8703ead2a63c7767413` 实施 HEAD 冻结。独立 worktree 为 `/private/tmp/metriccanvas-unified-evals-s7-20260915`；可复用 Python `/private/tmp/metriccanvas-unified-s1-20260915/work/venv/bin/python`。

```sh
PYTHONDONTWRITEBYTECODE=1 /private/tmp/metriccanvas-unified-s1-20260915/work/venv/bin/python metriccanvas-authoring/test-harness/model-evals/run_trusted_local.py --transport scripted --suite local-smoke --scenario all --repetitions 3 --output "$NEW_RAW_DIRECTORY"
PYTHONDONTWRITEBYTECODE=1 /private/tmp/metriccanvas-unified-s1-20260915/work/venv/bin/python -m unittest discover -s metriccanvas-authoring/test-harness/tests -p 'test_*model_eval_harness.py'
```

`trusted_scenarios.py` 是独立的本地协议检查，不改或替代原9例冻结suite，不参与Skill改写。12类覆盖：配置读取与两版候选/unchanged复用、下一轮本地基线重建、静态新建、发现→数据新建、已有页新增数据/说明、缺source的部分成功、缺数据/候选存储/可信轮次、scope不匹配，以及report/dashboard混合创建。每例独立stdio进程，内存候选存储只在本次会话存续。

### 可信程序与模拟模型的边界

- `trusted_fixture_server.py` 真实导入生产 `create_unified_content_mcp_server`，只注册五工具。复用既有测试的显式合成 Data Context/DQE/源描述；fixture身份、scope/current-turn通过启动参数指定的受限本地状态文件注入，模型不能写此文件，不能传scope或整页。
- 模型仅收到 `context_ref`、本地能力边界、用户指令、实际Skill/按场景流程/布局、真实工具Schema及安全结果。`read_page_context`提供真实程序投影；发现结果仅按该工具实际顶层字段过滤。完整`metriccanvas.authoring-candidate` record、`document/rootBinding/operations/source_description_evidence`只存程序通道。
- 同轮续写显式使用模型摘要给出的 `candidate_ref`；校验rootBinding、parentRef、candidateVersion、文档合法性和hash、摘要一致性。unchanged只接受已见、完全相同、同根绑定的原候选。每轮末的最后已校验候选用于下一轮本地document，程序重新生成context/scope/ref/hash；这是本地夹具推进，**不证明远端latest或最终候选选择/提交**。
- 缺current-turn时五工具精确返回`CURRENT_TURN_UNAVAILABLE`；缺候选存储、Data Context、源描述分别保留对应错误，不回退旧服务。部分成功的依赖失败也保留原错误与failed/skipped/applied。
- scripted父进程和合成stdio子进程均硬拦截IP socket连接；scripted不接受config或真实调用开关。没有模型、真实源HTTP、Relay、保存或发布服务被调用。

### 成绩与审计

所有scripted结果标记 `evidenceKind=non-model-evidence`，`modelRequests=0`、`usage=null`，模拟次数单列`simulatedModelCalls`。`deterministicStatus=pass`仅指本地检查通过；模型`status=blocked`，无论提供何种review，`eval_evidence.score`都不能将其提升为真实模型pass。remoteLatest、Relay、save/publish、重启恢复、真实数据与生产身份分别blocked。

manifest记录HEAD/工作树、suite/case ID/hash、runner/transport/stdio fixture、实际工具源码、fixture依赖测试Python和合成JSON来源hash，以及参数和依赖版本。每次完整request payload（含模型和参数，与传输同对象）、response、工具调用/耗时、可信轮次、完整候选、模型消息和hash索引分别留存。原历史证据与冻结suite文件未修改。

### 授权后的真实模型入口（本次未执行）

共享HTTP transport复用既有DeepSeek配置/参数/协议，必须显式 `--transport http --allow-real-model --config`。命令开关不是用户授权的替代物；仍须等主任务中的具体外发授权确认。

```sh
PYTHONDONTWRITEBYTECODE=1 /private/tmp/metriccanvas-unified-s1-20260915/work/venv/bin/python metriccanvas-authoring/test-harness/model-evals/run_trusted_local.py --transport http --allow-real-model --config "$EVAL_CONFIG" --suite frozen --scenario all --repetitions 3 --profile diagnostic --token-budget 600000 --output "$NEW_RAW_DIRECTORY"
```

HTTP支持原9例 `unified-authoring.cases.json`，不提供脚本替代答案；scripted不接受frozen suite。`--scenario`可选case ID；不足3次不是完整模型验收。普通问数入口（如后续扩展加入）在缺Relay时先blocked，不手工强选统一Skill。旧侧在保留旧Skill的固定checkout使用旧runner；新侧记录 `arm=unified` 与实际 `toolProfile`。`--profile production`同样使用当前五工具完整注册，当前与diagnostic无工具集差异，不宣称生产路由得到验证。

整个HTTP批次共享600k token上限（不是逐case重置），按完整输入字节+协议余量+4096输出预留；每轮最多6模型调用和12工具调用，无重试。HTTP错误、缺usage、预算不足立即停止整批，已尝试请求数保留。外部返回模型ID和实际usage按原响应记录；没有计费金额或固定模型版本保证。

冻结suite的真实HTTP结果可用既有 `eval_evidence.py` 命令评分。统一协议分支从程序侧trusted-turn/candidate验证创建身份和逐轮本地基线，模型上下文不补回旧`page_id/baseline_token`。原`noTools`与S2必须读取配置的行为不等价：原断言保留为inconclusive并解释差异，另检查只读边界，不能偷偷改成pass。答案语义仍需逐次hash绑定审阅。`local-smoke`使用自身确定性report，不冒充冻结suite准确率。

多轮对话保留前轮安全的user/assistant/tool消息，每轮追加新的可信context与用户请求。旧context和候选在历史中仅是历史证据；本轮工具仍须通过新scope门禁。scripted只从最后一条user之后的工具消息解析候选引用，不能自动复用上轮候选。此修正额外通过30项定向测试与fresh-local-turn三次真实stdio模拟验证，证据为`evidence/trusted-history.report.json`；早先36次本地验证清单保持原样可追溯。
