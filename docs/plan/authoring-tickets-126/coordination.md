# #126 统筹台账（S0 唯一写入）

2026-09-14。M0 NOT READY。本文件是实施记录，不以角色规划冒充人员就位。

## 基线与隔离

- 原工作区：`/Users/moon/Documents/Code/公司项目/DataDashboard`，main `661d693369ac45d4b8cdf3a46e14a200df71fcb2`。只读交接，不修改、不暂存、不提交其改动。
- 集成：`/private/tmp/metriccanvas-126-integration`，`codex/authoring-126-integration`。此目录只接收基线、统筹台账和经验收的提交。
- S0 开发：`/private/tmp/metriccanvas-126-s0`，`codex/authoring-126-s0-t04`（已创建）。
- 基线白名单与逐文件 SHA-256 见 `baseline-assets.json`。CONTEXT 两组差异全部属于 ADR-0078；ADR 索引只新增 0078 行。规格、票稿、handoff 全部识别；三个 2026-09-14 计划分别是本版结构、参考手册及已决讨论依据，纳入。其他 worktree 全部排除；初次检查原工作区无额外代码改动，后续新增内容不自动纳入。
- 文档基线 SHA 由首个基线提交给出，后续在本表追加；历史源码与工作区保持原位。未 push、未更新 main。

## 会话与文件所有权

| 角色 | 实际 task ID / 状态 | 工作分支 | 票序与前置 | 文件所有权 |
|---|---|---|---|---|
| S0 | `01a09f5f-0882-7762-b736-c3ed8b5504e8` 已就位 | codex/authoring-126-s0-t04 | #130 无前置；统筹整合 | 本 coordination.md；t04-java-relay-proposal.md、t04-contract-examples.json、t04-verify-examples.py、t04-evidence.md；intranet-126-handoff.md |
| S1 | `01a09f69-8346-7e91-9c66-9e091d3f6e77` 已登记 | codex/authoring-126-s1-platform | #127→#128；M0 后 #139→#140→优先 #146，#141/#142、#145 | 现有 `apps/platform/src/lib/PageAuthoringWorkbench.svelte` （已核对路径）；page-assets-client.ts、page-assets.ts 与工作台相关测试/组装/导出由 S1 唯一修改；新增文件开工登记 |
| S2 | `01a09f69-a06b-7703-b87b-ccdfe05d765e` 已登记 | codex/s2-protocol-runtime-129 | #129→#131；#131/#132 集成后 #133；M0 后 #143→#144 | packages/page、engine、embed 的协议/运行时作者文件、公开导出及产品生成快照由 S2 唯一修改；首批精确文件见后文登记；参考手册总责 |
| S3 | `01a09f69-d2b5-71b0-ba93-c7cc183d4ee2` 已登记 | codex/s3-132-python-layout | #129 集成后 #132（不等 M0）；M0 后 #134→#135/#136/#137 | Python 内容算法、内容 MCP 注册与自有工具契约，开工登记准确路径；不手改产品快照 |
| S4 | 未开启；M0 后用户开启 | 待登记 | #138；#138/#140/#144 后参与 #145 | 生命周期 MCP 工具/注册/服务适配和其测试；不得修改工作台公共客户端与产品导出 |
| S5 | 未开启；M0 后用户开启且 S1 交接 | 待登记 | #127 已验收；续 #106/#107/#108 | S1 移交的盘古独立模块具体适配文件及配置；不修改工作副本或上游源码 |

目录只是责任范围，不是排他锁。所有新文件与跨线触点须先登记精确路径；缺路径不授权并发改公共文件。#131 若需工作台变更，由 S2 给 S1 最小补丁需求，S1 唯一写入。现有 page-assets-client.ts 仅传递已确认 POST/PUT 字段，idempotencyKey 未上行，getRevision 只接受当前匹配修订，均不得当作 T04 新能力已实现。

#145 分工：S1 独占发布界面、工作台入口、page-assets-client.ts/page-assets.ts 与 Platform 公共导出；S4 独占生命周期工具内部适配、注册与工具测试；S2 独占产品公共契约导出与生成器。S0 维护共同候选语义；S4 不复制或修改 S1 客户端。新增共享 DTO 作者源由 S2 登记后单向生成，未冻结前不各立一套。

## 验收与集成

| 票 | 本仓证据 | 外部确认 | 真实联调 | 集成提交 / 下游 |
|---|---|---|---|---|
| #127/#128 | 待 S1 逐票回执 | 盘古事实见 #106 | 待 #107/#108 | 无 |
| #129/#131/#133 | 待 S2 逐票回执 | 不以外部服务为本仓前置 | #103 待内网 | 无 |
| #132 | 待 #129 集成与 S3 回执 | 不适用 | Python 独立交付按票验证 | 无 |
| #130 | 方案与正反例本仓交付通过：21 场景/32 步骤、22 处文档校验；S1 已接受主要保存语义，S1/S2 完整接口证据待回执 | #105 只确认既有目录/详情/新增更新资料；新提案未确认 | 待 #105/#106 | `265b2ca` 文档交付；#138/#144 可评审，功能仍等待 M0 |

每票回执：范围/未实现、基线与提交 SHA、准确变更文件、公开契约版本、逐项验收与实际命令结果、外部状态、下游、回退方式。S0 核验后保留提交身份整合；下游以集成 SHA + 针对性兼容证据消费，不以关闭状态代替。

M0：#127–#133 七票全部验收并集成，公布完整 SHA 列表、旧/新版 report/dashboard、Python/浏览器/四交付物兼容证据及工作台浏览器回归，才发 M0 READY。#132/#133 是 M0 前工作，不受 M0 阻塞。
M1：#127/#134/#138/#139/#140/#146 的代表性闭环及断网/失败行为；#127/#134/#138/#140 都就绪即通知 S1 优先 #146。
M2：20 票本仓验收与回归、17 类组件、参考手册及分发门禁齐备；#145 前置仅 #138/#140/#144，由 S1 汇总 UI 和 S4 工具证据。
M3：#105 Java、#106–#108 真实盘古/Relay、#103 内网消费、#104 真部署及上游更新后集成。三种证据单列；不自动关闭 #95 其他目标。

## 等待与可复制续跑

首次读取任务列表未发现已登记 S1/S2/S3；不新建任务，不联系外部提供方。请用户开启首批角色时使用 handoff 原提示词并追加：

> S1：先向 S0 登记本任务 ID、独立 worktree/分支及准确文件。读取 S0 公布的集成 SHA，执行 #127→#128。对齐 t04-java-relay-proposal.md 的引用、操作关联、未知保存结果与冲突；逐票提交证据，M0 前不启动功能票。

> S2：先登记任务 ID/分支/文件并从 S0 集成 SHA 开工 #129。版本契约验收集成后通知 S0 解锁 S3 #132；执行 #131，待 #132 集成后做 #133，不等待 M0。对齐 T04 执行结果与参数作者源，未来参数语法不提前冻结。

> S3：先登记任务 ID/分支/文件；可以调查 Python 迁移和设计验收，收到 #129 集成 SHA 后执行 #132。使用 S2 生成快照，不等 M0，不提前启动 #134。

无可执行工作时有界结束并交接，不承诺自动后台继续。下一次统筹需读票最新评论、登记角色并核对提交，避免套用旧快照。

## 2026-09-14 本轮落地

| 集成输入 | 精确提交 | 范围与验收 |
|---|---|---|
| 共同文档基线 | `5d06583878fc18ab145be9315d608c6e90ca6775` | 43 文件：41 份逐项白名单交接资产 + manifest + coordination；原始 41 文件哈希不变 |
| S0 #130 文档交付 | `265b2ca35d3a5b9316bd1e3bc0c42cac32e8f719` | fast-forward 保留原提交；五文件方案/样例/checker/证据/内网增量交接，本仓文档检查通过；非消费者实现验收 |

本台账更新提交之后的 HEAD 是下一批开工集成 SHA，由 S0 消息和 #130 评论公布。当前集成源码仍为 `661d693` 的产品实现，新增的都是文档与样例检查工具；没有实施其他角色模块代码。

#130 本仓方案已交付；消费对齐待 S1/S2 真实登记并给出精确引用、保存四态、候选与执行接口兼容回执，Issue 保持 OPEN。完整证据见 t04-evidence.md。外部新契约未确认，真实联调未执行。

已两次查看当前任务列表，仍未发现登记 S1/S2/S3；未向旧任务发送消息，未创建任务。现在可由用户启动 S1/S2/S3，按上方可复制文字和对应 handoff 登记开工。S4/S5 继续等 M0 READY。无无界等待、无后台续跑承诺。

未完成及解锁条件：#127/#128 等 S1；#129/#131/#133 等 S2；#132 等 #129 集成 + S3。#130 消费对齐等待 S1/S2 回执。#103/#104 原内网环境按旧 handoff 等待，本版运行产物尚未生成，新增场景已写 intranet-126-handoff.md，未来据实际产物补版本与摘要。

## 首批角色正式登记（2026-09-14，取代此前“未登记”的当前状态）

三方主动登记，S0 已核对 `git worktree list` 并发送确认与彼此真实 task ID。共同开工 SHA 均为 `057703b1604f4937601f99534c713a4f72995c08`；本次只更新台账，不要求开发者中断工作合并此纯文档提交。

| 角色 | 已核工作树 | 当前可执行工作 | 下一交付 |
|---|---|---|---|
| S1 | /private/tmp/metriccanvas-126-s1 | #127→#128 | #127 独立/工作台挂载及更新演练证据；#128 契约与浏览器回归 |
| S2 | /private/tmp/metriccanvas-126-s2 | #129 | 冻结版本、旧版读取、双字段规则、唯一写出、规范化入口、黄金向量及兼容证据 |
| S3 | /private/tmp/metriccanvas-s3-132 | #132 调查、验收设计 | t06 验收设计；实现等 #129 验收集成 SHA |

### S1 首批准确文件

- `apps/platform/src/lib/PageAuthoringWorkbench.svelte`
- `apps/platform/src/lib/page-assets-client.ts`
- `apps/platform/src/lib/page-assets.ts`
- 新增 `apps/platform/src/lib/dialogue/port.ts`
- 新增 `apps/platform/src/lib/dialogue/PanguDialogue.svelte`
- 新增 `apps/platform/src/lib/dialogue/fixture-adapter.ts`
- 新增 `apps/platform/src/routes/dialogue/+page.svelte`
- 新增 `apps/platform/src/lib/workbench/authoring-coordinator.ts`
- 新增 `apps/platform/tests/workbench/dialogue-boundary.test.ts`
- 新增 `apps/platform/tests/workbench/authoring-coordinator.test.ts`
- 新增 `docs/plan/authoring-tickets-126/t01-evidence.md`
- 新增 `docs/plan/authoring-tickets-126/t02-evidence.md`

`analysis-page-state.ts` 只消费，不重写。#131 工作台最小补丁仍由 S1 唯一写入。

### S2 首批准确文件与待补清单

- `packages/page/src/version.ts`
- `packages/page/src/page.ts`
- `packages/page/src/page-document.ts`
- `packages/page/src/schema/page.ts`
- `packages/page/src/index.ts`
- `packages/page/tests/version.test.ts`
- 新增 `packages/page/tests/layout-compatibility.test.ts`
- `packages/engine/runtime-ui/src/RuntimeSurface.svelte`
- `tools/scripts/export-authoring-contracts.ts`
- 新增 `docs/plan/authoring-tickets-126/t03-layout-compatibility.md`
- 新增 `docs/plan/authoring-tickets-126/t03-evidence.md`

登记中的 `packages/page/src/parse.ts` 在基线不存在，已通知 S2 公共 parsePage 实际位于 `packages/page/src/validate.ts`，要求按真实改动补登记。新增运行时兼容测试尚缺准确路径；产品 snapshot/锁/导出文件由 S2 单向生成，生成后给完整清单，S3 只读。上述路径以外的新增触点继续追加，不能用整目录责任替代文件登记。

### S3 首批准确文件

- `metriccanvas-authoring/tool/metriccanvas_authoring/domain/page_building.py`
- `metriccanvas-authoring/tool/metriccanvas_authoring/domain/page_validation.py`
- `metriccanvas-authoring/tool/metriccanvas_authoring/application/build_page.py`
- `metriccanvas-authoring/tool/metriccanvas_authoring/application/compose_page.py`
- `metriccanvas-authoring/test-harness/tests/test_build_page.py`
- `metriccanvas-authoring/test-harness/tests/test_page_validation.py`
- `metriccanvas-authoring/test-harness/tests/test_compose_page.py`
- `metriccanvas-authoring/test-harness/tests/test_component_building.py`
- `metriccanvas-authoring/test-harness/tests/test_stdio.py`
- 新增 `docs/plan/authoring-tickets-126/t06-python-migration-acceptance.md`

无当前文件冲突。新增兼容模块若需要，S3 先追加准确路径；不修改产品生成快照或锁。

### #130 消费对齐与门槛

S1 登记已接受 resourceId/pageId/revisionId 分离、保存四态、未知结果不盲重发、能力不可用与旧页保留。这是语义回执，尚非接口/运行证据。已请求 S1 #128 补实际接口路径与测试、候选/执行兼容说明；请求 S2 回执原始文档 hash 验证先于规范化、精确执行 target/条件匹配/既有错误数据快照，不提前实现 #143/#144。

M0 IN PROGRESS，尚无新增实施票验收提交。S0 收到逐票回执后核验、集成、发精确 SHA；S3 可直接与 S2 调查，但不能把未集成开发分支当作 #132 可消费基线。S4/S5 尚未开启。当前消息已实际发给已登记三任务，无外部联系、无创建新任务。

### 首批补充回执

S1：干净工作树已装依赖并完成 svelte-kit sync，既有 page-assets-client / analysis-page-state / document-edit 共 3 文件 28 用例通过（S1 回执，S0 尚未作为本票验收重检）；#127 的模块加载/配置分离两项具体实施选择已向用户提问，等答复后实施，无产品提交。此等待只影响 S1 对应选择，不阻塞 S2 #129 或 S3 调查。

S2 更正/追加已登记路径：

- `packages/page/src/validate.ts`（替代不存在的 parse.ts）
- 新增 `packages/page/src/layout-compatibility.ts`
- `packages/page/src/internal.ts`
- 新增 `packages/embed/tests/browser/layout-compatibility.spec.ts`
- `packages/engine/runtime-ui/tests/version-error.test.ts`
- `packages/embed/tests/browser/version-error.spec.ts`
- `tools/scripts/page-conformance-vectors.ts`
- 新增 `packages/page/fixtures/contract-valid/layout-6.1-report.json`
- 新增 `packages/page/fixtures/contract-valid/layout-6.1-dashboard.json`

S2 版本方案回执：6.1 增量引入根 layout，6.0 layoutForm 保留读取；同值/异值双字段均拒绝；规范化写出 6.1 layout，缺省 report，组件 layout 不改。S0 已要求版本×字段组合完整矩阵及公共入口验证。此方案尚未交付提交，不解锁 #132。

T04：S2 书面接受“原始精确引用/hash 校验后规范化，规范化不覆盖旧修订”；执行响应匹配 target/operationId/源/有效条件，沿 queryField 与 DataSnapshot error，缺源拒绝，后续筛选不重初始化。S1 主要保存语义接受已记录；准确代码接口及消费兼容证据仍等 #128/#129 交付，未来参数/执行 DTO 不提前实现。未将这两份书面回执写成真实联调通过。

### S3 #132 准备文档验收与集成

- 来源 `24d6da8310a70919880bc28a904041a304e2324f`，基线 `057703b1604f4937601f99534c713a4f72995c08`；S0 核验祖先关系、唯一文件范围及 diff check，通过。
- 集成提交 `3b2a87db8128eb9ba4262236ed9d0e697b96c34d`，保留原提交作者；仅 `t06-python-migration-acceptance.md`，无产品/生成物改动。
- P01–P08 覆盖规范写出、构造回归、旧版读取、错误矩阵、内容保持、跨语言一致、副作用与独立交付。接受为调查/验收设计，不计 #132 实施通过。
- S3 回报旧基线 153 项中 151 通过、2 项受沙箱 bind 限制；该测试文件提权复验 7 项通过；Bundle 460 摘要通过。S0 审阅记录，未重跑未改变的产品测试，不将其作为新版兼容证据。
- 文中 6.1 接受单独 layoutForm 属 S2 待集成兼容提案；最终以 #129 黄金矩阵与验收 SHA 为准，不由准备文档冻结。#132 继续等待 #129，不等待 M0。
- S3 报告 #132 进度评论遭自动审批拒绝，理由包含本地路径/任务 ID/内部协作信息；未发布。S0 不代为重发或绕过该拒绝，执行证据暂保存在仓内；远端记录仍待允许的发布方式。此限制不阻塞本地文档整合。
