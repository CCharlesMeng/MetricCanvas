# 当前 Skill 架构与模块说明

更新：2026-09-18。代码基线：`ad96e28`（本次核对的 `origin/main`）。面向 Skill、Python Tool 和平台维护者；Relay 实施步骤见 [对接指南](RELAY-HANDOFF.md)。本文说明实现，不新增协议或部署能力。

## 1. 范围、版本与历史基线

当前主体是 `metriccanvas-platform-authoring`：统一处理平台新建页面、修改当前页面和配置问答。它与普通问数的 `metriccanvas-page-builder` 并存，不是把问数链路全部替换掉。

| 标识 | 当前值及含义 |
| --- | --- |
| 代码基线 | `ad96e28`；部署必须额外固定提交和文件摘要 |
| Bundle / Python 包 | `0.2.0`；重构前后未更名为另一个主版本，单看此值无法识别实现代际 |
| Authoring 契约版本 | `0.2.0`；来源为 `contract-lock.json` |
| 页面 Schema | 当前生成 `6.5`，6.x 仅支持 6.5；页面读取兼容规则由产品契约负责 |
| 页面结构计划 | 支持 `1` / `2` / `3`，新建优先 `3`；这是创作输入版本，不是页面 Schema |
| Bundle 状态 | `local-core-verified-external-validation-blocked`；不能解释为生产集成完成 |

主要旧版对照为 `9d4f444`（`2a52f43` 的父提交）：已经完成 Relay/Python 迁移，平台仍拆成 create/edit 两个 Skill。更早的 Relay 问数说明以 `390b2bc` 为基线。另用 `14526fb` 区分“统一创作已存在”与本轮场景化/v3 增量，避免把所有能力都算作本轮新增。参数原位引用与三个参数 MCP 工具已纳入本次集成交付。

## 2. 核心分工

6.5 参数由 TS Page 包负责 extract/applySelection/resolve，Python `application.page_parameters` 管理可信来源、提取记录、选择与临时实例，并通过三个独立 MCP 工具投影安全摘要。工作台保留 `parameterSourcePort` 人工发布通道，新增 `parameterInstancePort` 只读临时运行通道；没有为 Java 补造 lookup/lease。接口、可运行示例与外部缺口见[参数接入交付](../docs/plan/page-parameter-inlining/external-integration.md)。

Skill 是模型的决策说明；Tool 是可验证的执行能力；Relay 是运行和可信交接的集成方。最终页面仍由同一个统一运行时渲染。

```text
平台用户指令 / 当前页面
  → 可信程序准备创作轮次、身份与固定基线
  → Relay 模型 + Skill：业务问题、组件选择、页面结构计划
  → 统一 MCP 门禁 → Python：取数验真、字段映射、受控装配、整页校验
  → 不可变候选 ──安全摘要──→ 模型定向修订
  → 可信程序选定最终候选 → 持久执行记录 → Java 单次保存
  → 已验证回执 / 页面文档 → 平台与统一运行时
```

模型不接收完整查询、数据行、页面基线或保存载荷；允许的静态业务说明和结构计划不等于任意页面 JSON。内容工具不保存、不发布；保存与恢复属于可信程序协调，发布由平台明确操作。普通问数保留临时页面态及用户显式沉淀边界。

## 3. Skill 层：决策与参考如何维护

唯一入口：[SKILL.md](skill/metriccanvas-platform-authoring/SKILL.md)。整个目录一起分发；只复制入口文件会丢失工作流及参考。

| 模块 | 职责与加载条件 |
| --- | --- |
| `workflows/create.md` | 明确新建：发现能力，规划业务章节，一次提交完整计划，检查并修订候选 |
| `workflows/edit.md` | 既有页修改或同轮续写：只改目标设置，保留未触及内容；不套新建默认 |
| `references/tools.md` | 首次调用前加载：实际服务、参数、通道、可信上下文与交接规则 |
| `references/reading-design.md` | 完整创建或整体重组：阅读任务、信息层级、组件选型、模块标题、业务文案 |
| `references/layouts/report.md` / `dashboard.md` | 新建或显式切换布局形态时加载：容器及占位默认，不提供任意 CSS |
| `references/scenarios.md` / `scenarios/*.md` | 经营报告、用量报告等示例组合；按场景加载，不强制固定章节数量 |
| `references/examples.md` / `errors.md` | 输入疑问和错误分支按需读取 |

布局范式分三层维护，不能只往提示词加规则：

1. **阅读决策**在 Skill：多组件业务模块保留分区标题；同层级三张指标卡显式 `width: "third"`，四张显式 `width: "half"`；业务正文不逐章展示执行口径。用户设置和主次层级优先。
2. **默认值与编译规则**在 [section-patterns.json](contracts/authored/section-patterns.json) 及 Domain：pattern 提供相对占位基线；`custom` 仍受同样的字段、组件和结构约束。
3. **实际呈现**在产品组件和统一运行时：白底、响应式、格式化、图表高度。报表指标组/图表章节优先 `panel`，纯表格或文字小节可用 `card`；`plain` 是透明容器。指标卡白底由产品组件支持，不靠模型填写颜色。

三卡/四卡和默认模块标题是 Skill 决策约定，不是校验器对所有合法页面的硬限制。结构计划 v3 的可选 `title` 也不意味着创作时默认省略标题。

八工具的实际作者是 [unified_content_mcp.py](./tool/metriccanvas_authoring/adapters/inbound/unified_content_mcp.py)，均要求 `context_ref`：

| 工具 | 职责 |
|---|---|
| `read_page_context` | 读取根基线或指定候选的有界结构/目标配置；显式省略与分页 |
| `discover_data_context` | 新增或改变数据需求的受治理发现；普通标题/布局修改不用它查文档 |
| `compose_page` | 新建上下文中按 Page Build Spec 装配数据候选 |
| `create_content_page` | 新建上下文中组合数据、静态内容及受控布局操作 |
| `edit_page` | 在根基线或同轮候选上应用局部操作，支持原子新增数据依赖组 |
| `extract_page_parameters` | 从可信验真来源提取，保存有时效的提取记录，返回候选与文本槽位摘要 |
| `apply_page_parameter_selection` | 按受控候选/槽位选择形成无值模板候选，必须人工发布 |
| `resolve_page_parameters` | 确定性赋值，产生只读临时实例，不执行查询、不保存 |

## 4. 输入、候选与最终页面是不同对象

| 对象 | 谁产生 / 谁消费 | 内容与用途 |
| --- | --- | --- |
| 页面构建规格 `spec` | 模型 → `compose_page` | 取数单元驱动的快速装配，按口径组织；兼容普通问数设计 |
| 页面结构计划 `request.plan` | 模型 → `create_content_page` | `dataRequests` 与 `sections[].blocks[]` 分离；一源多组件、跨口径同章、显式用途与呈现 |
| 创作候选 | Python → 可信存储/程序 | `rootBinding`、完整 `document`、hash、版本与 operations 审计；可保留结构状态及查询复用证据 |
| 页面元数据 | Python → 校验器/平台/统一运行时 | 普通页面 Schema；不夹带结构计划或模型推理状态 |

完整候选保留在 `structuredContent.artifactEnvelope` 程序通道，只向模型提供 `modelSummary`。生命周期保存、候选最终选择与执行记录核对由可信程序调用；本期发布由工作台明确发起，不作为这八个内容工具的直接写入权限。参数模板及其后续编辑不能走普通候选自动保存；临时实例不进入候选存储。详见唯一模型侧说明[工具与部署约定](./skill/metriccanvas-platform-authoring/references/tools.md)。

v3 数据块的 `purpose` 表达用途，`component` 选择受控组件，`width` 表达语义宽度；`presentation` 只开放已有实现的呈现族：

- `metric-summary` → `metricCard`：主值行与有证据的变化值，支持 `compactSummary` / `compactStrip`。
- `bar-comparison` → `barChart`：横向、堆叠等受控选项。
- `record-list` → `table`：密度、副标题、列对齐与视觉选项。

能力摘要由 [structure_presentation.py](tool/metriccanvas_authoring/domain/structure_presentation.py) 从当前 Schema 和实现映射派生；精确参数仍以工具 Schema 为准。关系证据来自 `MetricRelationsPort`，不是从字段名含“同比/环比”推断。缺关系可以独立展示字段，但不能伪造主辅关联。

## 5. Python 模块与调用链

依赖方向是入站 Adapter → Application → Domain；外部服务经 Port/Adapter 接入，组合根负责装配。源码仍在 `tool/metriccanvas_authoring/`，设计稿中的其他目录不代表已迁移。

| 层 / 模块 | 当前实现与职责 |
| --- | --- |
| 入站 | [unified_content_mcp.py](tool/metriccanvas_authoring/adapters/inbound/unified_content_mcp.py)：八工具、参数 Schema、轮次门禁、候选封套与安全摘要 |
| 可信轮次 | [authoring_turns.py](tool/metriccanvas_authoring/application/authoring_turns.py)：身份/请求/运行/轮次/页面绑定，基线完整性，有界配置投影及分页 |
| 内容路由 | [unified_composition.py](tool/metriccanvas_authoring/application/unified_composition.py)：计划与兼容 operations 分流；[unified_edit_page.py](tool/metriccanvas_authoring/application/unified_edit_page.py)：受控增量操作 |
| 结构装配 | [structure_composition.py](tool/metriccanvas_authoring/application/structure_composition.py)：预检、可信取数、块装配、合法部分结果、查询计数及程序审计 |
| 结构修订 | [structure_revision.py](tool/metriccanvas_authoring/application/structure_revision.py)：稳定 ID 补丁、父版本校验、原子失败、受影响查询更新 |
| 查询复用 | [structure_query_cache.py](tool/metriccanvas_authoring/application/structure_query_cache.py)：限定作用域与数据版本的执行复用；不是跨用户通用缓存 |
| 数据链 | [discover_data_context.py](tool/metriccanvas_authoring/application/discover_data_context.py)、[compose_page.py](tool/metriccanvas_authoring/application/compose_page.py)：受治理发现、查询派生、DQE 执行与字段物化 |
| 结构规则 | [page_structure.py](tool/metriccanvas_authoring/domain/page_structure.py)、[structure_preflight.py](tool/metriccanvas_authoring/domain/structure_preflight.py)、[structure_diagnostics.py](tool/metriccanvas_authoring/domain/structure_diagnostics.py)：版本、引用、保留 ID、预算及安全错误定位 |
| 呈现编译 | [section_presentation.py](tool/metriccanvas_authoring/domain/section_presentation.py)、[structure_presentation.py](tool/metriccanvas_authoring/domain/structure_presentation.py)：指标组、受控呈现、比例装箱及未修改属性保留 |
| 口径正文 | [structure_scope.py](tool/metriccanvas_authoring/domain/structure_scope.py)：v3 清理旧保留 ID 的自动说明；不自动新增逐章口径文字、不删除显式业务正文 |
| 字段映射 | [source_mapping.py](tool/metriccanvas_authoring/domain/source_mapping.py)：验证可信源描述并生成字段引用；[page_validation.py](tool/metriccanvas_authoring/domain/page_validation.py)：整页及跨引用校验 |
| 候选与提交 | [authoring_candidates.py](tool/metriccanvas_authoring/application/authoring_candidates.py)、[authoring_submission.py](tool/metriccanvas_authoring/application/authoring_submission.py)：不可变候选、最终选择、冻结命令、保存回执验证 |
| 恢复与持久化 | [authoring_recovery.py](tool/metriccanvas_authoring/application/authoring_recovery.py)、[sqlite_authoring_state.py](tool/metriccanvas_authoring/adapters/outbound/sqlite_authoring_state.py)：取消、预算、CAS、原操作与程序回执 |
| 部署扩展 | [authoring_deployment.py](tool/metriccanvas_authoring/application/authoring_deployment.py)、[authoring_bootstrap.py](tool/metriccanvas_authoring/authoring_bootstrap.py)：可信 registry 选择数据、业务、组件和系统实现 |

创建顺序：计划预检 → 取得同版本数据上下文 → 仅执行被引用的数据需求并复用等价查询 → 核对源描述 → 编译组件与分区 → 整页校验 → 存候选 → 返回安全摘要。`header` / `page-header` 由程序保留。一个块失败可以形成带缺口说明的合法部分候选，不能称为全部成功。

同轮 v2/v3 候选用 `structureRevision` 修订，携带原 `planVersion`、`parentVersion` 与 `candidate_ref`。支持替换块/需求、设置/移动分区、移除/移动块；纯标题和顺序调整不查数。没有结构状态的存量页面走普通受控 operations，不从页面 JSON 猜回原计划。下一轮重新建立基线，旧候选不是永久编辑句柄。

## 6. 数据、身份与保存的硬边界

- 新建字段 ID 默认是 `{sourceId}-field-{规范化 queryField}`；必要时用可信 logicalId/projectionId 消歧，最终后备为确定性摘要，不引入随机数。原 `queryField` 和 DQE 行键不改；既有页面字段 ID 不迁移。规则真源见 [映射协议](contracts/authored/authoring-data-mapping-protocol.md)。
- 统一写路径涉及新增查询时要求与数据上下文版本及实际查询一致的 `SourceDescriptionPort`；未知单位/刻度或规则链不靠样例猜测。创建与新增组件共用映射。
- `context_ref` 是定位引用，不是授权。工具每次从带外端口核验作用域与 active 状态，并在异步结果返回前复核；`access=read` 不能生成内容。
- 基线的 `documentJson` hash 是精确 UTF-8 字节 hash；候选 hash 沿 Python canonical JSON。两者不可混用，均不能证明 Java 的幂等或授权能力。
- 当前 Java 按 [ADR-0080](../docs/adr/0080-java-assets-single-attempt-save-and-status-publication.md) 单次保存。内容成功、候选生成、保存成功、发布成功是不同状态；未知写入不重发。历史强保存/精确回读路径只对实际具备能力的提供方适用。

## 7. 相对上一个大版本的变化

| 维度 | Relay 后、统一重构前：`9d4f444` | 当前：`ad96e28` |
| --- | --- | --- |
| 平台入口 | create/edit 两个 Skill；混合创建常需登记基线再转修改 | 一个 authoring Skill，内部按创建/修改/问答路由 |
| 服务与上下文 | `metriccanvas-content`，page_id / baseline_token / source_token | `metriccanvas-platform-content` 八工具，统一 `context_ref` 与带外可信轮次 |
| 参考分发 | 创建/修改复制共享约定及页面协议参考 | 平台作者参考自有、按需加载；生成器不覆盖；问数保留产品参考投影 |
| 页面结构 | 取数装配与受控 recipe 为主 | 数据需求与业务章节分离，一源多组件；v3 用途与受控呈现 |
| 迭代 | 程序重新登记产物为基线后续改 | 同轮不可变候选链、父版本和稳定 ID 结构补丁 |
| 字段与数据规则 | 旧映射及组件装配 | 可信源描述、可读字段 ID、主辅指标关系证据、作用域内查询复用 |
| 保存交接 | 内容产物交后续生命周期，模型不能冒称已保存 | 最终候选选择、持久冻结操作、单次提交和可信回执；取消/预算/恢复有程序边界 |
| 布局质量 | 基本 report/dashboard 默认与继承 | 业务阅读设计、模块标题、指标组白底、三卡一排/四卡两排、减少技术口径正文 |

其中统一入口/轮次/候选/恢复主要来自前一轮统一创作重构，Java 单次保存来自 `b8ab7ef`；本轮 `14526fb → ad96e28` 主要增加结构计划 v1–v3、场景参考、结构修订、可信关系与呈现、字段命名和布局反馈。普通问数的确定性 Agent Core、DQE 验真、双通道原则不是本轮新建，也未被删除。

## 8. 契约真源与维护方法

产品页面协议由 `packages/page/src/` 和 `docs/page-metadata/` 维护，导出到 `contracts/metriccanvas/`，再形成 Bundle 的只读 `contract-snapshot/`。创作输入、候选及交接契约在 `contracts/authored/`；Skill 不复制第二套 Schema。

扩展时按变更归属修改：阅读策略改参考；呈现能力同步输入 Schema、编译器、能力摘要和测试；新组件还必须有产品 Schema 与运行时支持；数据协议改 Adapter。部署 manifest 只能选择已注册实现，不能动态加载任意代码或启用不存在的服务能力。`metric_relations` 当前通过 `ComposePageDependencies` 注入，尚非 registry 的独立可选槽。

仓根验证：

```bash
pnpm authoring:contracts
pnpm authoring:contracts:check
python3 metriccanvas-authoring/scripts/check_bundle.py
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s metriccanvas-authoring/test-harness/tests -p 'test_*.py'
pnpm exec vitest run packages/engine/widgets/tests/composite-card-surface.test.ts packages/page/tests/metric-card.test.ts
```

修改 Bundle 内文档也会改变摘要锁。先运行导出再检查，生成副本和锁文件不手改。以上 Python 使用安装了 `tool/requirements.lock` 的 Python 3.12+ 环境。

## 9. 已验证与尚未闭环

`ad96e28` 交付时：485 项 Python、17 项相关组件测试、页面 Schema、契约导出一致性及 1510 项 Bundle 摘要检查通过。已执行真实 DeepSeek 生成并获得本会话人工认可；[最终页面与运行说明](../docs/plan/scenario-guided-authoring/README.md)明确记录最后一轮在候选生成后触发预算保护，不能标为模型整轮正常完成。中间原始轨迹已按用户授权删除，精选页面和汇总结论保留。

这些证据不是生产 Relay/Java/多用户权限联调。当前独立启动统一 CLI 缺可信轮次与候选提供方；新版结构契约的独立打包清单、通用部署装配器的强生命周期能力检查亦有接入限制，详见 [接入限制](RELAY-HANDOFF.md#integration-gaps)。本次文档更新记录事实，不顺带修改这些实现。
