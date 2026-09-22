# Skill 创建与调整主流程测试计划

日期：2026-09-22。状态：已实施并完成本地受控验收；真实 Java/Relay 生产联调仍在既定范围外。

## 1. 目标与已确认范围

用户已确认：

- 测试使用独立组合入口，复用正式平台工厂、MCP 工具和 HTTP Adapter；生产入口缺少可信提供方时继续拒绝执行。
- 仅保留创建页面、调整页面两条必须的主流程，其他周边流程暂不考虑。
- 涉及新的架构改动时先 grill；在以上边界内的实现选择无需重复征求许可。
- 实施结果与证据边界记录在下方“实施结果”；原分阶段内容保留为验收依据。

### 实施结果

- 无模型 preflight 通过，九工具已注册；主流程 runner 只向模型暴露本轮需要的六个工具。
- 五个确定性 case 在同一 runner 全部通过，实际经过独立 MCP stdio、正式平台工厂、Java 语义/DQE/页面资产 HTTP Adapter，并验证 POST/GET/PUT。
- 五个 case 均取得真实 `deepseek-v4-flash` 通过轨迹。首次全量运行保留了连接中断，新增数据分支的首次失败还暴露并修复了 Skill 对 `add_result_component` 的指引缺口；没有只保留成功样本。受 60 万 token 预算及外部连接瞬断影响，未获得单个全量目录五项同时为 pass，结论按各 case 证据合并，不把 blocked 抹成通过。
- 保存后的 edit-report 已在真实 Platform 工作台重开并重新请求 DQE；1440 和 640 宽度的截图、几何、无横向溢出与无组件重叠检查通过。
- `run_tests.py --check` 与完整 409 项 Python 回归通过；Platform Svelte/TypeScript 检查通过；contracts export、bundle 1628 项 digest 检查及 `git diff --check` 通过。
- 本次没有修改生产组合入口、身份/权限、保存/发布归属、页面协议或 Relay 职责，因此没有触发新的架构 grill。

本轮要交付可重复运行的测试链路：业务指令 → Skill 调用正式工具 → Java 原始指标语义发现 → DQE 取证 → 创建或调整页面 → Java 草稿保存 → 本地产物交付 → 浏览器查看保存后的页面。确定性脚本先验证测试设施，真实模型再验证 Skill 执行。

“调整页面”至少覆盖纯配置修改和新增数据组件，两者分别验证不取数与确需取数的路径。report/dashboard 是同一主流程的布局输入，不另建工作流。

明确不纳入本次：参数提取/选择/填值、模板检索与实例、正式发布、历史回退、删除、普通问数、AI 总结 SSE、完整计划确认交互、多账号切换、取消与迟到结果、专门的冲突/未知写入/预览恢复场景，以及真实 Java/Relay 生产联调。保留相关既有代码与回归，不删除工具、不降低现有规则。

## 2. 接手前必须知道的工作区状态

最初交接文件：`/var/folders/_7/p5v7g8bs6kb8jy5sm02lbw4h0000gn/T/metriccanvas-skill-test-handoff-20260922.md`。
上一轮完整盘点见 [依赖盘点](2026-09-22-skill-full-test-dependency-audit.md)；它用于查证缺口，本计划的收窄范围优先，不照搬其九工具全部验收目标。

工作区已有大量未提交修改。先检查 `git status --short` 和有关文件 diff，保留其他工作，尤其不清理 `ioc-data-dev/` 和 `packages/embed/single-option-check.mjs`。本轮尚未提交或推送。

暂停前本会话实际修改如下，均为未完成状态：

| 文件（相对仓根） | 当前修改及后续处理 |
|---|---|
| `metriccanvas-authoring/test-harness/model-evals/preflight.py` | 初步允许并要求 `edit_page.page_id`；现行预检改读 `platform-authoring.cases.json`，要求其提供 `injectionSources`；检查失败退出非零。**用例文件尚未补字段，目前可能 KeyError，不能直接称预检已修好。** |
| `metriccanvas-authoring/test-harness/tests/test_model_eval_harness.py` | 一个正向 Schema 测试补了必填 `page_id`。反向测试仍需整理：每种坏输入应基于完整合法定义，避免因缺少 page_id 而假阳性。 |
| `metriccanvas-authoring/test-harness/fixtures/platform-main-flow.json` | 新建初稿，包含 Java dataset、业务请求、章节、字段身份、DQE 请求及两条结果；尚未接入。章节标题仍是 chart/details，应换成业务标题；metric logicalId 与原始 metric id 的对应关系需要明确。 |
| `metriccanvas-authoring/test-harness/tests/test_platform_main_flow.py` | 新建红测试，期待 `run(output, scripted=True)` 串联创建和标题调整；当前 runner 不支持该参数。测试尚未登记 `test-layers.json`，会触发清单漂移。随着用例扩充应改为按场景断言，不锁死整个报告只有两个 case。 |

上述之外的脏文件是既有工作，不应归为本次实现成果。

已确认可用 Python：`metriccanvas-authoring/tool/.venv/bin/python`，能够导入 fastmcp/httpx。`/tmp/metriccanvas-authoring-venv-20260922/bin/python` 在本次检查缺少这两个依赖，不要直接沿用。

最近一次有效主流程测试失败：`TypeError: run() got an unexpected keyword argument 'scripted'`，属于待实现接口。未运行本轮真实模型、浏览器或完整回归。最初预检正向测试复现了错误拒绝 page_id；不能把这次 red 记录当 green。

## 3. 实施架构

```text
现行用例清单 + 同一份场景数据
          │
确定性驱动 / 真实模型驱动（共用工具执行与验收）
          │ MCP stdio
trusted_fixture_server.py（测试集成程序）
          │ create_platform_server
正式 PlatformAuthoring + SQLite 工作存储
          ├─ JavaDatasetMetadataProvider ─ HTTP ─ 本地语义元数据
          ├─ DqeHttpExecutionPort ───────── HTTP ─ 本地受限 DQE 场景
          ├─ KnownLifecycleHttp ────────── HTTP ─ 本地有状态页面资产
          ├─ 场景源描述提供方（按请求与版本核对）
          └─ 可信轮次 / 计划授权 / 本地预览产物接收方

浏览器平台工作台 ─ 正式前端 Java/DQE 客户端 ─ 同一 HTTP 模拟服务
```

现成接线可复用：

- `tool/metriccanvas_authoring/bootstrap/platform.py:create_platform_server` 已接受全部所需依赖，并自动为 Java 元数据提供方创建 SemanticCatalog。
- `test-harness/model-evals/trusted_fixture_server.py` 已是调用该工厂的 stdio 测试入口，当前使用 Fake 数据与内存 Service。扩展此入口支持显式 HTTP 场景配置，不新建第二套业务编排。
- `run_platform_v2.py` 当前直接构造 PlatformAuthoring 并进程内连接 MCP；必须改为上述 stdio 客户端。真实模型和确定性执行均走同一入口。
- 已有 `tools/dqe-sim` 是通用 HTTP 仿真，但不能假设其支持当前 Tokens 场景。本轮优先在测试场景服务提供严格的请求匹配响应；若能直接复用其执行器且不扩展产品能力，可复用。不得为测试重写通用 DQE 引擎。

测试提供方可读取受信任启动配置与场景文件；模型只能传现行工具参数。测试身份、页面 ID、创作基线、授权、端点与数据库路径均由集成程序建立。

新增文件建议集中在 `test-harness/model-evals/`：`main_flow_http.py` 管 HTTP 场景服务；`main_flow_host.py` 管可信测试提供方与启动配置。仅当实现复杂度需要时拆分；runner 保持调用与评估职责。共享事实放在已有 `fixtures/platform-main-flow.json`，不再从 `test_*.py` 导入主测试环境的数据。

禁止改动的生产边界：不新增模型可调用的设置身份/确认计划/注入页面工具；不绕过 Java 当前页核对；不让测试默认身份进入生产入口；不改页面 Schema、保存与发布职责、模型/程序双通道。若必须改变这些，停止相关实施并 grill。

## 4. 分阶段实施及完成判据

### P0：修复当前入口与预检

1. 将 `platform-authoring.cases.json` 改成当前主流程执行清单，Skill 统一指向 `metriccanvas-platform-authoring`；包含场景 ID、workflow、前置场景、用户指令、预期业务结果、必需参考文件。
2. 清单应被 runner 实际遍历；不得再保留一个独立的硬编码单场景循环。被排除流程不计入本轮通过率，历史原始用例留在现有 history，不篡改其证据。
3. 注入来源至少含 `SKILL.md`、`references/tools.md`、`references/execution.md`、create/edit/data-analysis 流程及涉及布局参考；按清单读取，记录文件 hash。参数工作流不必注入。
4. 预检禁止旧 token/自报身份参数；`edit_page` 必须有 string page_id、context_ref 和 expected_version。校验预期九工具注册仍保留，但只对本轮六个工具执行流程验收。
5. 现行预检不读取历史 Skill 路径或历史原始文件存在性作为前置条件。报告同时给出 introspection、引用文件、执行就绪范围；失败返回非零。
6. 更新正反测试，登记新测试文件到现有测试分层清单。

完成：无模型 preflight 通过、没有旧 Skill 缺失项，畸形 Schema/缺引用文件会使预检失败；模型请求为零。列工具通过仍只代表预检成功。

### P1：统一场景与 HTTP 模拟

场景选用现有“2026 年 8 月各区域 Tokens 请求量”，预期华东 18 次、华南 12 次。一个场景源同时提供：

- Java 原始 dataset/metric/dimension、单位与定义；物理 SQL 哨兵保留在原始响应，用于证明不会进入模型消息。
- projection governance：执行环境、非敏感/可空策略、比率等明确测试事实；不能因为原始语义可发现就自动允许执行。
- 源描述的稳定字段身份、投影身份、类型、单位及数据上下文版本绑定。版本从正式提供方结果获取，不硬编码旧版本。未知字段/版本不匹配直接拒绝。
- 一个明确支持的 DQE 查询及独立写定的预期结果。不得用被测查询生成算法生成“预期请求”，避免共同错误自证正确。

HTTP 服务绑定动态 loopback 端口：

| 路由 | 最小实现 |
|---|---|
| POST `/rest/cdi/cdinl2databuilderservice/v1/dataset-detail/query-dataset-from-lab` | 按 YAML 读取 workspaceId/datasetIds，返回相应 dataset_details；核对测试身份与工作空间，不主动 refresh |
| POST `/rest/cdi/cdinl2databuilderservice/v1/dsl/execute` | 按正式 envelope 返回；核对指标、维度、时间、筛选与支持的排序/分页，未知请求明确失败，不回通用固定行 |
| POST/GET/PUT `.../user-page-metadata` 及资源路径 | 依 `service/platform-java.yaml` 保存、查询列表/详情、条件更新；返回真实可消费的资源 ID、修订和字符串页面定义 |
| OPTIONS 与健康检查 | 供浏览器直连及启动确认；CORS 只服务本地测试来源 |

页面资产状态在一次测试会话内独立持有，跨 MCP 子进程重启仍保留；无需本次引入模拟服务自身的永久数据库。POST 只创建一次，PUT 检查 base_revision_id 并增加修订。用 GET 验证保存，不从服务内部字典取值作为验收替代。

仅记录必要的 HTTP 方法、路径、场景 ID、请求体、状态与保存回执；不记录 token/header 秘密。主流程外的异常演练不新增，但模拟服务仍应拒绝错误身份、未知查询、非法页面与错误修订，防止假绿。

完成：真实 httpx 往返经过三种正式 Adapter；场景请求取得正确行，改变指标/期间/筛选的负向探针不会得到同一成功结果；创建后的资源可以 GET，并可条件 PUT。

### P2：接通可信测试集成程序与 stdio

1. 扩展 `trusted_fixture_server.py` 的显式 HTTP 模式，保留仍被已有测试使用的无网络模式。生产 CLI 不改。
2. 测试子进程只允许连接本次分配的模拟服务地址；当前 deny_network 禁止一切 IP 网络，需要精确允许该地址。子进程不能收到模型凭据，也不读取平台 `.env`。
3. 新建轮次由程序分配 pageId 和空基线；后续调整通过 Java GET 获取刚保存的 document/ref，重新建立 existing 轮次、原始字节摘要及 scope。
4. 计划授权绑定本轮身份、request 摘要与正式数据上下文版本，只授权预置业务需求及有界场景证据。对同义、等价表达可做有限规范化，不默认批准任意模型计划。
5. SQLite 使用每次运行独立路径。每个调整轮次至少重新连接/启动 stdio，证明未依赖创建进程的内存页面。
6. 最小本地预览接收方保存精确 artifactRef 对应产物并返回回执；runner 验证后消费两个最终标记，完整产物留程序侧。此处仅验证本地交付，不声称真实 Relay 已接通。

完成：客户端通过 stdio 列工具、读上下文、发现、查询、创建/调整和预览；产物、HTTP 记录可关联同一轮次；创建与调整之间从远端保存结果建立新基线。

### P3：共用 runner 与确定性验收

保留现有 `run_platform_v2.py --output <全新目录>` 真实模型入口，增加 `--scripted` 无模型模式；脚本与模型共用工具调用、结果分流、证据输出和判定函数。允许按 case 选择，但报告列明 requested/executed/not-run，不能以子集冒充全量。

| 场景 | 输入与关键验收 |
|---|---|
| create-report | 创建 8 月区域运营报告，包含区域对比与明细；实际语义发现、DQE 取证、合法 Schema 6.11、POST 一次、精确预览。结果应表达华东 18、华南 12、单位次及 8 月期间 |
| create-dashboard | 同一业务需求明确选 dashboard；与 report 共用流程和场景数据，独立 pageId；不把布局选择交给随机默认 |
| edit-report | 对刚保存的 report，将页头改为“2026年8月区域运营复盘”；先 GET/read_page_context，再用匹配 page_id/workVersion 修改；不调用发现/DQE，PUT 一次；文档除目标 props.title 外严格相等 |
| edit-dashboard | 对刚保存的 dashboard 修改一个已读取组件的标题；沿用同一保护判据，其他内容严格不变 |
| edit-add-data | 对已保存 report 增加明确要求的华东筛选数据组件；该口径不同于当前页的全区域数据源，本轮重新确认范围和取证，使用 add_result_component 与结果引用；保留原有组件、查询和布局。只允许新增组件/所需数据源及明确允许的布局变更；实际变化逐项核对 |

五个 case 是两条主流程的有限分支，不新增其他业务流程。先实现 create-report → edit-report 的纵向切片，再补布局与新增数据分支。当前红测试只覆盖第一切片，最终需扩充。

模型不能得到期望页面 JSON、工具调用脚本或被强制指定的成品布局结构；可得到用户需求、可信 context_ref 和已确认业务计划。必须读到新的数据上下文版本再查询。创建的组件 ID 可由模型选择，后续调整通过程序读取实际保存页选出明确目标，不依赖模型碰巧命名为 chart。

每次运行产物至少包括：report.json、逐 case 工具轨迹与最终答复、独立 artifact.json/document.json、保存回执、脱敏 HTTP 日志、Skill/场景 hash。记录模型名、请求数、token 用量和耗时；脚本模式 modelCalls=0，不能标成模型证据。

完成：全部确定性 case 通过；断言查看业务结果、页面差异、真实 HTTP 读写及产物对应关系，而不是只看 ok/工具次数。基础测试直接调用 runner，失败退出非零，所有子进程和监听端口可靠清理。

### P4：真实模型与浏览器验证

1. 使用已配置的 `deepseek-v4-flash` 执行同一用例清单；配置通过现有 `run_local.config` 读取，不复制密钥。真实模型请求显式启用，普通 unittest 不调用外部模型。
2. 遵守现有工具/查询/修改预算；仅允许 Skill 中定义的有依据修复。记录首轮失败和后续修复，不能重复运行直到某次成功后只报告成功样本。
3. 如果模型网络/认证阻塞，保存确定性结果及明确的 not-run/blocked 原因，不声称全部验收完成；不要借机放松授权或在业务工具中增加兜底。
4. 浏览器复用 `apps/platform/tests/workbench/java-assets-browser.mjs` 的启动、运行配置注入与导航模式，连接同一有状态 HTTP 服务；另写本轮主流程脚本或抽取共用辅助函数，避免执行其发布/回退/删除步骤。
5. 必须用 Java 保存后的 document 在实际工作台重新打开，使用正式前端数据网关重新请求 DQE，核对区域、18/12、单位、期间和改后的标题。不能只使用 artifact.previewJson 的 initial 行。
6. 预览交付检查复用 `platform_v2_browser.mjs` 的运行时与几何方法，记录浏览器确实消费了对应产物；预览成功与保存后重开分别给出结果。
7. 1440 和 640 宽度各取截图；检查主内容无横向溢出、组件无重叠/截断、章节与图表/明细关系清楚，人工查看实际截图。模型输出不能仅通过 Schema 就获得视觉通过。

完成：五个 case 均有模型轨迹与判定；创建及调整结果在浏览器可读，保存后重开有新的 DQE HTTP 证据；前端控制台没有未解释错误。分别报告确定性、真实模型、浏览器三类结论，真实 Java/Relay 仍标为本次范围外。

### P5：回归与交付

按最小闭环递增验证，最后执行现有完整 Python 回归及 contracts/bundle 检查。若改 TS、浏览器脚本或 DQE Sim，运行对应现有检查，不把未运行的相关检查算通过。

```sh
metriccanvas-authoring/tool/.venv/bin/python metriccanvas-authoring/test-harness/run_tests.py --check
metriccanvas-authoring/tool/.venv/bin/python metriccanvas-authoring/test-harness/run_tests.py
metriccanvas-authoring/tool/.venv/bin/python metriccanvas-authoring/test-harness/model-evals/preflight.py --surface unified-content --output /tmp/metriccanvas-main-flow-preflight-<run>.json
metriccanvas-authoring/tool/.venv/bin/python metriccanvas-authoring/test-harness/model-evals/run_platform_v2.py --scripted --output /tmp/metriccanvas-main-flow-scripted-<run>
metriccanvas-authoring/tool/.venv/bin/python metriccanvas-authoring/test-harness/model-evals/run_platform_v2.py --output /tmp/metriccanvas-main-flow-model-<run>
pnpm authoring:contracts:check
metriccanvas-authoring/tool/.venv/bin/python metriccanvas-authoring/scripts/check_bundle.py
git diff --check
```

`<run>` 替换为唯一标识；新参数/命令在 P3 实现后才可用。浏览器命令由实施脚本确定并写入 README，服务由测试入口管理生命周期。若锁清单包含改动文件，通过仓库现有生成程序更新，不能手改 digest 来掩盖不一致。

更新 `test-harness/model-evals/README.md`：列明本轮仅创建/调整、启动方法、环境前置、输出位置和证据限制。通常无需修改 Skill；若测试证明 Skill 本身有缺陷，再按相应 skill 要求修改并同步打包检查。

交付报告包含执行矩阵（case × 确定性/模型/浏览器）、可直接消费的最终页面 JSON、关键截图、实际检查结果，以及未通过项。测试结果不提交敏感配置；提交/推送按用户后续指令执行。

## 5. 完成条件与升级条件

全部完成必须同时满足：

- 现行预检不依赖历史 Skill，失败能被进程状态捕获。
- runner 确实消费清单，确定性与真实模型使用同一 stdio/HTTP 接线。
- 新 Java 语义接口、DQE、POST/GET/PUT 均有实际调用证据；数据、源描述与查询口径一致。
- 创建内容符合需求；纯配置调整不取数且保留无关字段；新增数据组件有本轮授权证据且保留已有内容。
- 保存产物匹配服务回执，预览可消费，实际工作台重开并重新查询成功，视觉检查通过。
- 相关回归和分发检查完成；无额外周边流程建设、无生产身份/权限放宽。

下列情况先 grill：需要改变生产组合入口的可信注入协议、扩大模型可见证据/权限、改变保存/发布归属、修改页面协议、改造平台来承担 Relay 职责，或增加本轮明确排除的工作流。常规测试夹具组织、端口选择、日志格式与现有逻辑缺陷修复按计划自主完成。

## 6. 按需参考入口

- 主控制流与分层：[tool 阅读指南](../../metriccanvas-authoring/tool/README.md)。
- Skill 执行判据：[执行检查点](../../metriccanvas-authoring/skill/metriccanvas-platform-authoring/references/execution.md)。
- 新 Java 语义契约：[dataset-detail-java.yaml](../../service/dataset-detail-java.yaml)；页面资产契约：[platform-java.yaml](../../service/platform-java.yaml)。
- 架构事实：先读 [ADR 索引](../adr/README.md)，再读领域边界/产品生命周期/页面保存相关主题；现行创作保存职责以 ADR-0083/0090 为准，不回退到旧的不保存流程。
- 正式 HTTP 与 stdio 实现均在仓内；不要另行猜测上游 HTTP 协议或重做上一轮全量依赖盘点。
