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
| #129 | 本票契约/浏览器范围验收集成；Python执行一致性由 #132 接续 | 无新增外部确认 | #103 待内网 | `dd64de0`；解锁 #131/#132 |
| #131 | 18文件范围通过，S0针对性65项通过，51浏览器证据采用 | 无新增确认 | #103/#104待真实环境 | 见下方集成映射 |
| #133 | 408文件实现及产物证据验收集成；双矩阵/旧读取保留 | 无新增确认 | #103/#104待内网 | `4207022` / `abc5ba8` |
| #132 | 作者+生成物+证据成套验收集成；旧新矩阵与独立安装通过 | 不适用 | 无真实Java/Relay/DQE | `6c25f08` / `631b470` / `c80f93a`；#133仍等#131 |
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

S2 #129 后续准确文件追加（无已登记冲突）：`tests/public-api/page.txt`（UPDATE_PUBLIC_API 单向生成）；`packages/engine/runtime/tests/ioc-project-overview.test.ts`、`ioc-project-detail.test.ts`、`ioc-opportunity-list.test.ts`、`ioc-opportunity-analysis.test.ts`。后四项沿用同目录前缀，原 6.0 fixtures 保留。S2 回报 normalizePageDocument 新增、parsePage 返回规范化 6.1/layout，27 文件 204 测试及新增矩阵 18 测试通过，ESM/IIFE 浏览器仍在执行。当前无固定提交，未正式验收；Python 新语义待 #132，要求明确失败向量/责任，不用新增 pending 豁免掩盖。

S3 准备文档追加 `f07a00e359b8ab8130a3cb49fc202d3575d6e2ce`：仅同一 t06 文档增加 4 行，记录从 S2 工作树只读核对的黄金向量、错误路径及无需新增 sdist 版本资产。S0 已审阅差异与 diff check，接受为待验收输入；无产品改动、不重跑旧测试、仍未解锁 #132。对应集成提交见本条前一个 Git 提交（保留来源作者）。

### #129 测试文件临时所有权例外（S1 明确授权）

S1 授权 S2 临时修改 `apps/platform/tests/workbench/promote.test.ts`：仅将旧 6.0 输入确认载荷的版本预期从 `versionPolicy.current` 改为 `document.schemaVersion`，并在需要时清理因此未使用的 import。随 #129 提交、验证及 S0 范围核验后归还 S1；此窗口内 S1 不并发修改该文件。不改 fixture、不改生产模块、不启动 #131 消费迁移，不将此例外扩大到其他工作台文件。S0 验收 #129 时单独核对此差异及测试结果。

## #129 契约范围验收与正式解锁（2026-09-14）

- 提供方提交：`64acd60501239904b9ae1f55a2618ed2a17d41bf`，起点 `057703b1604f4937601f99534c713a4f72995c08`。
- 集成提交：`dd64de0520249c3ede18246c4921871d2aaeab8e`。52 文件逐项核对；产品树（apps/packages/contracts/metriccanvas-authoring/tools/tests）与提供方固定提交无差异。原作者保留，本地集成未 push。
- S0 已读 #129 最新正文和 S2 交付评论、t03 契约与证据；审阅 normalizePageDocument / parsePage、版本/双字段规则、RuntimeSurface、生成器及公开测试。增量双读/唯一规范化写出/原始文档保持和升级顺序符合本票范围。
- S0 针对性复验：layout-compatibility、version、promote 三测试文件 **48 项通过**；产品导出 `--check` **190 product / 4 authoring / 1 interface** 无漂移；Bundle **474 digest checks** 通过；diff check 通过。在 S2 干净工作树固定提交运行，随后核对集成产品树等同。
- S2 证据采用：全量 **127 文件 / 936 通过 / 5 既有 skip**，pnpm check，Embed 构建及 **6 项 ESM/IIFE 浏览器**通过。S0 不重复全量和浏览器验证；非内网验收。详细可复现命令在 t03-evidence.md。
- 临时授权 `apps/platform/tests/workbench/promote.test.ts` 核对仅一行版本预期变更，现正式归还 S1。额外测试 `packages/page/tests/validate-cli.test.ts` 仅将 fixture 数量 11 改 13，S0 本轮补登记并认可；新 fixture/生成物完整文件名以 52 文件提交清单为准。
- 接收矩阵已冻结：6.0 layoutForm；6.1 layout 或单独 layoutForm；无字段缺省 report；任意双字段拒绝；6.0 layout 拒绝；未知版本拒绝。规范化完整原文复制后只改顶层版本/布局，不物化 params/initial，不覆盖历史修订。
- #129 此次通过的是契约与浏览器读取边界验收，足以提供 #131/#132 基线。跨语言共享期望已单向生成；Python 当前执行尚有三项差距，**不宣称全跨端一致性已通过**：layout-before-6.1 缺 SCHEMA_ERROR /layout；layout-dual-equal、layout-dual-conflict 缺 SCHEMA_ERROR /layoutForm。由 #132 完成并由 #133 汇总；不加 pending 豁免、不让 #132 等 M0。Issue 不因本次解锁自动关闭。
- S3 现在可消费本条所在集成 HEAD：先合入并验证预期三项差距及 32 项矩阵，再实施 Python；S2 消费同一 HEAD 后执行 #131。#133 继续等 #131/#132 验收集成。M0 尚未 READY。
- #130 与 S2 的原始 hash→规范化顺序已有书面及 normalizePageDocument 内容保持测试证据；S1 #128 实际接口兼容仍待交付，外部新能力与真实联调均未确认。

### #131 开工与 S1 临时移交

已向 S1/S2/S3 实际发送 #129 验收和解锁消息，共同开工 SHA `32d0e08976b443aed69d18922f12da051470fbc6`。S3 做 #132，S2 做 #131；当前新增登记不要求再次切换纯台账 HEAD。

S1 明确授权、S0 确认 S2 为下列四文件迁移范围唯一作者：

- `apps/platform/src/lib/workbench/document-edit.ts`：createCanvasAuthoringDraft 输入规范化，保留空分区投影。
- `apps/platform/src/lib/workbench/promote.ts`：两方向完整输出规范化。
- `apps/platform/tests/workbench/document-edit.test.ts`
- `apps/platform/tests/workbench/promote.test.ts`

测试覆盖旧输入→新输出及原文不变；#131 提交验收后归还 S1，期间 S1 不编辑。既有 #129 promote 测试授权已核验归还，现按本条 #131 范围续接。不移交 PageAuthoringWorkbench.svelte、page-assets-client.ts 或协调边界；禁止读取客户端在原文 hash 验证前规范化。

S2 #131 另登记：`packages/embed/examples/inline.html`、`esm.html`、`query.html`、`ai-summary.html`（同 examples 前缀）；`packages/metric-canvas/tests/browser/harness/document.ts`、`Harness.svelte`（同 harness 前缀）；`packages/metric-canvas/tests/browser/metric-canvas.spec.ts`；`apps/playground/src/lib/page-repository.ts`、`preview-document.ts`（同 lib 前缀）；`apps/playground/tests/preview-document.test.ts`；新增 `docs/plan/authoring-tickets-126/t05-browser-evidence.md`。最终按真实需要修改，其他新增共享路径另报；pages/迁移和发布支持说明留 #133。

### #132 作者实现进度（未集成）

S3 已消费 `32d0e08976b443aed69d18922f12da051470fbc6`，提交 `479bf25dd68d22470cd45663ae075c6c18e5a39f`，仅 6 个已登记 Python 文件；S0 已核对文件统计与 diff check。S3 回报三项语义差距修复、32 项矩阵/全量正反向量/10 组件×2布局通过；156 项全量仍有 2 项共享 expected.document 为 6.0 的差异。以上是进行中回执，非整票验收。

S2 负责从此精确作者提交更新共享构造向量作者源、生成物及锁，必须单独提交、不混 #131；S0 已向 S2/S3 发成套交付要求。S3 继续代表性产物产品校验和独立交付，等待生成提交后验证剩余差异归零并提供整票回执。作者提交当前未集成，不解锁 #133。

S2 生成隔离登记：从 `32d0e089` 建立 `/private/tmp/metriccanvas-126-s2-contracts`、`codex/s2-132-contracts`，消费 S3 精确作者提交后，单独修改 `tools/scripts/export-authoring-contracts.ts` 的当前 6.1 派生及生成物/锁；保留 `tools/fixtures/legacy-contracts` 历史源。生成提交交 S3 复验后与作者代码成套交 S0，不代表 #133 开工。S2 主 #131 工作树仍为 `/private/tmp/metriccanvas-126-s2`，工作分支更新为 `codex/s2-browser-layout-131`，基线 `32d0e089`；上述为角色回执，成套验收时复核实际树与提交。

### #132 独立生成提交到齐（待 S3 整票复验）

S2 生成提交 `4f6be5f5a33e41385d4dabbb96e67b7a5d885062`，父提交完整值 `eb87872d13ae4cf42c5a109b8bfed8e7b79e040e`（S3 作者代码在生成树的 cherry-pick）。S0 已核对恰 5 文件：`tools/scripts/export-authoring-contracts.ts` 与 `metriccanvas-authoring/bundle.lock.json`、`contract-lock.json`、`contracts/manifest.json`、`contracts/exported/build-page-conformance.json`。生成器先读取并核验冻结历史来源，再用公开 normalizePageDocument 派生当前 expected.document；未改 legacy/provenance，不从构造器结果反向编写期望。diff check 通过。

S2 回报生成无漂移（190 product）、474 摘要、compose 14 测试通过；S0 未据此替代整票测试。已通知 S3 仅将该生成提交合到自己的 `479bf25` 上，避免重复合入生成分支里的作者复制提交；整票回执需给实际组合 SHA、全量/产品/独立分发证据。两提交均暂未集成，#133 未解锁。

#131 临时文件新增（S1 明确同意、S0 已确认并通知 S2）：`apps/platform/tests/workbench/component-building.test.ts` 仅在当前版本测试文档构造处补 `layout: 'report'` 一行，使同义组件替换的内容保持比较使用规范工作副本。S0 已只读核对该用例；不改生产构造器/共享 fixture，保留其他旧版和缺省兼容用例。验收后与原四文件一同归还 S1。S2 回报50针对性、10画布、41Embed测试通过，单行修改后全量仍待复验，尚无#131整票提交。

S0 另发现 S2 工作树涉及 `apps/playground/src/lib/default-preview-page.json` 与 `packages/embed/tests/browser/layout-compatibility.spec.ts`，已要求补具体迁移/兼容解释；后者仍属于 S2，旧6.0输入测试不能因共享示例升级而变成双字段。正式验收以固定提交逐文件核对，不以工作树进行中状态判定通过。

## #132 成套验收通过（2026-09-14）

| 来源提交 | 集成提交 | 范围 |
|---|---|---|
| `479bf25dd68d22470cd45663ae075c6c18e5a39f` | `6c25f08cca61f040f64bdacb2f4e0bd5629b85c2` | 6 Python 作者/测试文件 |
| `1a185463a5357ce5b47fb5479f9f0cc3c99bec3c`（来源 S2 `4f6be5f`） | `631b47012b8944ab18489631cfefac1342c16b93` | 5 生成器/生成物/锁文件 |
| `2e5fcd5786f5a1cb65b10aa8b0a24e0899abb703` | `c80f93adb903f2288d543452fdd587e6081e9cd8` | 最终 t06 证据 |

S0 读取 #132 最新正文（无新增评论）、检查范围和代码，顺序集成且未重复取 4f6be5；集成产品树与 S3 实际验证组合 1a18546 完全一致。normalize_page_document 在完整校验后深复制，仅规范化顶层版本/layout；失败不返回产物，旧输入/原始字段保持，三项 #129 Python 差距归零，无 pending 豁免。

S0 复验：page_validation 5 项（包含32矩阵及全量正反向量）、component_building 1 项（十类×两形态）通过；Bundle474摘要通过；离开仓根用 Python -I 导入 S3 独立安装包，32矩阵通过，模块与 BUNDLE_ROOT 均来自独立安装目录。已读取最终全量日志末尾，156 tests / OK。S3 的14份产物产品CLI通过、sdist重新构建安装、190产品导出无漂移和stdio/替身全量证据采用 t06 最终组合记录，不冒称 S0 全量重跑或真实服务联调。

本仓范围验收通过；无外部新确认/真实联调。#133 Python 前置已满足，仍等 #131。#134 等 M0，不由此次放行开启。GitHub评论此前自动审批拒绝仍按原限制不代发；仓内验收与下游通知继续。回退作者+生成物成套，已产生6.1文档须保留#129双读。

## #131 验收集成与 #133 放行（2026-09-14）

- 来源 `4902f261d250f02679895e81c283de474b9105de`；集成 `bdca515b1578d0046929bd6bdc14838d56b257cd`。18 文件范围已核对，集成 apps/packages/tests/contracts 树与 S2 固定验证提交一致；#132 Python/生成器差异是前一批已验收增量，无冲突。
- S0 读取最新票正文/交付评论和 t05 证据，审阅工作台输入/两种沉淀出口、playground及示例迁移；原始文档/initial 保持，无 page-assets-client 或协调模块改动。
- S0 复验 document-edit/promote/component-building/preview-document 四测试文件 **65 项通过**，diff check 通过。采用 S2 已提交全量 **944通过/5既有skip**、check/build、画布 **10** 和 Embed **41** 浏览器用例及190产品无漂移证据，不冒称 S0 重跑全量/浏览器，也不冒称真实内网验收。
- 五个临时授权文件（document-edit.ts、promote.ts、对应两tests、component-building.test.ts）全部核对范围通过，正式归还 S1；S2 #133 不继续占用这五文件。default-preview-page.json 明确6.1/report；旧版Embed测试先移除示例新layout，再构造6.0/layoutForm，保持旧版真实覆盖。
- #131 与 #132 技术前置同时满足，S2 可消费本台账提交 HEAD 后执行 #133，不等待 M0。精确消费 SHA 通过实际任务消息公布。#133 需保留6.0/6.1旧字段读取、查全生产写出、成套生成/四交付物/存量迁移和支持区间证据；新增共享文件先登记。
- M0 仍未 READY：#127/#128 尚未正式交付，#130 等 #128 实际接口对齐，#133 正在解锁。#134 等功能票不提前开启，S4/S5未开启。

#133 已实际通知 S2 从 `9135d22f1616ff63357cbfce5cd6a80b016f0e24` 开工；同 SHA 已通知 S1 消费并归还五文件。S2 预登记 page.ts/page-document.ts 的运行态别名收口、布局/CLI测试及写出门禁、存量pages和当前样例、生成器/生成物、PAGE-METADATA.md、docs/host-contract.md、packages/embed/README.md、tools/package-build/README.md、t07证据/迁移说明。存量/新文件完整清单须开改前补齐，旧读取黄金样例保留。

S0 接受四发布包锁步 `1.0.0-rc.2` 作为本地6.1候选版本，不授权registry发布或push。S2需登记四package.json及实际compatibility.mjs路径；既有安全overrides不能为通过兼容门禁删除，应最小调整门禁以保留配置并验证实际两版本。浏览器及环境证据如实记录；#133不代表M2参考手册主体完成。

S1 回执并经 S0 核对：`codex/authoring-126-s1-platform` 已快进至 `9135d22f1616ff63357cbfce5cd6a80b016f0e24`，工作树干净；五个临时文件所有权已收回。#127 仍等待用户对两项实施选择的答复，尚无本角色产品代码提交；保持已规范化 document-edit/promote 边界，不在客户端提前变换原文。此等待不阻止 S2 执行已解锁的 #133，M0 状态不变。

### #133 精确开工清单

S2 回执：工作树 `/private/tmp/metriccanvas-126-s2`，分支 `codex/s2-layout-closeout-133`，基线 `9135d22f1616ff63357cbfce5cd6a80b016f0e24`，先复验18项兼容测试通过；未作为本票最终验收。

存量 `pages/` 11 文件：`empty-state-showcase.json`、`tokens-report.json`、`region-map.json`、`sales-detail.json`、`ioc-opportunity-list.json`、`ioc-project-overview.json`、`demo.json`、`customer-activity-risk-briefing.json`、`flow-analysis-report.json`、`ioc-opportunity-analysis.json`、`ioc-project-detail.json`。

`packages/page/fixtures/contract-valid/` 当前11样例：`grouped-fields-page.json`、`filters-page.json`、`url-navigation-page.json`、`inline-report.json`、`forecast-page.json`、`query-dashboard.json`、`composite-page.json`、`mixed-page.json`、`map-page.json`、`compute-page.json`、`params-page.json`；既有 layout-6-1 两样例不需升级。新增旧读取专用 `legacy-layout-report.json` / `legacy-layout-dashboard.json`；当前写出门禁明确区分用途。32矩阵生成前剥离当前样例layout再设置声明，保留原始6.0输入覆盖。

版本：`packages/page/package.json`、`packages/engine/package.json`、`packages/metric-canvas/package.json`、`packages/embed/package.json`；`pnpm-lock.yaml` 仅锁步需要时由工具更新。`tools/package-build/compatibility.mjs` 限最低版本既有overrides合并，以及真实运行证实必要的工具版本调整；安全overrides保留，回执说明依据。

新增 `packages/page/tests/canonical-writers.test.ts`、`tools/scripts/migrate-layout.ts`、`packages/page/tests/layout-migration-cli.test.ts`。S0明确迁移CLI为纯本地、显式输入→独立新输出，不覆盖原文/同路径、不留貌似成功的半成品、不调用资产保存或伪造修订；复用公开规范化，覆盖旧版两形态、幂等、非法版本及原文保持。工作台五文件不在本票范围。最终验收需完整实际生成清单与四包候选摘要；未授权发布。

#133 Python测试临时所有权：S3明确授权 S2 修改 `metriccanvas-authoring/test-harness/tests/test_bundle_info.py` 的 productContractVersion 硬编码 `1.0.0-rc.1` 断言，改为与本Bundle的 contract-lock 对账，并允许读取锁所需最小改动。保留版本一致性断言，其他Python作者代码不动；S3期间不编辑该文件，随#133提交/复验后归还。S0已通知S2；若该文件摘要受Bundle锁管理，仍通过唯一生成流程更新，不手改摘要。此例外不启动#134。

#133 测试路径追加：`packages/page/tests/filter-invariants.test.ts` 仅将旧6.0筛选回归输入改读 legacy-layout-dashboard，防当前6.1字段污染；`packages/engine/runtime/tests/ioc-project-overview.test.ts`、`ioc-project-detail.test.ts`、`ioc-opportunity-analysis.test.ts`（同runtime/tests前缀）仅将当前页面 requiredMinorVersion 预期0→1。均归S2，无已登记冲突。

S2报告已实测9135d22下兼容工具5.29分支因既有overrides断言失败，拟在原overrides块加入框架pins并保留安全条目，最终两版本矩阵待提交验收。S2报告临时解包Edge153.0.4234.32及官方摘要/签名/公证检查完成；S0尚未核验该外部来源或浏览器运行结果，要求正式t07回执提供完整证据，不以下载/解包成功判浏览器通过。当前pnpm check通过属于进行中回执。

#133 最终验收文件明确为 S2 独占 `docs/plan/authoring-tickets-126/t07-layout-closeout-evidence.md`、`t07-artifacts.json`。冻结验证树回报为 `96bd6b1e91e9a0861ce8de3d54b7279f8c030964`，未集成；S2阶段回报当前Svelte5.56.6隔离安装及Chrome/Edge102项通过，最低5.29.0源码test/check/build通过而仓外门禁仍在执行。最终文件须绑定两版本实际产物、8个tarball/Python sdist摘要和完整矩阵；S0收到整票回执前不判定#133或M0通过。

## #133 验收集成（2026-09-14）

- 实现来源 `27584af27ef3cec2475be308c2194075d8f8cd56` → 集成 `42070222c66a96e1d828789ed57eb866c8d13ae0`。
- 仅证据来源 `6add7c03ddbd354e462e6b6bab68e1eb7523c65d` → 集成 `abc5ba80e42725db0cb45f7723ba0824a6236940`。
- S0核对实现tree等于固定验证树 `96bd6b1e91e9a0861ce8de3d54b7279f8c030964`，408文件与manifest清单一致；集成产品树与实现提交一致。保留作者身份；只本地集成。
- S0审阅类型边界、迁移CLI原子新增与不覆盖、旧版矩阵/fixtures、生成器、最低版本overrides最小修复及迁移说明。11份pages逐一比较，除schemaVersion/layout外业务文档完整一致。历史ADR/冻结legacy来源及S1五文件未改。
- S0针对性复验：canonical-writers/layout-compatibility/layout-migration-cli 三文件25项通过；192 product / 4 authoring / 1 interface无漂移；478摘要通过；diff check通过。9份实际产物与30份日志SHA256全部与t07-artifacts相符，读取两版本源码测试/浏览器日志末尾核对951通过+5既有skip及各102浏览器通过。
- 采用S2真实矩阵证据：Svelte5.56.6和5.29.0各自四tarball仓外安装，page-only ESM、严格peer/types/Svelte/Vite、check/build通过；Chrome/Edge各套102用例，合计204，0浏览器skip/失败/flaky。四包check、Python156及sdist仓外32矩阵通过详见t07；不冒称S0重跑完整矩阵或真实内网验收。
- 本仓#133范围通过，四包本地候选rc.2、Schema6.1；旧6.0/6.1 layoutForm读取与双字段拒绝保留。新增 `docs/page-metadata/layout-migration.md` 属已登记迁移说明范围。test_bundle_info.py唯一临时修改符合授权，正式归还S3。
- 新布局候选产物与摘要已补到 intranet-126-handoff.md。真实registry/消费/Platform内网部署仍按#103/#104等待；当前候选不是M1创作闭环产物，M2手册主体未完成。
- M0仍未READY：#127/#128待S1，#130待#128实际接口对齐。S2 #143/#144与S3 #134不得提前启动；S4/S5未开启。

## #127 用户明确接入决定（2026-09-14）

用户已接受 dialogue 模块/独立入口；进一步明确盘古内部 dispatch 全局 Event，仅通知最新版本的草稿 ID，本仓负责事件定义、监听与处理。部署配置仅为不同环境的静态资源地址和版本号。此决定取代此前待确认的泛化 SDK 消息适配/部署连接参数设想；S0 已向 S1 实际发送续跑消息，解除两项 grill 等待，执行 #127→#128，不等待 M0。

S1 定义具体事件名、负载校验与监听生命周期，事件只传引用、不传页面文档或对话消息；不新增服务地址/凭据配置界面。重复通知、异步读回竞态、无效引用、读取失败保留旧画布、卸载移除监听/重复挂载需有本仓证据。草稿 ID 是否精确标识不可变版本须与现有领域/读取接口核对，由 S1 回传实际契约供 S0 对齐 #130；不能将可变资产 ID 默认为精确修订，也不能未经确认增加上游通知负载。

这是用户确定的产品接入要求，非盘古提供方已确认实现或真实联调证据；实际 dispatch、加载与升级演练的真实服务部分仍由 S5 接续。当前产品基线仍为 `29ca8a085027228199484ab19f044bae8d783cd6`，本条仅统筹记录。

### S1 解除等待后的精确路径补登记

S1 已开始 #127→#128，保留此前登记文件，新增独占：`apps/platform/src/lib/dialogue/runtime.ts`（地址/版本与资源装载）、`apps/platform/tests/workbench/authoring-browser.mjs`（边界替身及浏览器回归）；既有 `apps/platform/tests/workbench/platform-shell-and-composer.test.ts` 因对话组件抽取调整定位；`apps/platform/src/lib/RevisionPreview.svelte` 的可替换读取端口由 S1 负责，若实际路径不同须在修改前更正。不扩大至产品公共导出或其他角色文件。

S1 回执事件负载仅 draftId；精确 ID 解析由协调读取端口负责。现有 Java 只支持 current-match，未证实不可变 draftId 寻址，真实事件读回默认 CAPABILITY_UNAVAILABLE；禁止猜测 draftId 等于 pageId/revisionId。本仓替身可验证事件/读回流程，但不得计为外部能力确认或真实联调。该差距纳入 #130 消费对齐。
