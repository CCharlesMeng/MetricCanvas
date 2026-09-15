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
