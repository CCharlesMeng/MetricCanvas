# 页面创作架构实施记录

日期：2026-09-20。基线为交接时已有工作区，保留此前方案、结构计划、页面参数与格式等未提交修改；未 reset、清理、提交或推送。开工时 tracked diff 备份位于 `/private/tmp/metriccanvas-before-implementation.patch`。

依据：[最小流程](2026-09-20-authoring-minimal-flow-and-skill-plan.md)、[模块架构](2026-09-20-authoring-module-architecture.md)、[Relay 影响](2026-09-20-authoring-relay-impact.md)。

## 第一批：真实复用接口与批次规则

实现：

- 从 compose 抽出独立查询执行用例，保留现有规格、版本、源描述、字段核对和错误语义。该用例返回程序执行结果，不对模型开放业务行。
- 章节装配直接构造数据源；新增图表直接构造数据源与组件；删除临时整页装配与页头拆取。
- 新旧 MCP 入站直接调用共同 compose 应用用例，不再以旧 MCP 工具作为内部业务调用。
- 暴露明确组件构造接口，替换跨模块私有函数导入；未把可渲染、可构造、可编辑三种能力强行合并。
- 同步与异步编辑共用批次规则，集中验证 ID、操作 Schema、前置依赖、回滚、完整页面有效性及 partial/unchanged 状态。
- 保留单组件新增的原 full-row 布局及 baseRevision 页面一致性检查。

本批不是模型协议切换：旧工具名、候选存储和保存策略继续服务现有消费者，普通问数没有自动保存。

## 第二批：Platform v2 单份工作稿与工具内保存（接手时已在工作区）

本会话开工时工作区已存在该批实现，此前未记录在本文；下列内容为本会话读码与整轮测试核对后的描述，不代表本会话编写。

- `application/platform_authoring.py` 为五个业务入口的用例：read / discover / query / compose / edit，外加程序侧 `recover` 与 `preview`。
- `work/state.py` 持有每轮单份工作稿、预算与 compare-and-swap 版本竞争；`assets/drafts.py` 冻结提交内容后只发一次，恢复只读取冻结记录、不重发。
- `delivery/preview.py` 区分 `document` 与 `previewJson`，产物用精确 `artifactRef` 关联，保留 `{{RESPONSE_START}}` 与 `{{PAGE_METADATA_PREVIEW_JSON}}`。
- `data/query.py`、`data/results.py`、`data/semantic_catalog.py` 提供受授权的有界证据与结果引用；`pages/referenced.py` 按结果引用装配与局部编辑。
- 入站 `adapters/inbound/platform_mcp.py` 与组合根 `platform_server.py`，存储 `adapters/outbound/platform_state.py`；协议说明 `contracts/authored/platform-v2-protocol.md`；v1 Skill 冻结在 `skill-compat/platform-authoring-v1/`。

## 第三批：规则所有权收敛与命名归位

对应模块架构方案 A06、A09，以及第 10 节“先做公共能力和规则收敛，再做物理归位”。

- 修复接手时的派生产物漂移：`bundle.lock.json` 对 `pages/referenced.py` 与 `test_platform_v2.py` 已过期，用既有生成器重新导出，不手改锁文件。
- 新增 `work/submission_records.py`，集中候选协议提交记录的字段集合、状态集合、终态集合、不可变字段、记录与轮次绑定的一致性、终态结果形状、快照不变量与合法迁移。SQLite Adapter 只保留文件安全、事务、原子读写与序列化，不再自带状态机。
- `authoring_recovery` 不再构造 `AuthoringSubmissionCoordinator` 去调它的私有 `_validate_record`；改为与 submission 共用公开的 `validate_submission_record`。
- 拆分 `domain/idempotency.py`：通用确定性编码归 `domain/canonical.py`（`canonical_json` + `canonical_sha256`，拒绝 NaN/Infinity），旧 Java 指纹幂等键归 `domain/java_save_fingerprint.py`，文档明确单次保存不得复用该键。原先四处各自实现的“canonical JSON 的 sha256”（`edit_page.document_sha256`、`work.state.digest`、SQLite `_hash`、recovery 内联）统一到一个实现。
- `domain/agent_core.py` 迁到 `ask/rules.py`（命名与目标 `ask` 模块一致），同步更新 page-builder SKILL.md、README 与测试；测试改名 `test_ask_rules.py`。导出符号仍叫 `AgentCore*`，本批未改公开符号名。

本批不改模型协议、工具注册面与保存策略；候选协议记录仍为其兼容消费者保留。

## 第四批：组合根收敛与端口按消费方归属

对应模块架构方案 A08，是第 10 节第 6 步“物理归位”之前的最后一项所有权收敛。入口与 Adapter 的物理归位（`entrypoints/{mcp,compat}`、`adapters/{java,relay,storage}`）按用户要求另列一批，本批不做。

接手时工作区被截断，先修复再实施：一次批量写入把九个文件清零，其中五个是上一会话已写入但未完成接线的 A08 首段源码，`bundle.lock.json` 被退回 11:46 的旧版本。恢复清单与事后核对见[截断与恢复记录](2026-09-21-workspace-truncation-recovery.md)。

本批改动：

- 装配集中到 `bootstrap/`：`environment.py` 一次性从环境选择出站适配器（含内容基线目录、摘要配置、lifecycle 三项，原先散在各入口模块）；`platform.py` 是目标组合根；`compatibility.py` 显式承载 `server` / `content_server` / `unified_content_server` / `lifecycle_server` 与部署装配。
- 入口模块只剩 CLI 委托与文档化的公开名。`platform_server.create_platform_server`、`server.create_production_server` 等既有导入路径保持可用；`platform_server` 不再从兼容 `server` 取适配器。
- 未配置的能力改为公开工厂 `unconfigured_data_context` / `unconfigured_dqe`，本地模型评测夹具不再 import 另一个模块的私有类。
- 端口按消费方归属：`data/ports.py`（治理元数据与执行）、`assets/ports.py`（保存回执）、`adapters/outbound/service_identity.py`（服务态身份）；删除汇总的 `application/ports.py`。
- 删除 `authoring_bootstrap.py`，`create_deployment_content_server` 归入 `bootstrap/compatibility.py`；同步更新 ARCHITECTURE.md 与 V1 归档中的路径。

本批不改工具注册名、参数 Schema、保存策略与 Relay 标记。

## 第五批：入口物理归位

对应第 10 节第 6 步的第一段。Adapter 与 test-harness 的归位按用户要求另列批次，本批不做。

- 入口迁入 `entrypoints/`：目标入口为 `entrypoints/mcp/platform_server.py`，四个旧入口为 `entrypoints/compat/{server,content_server,unified_content_server,lifecycle_server}.py`，目录本身表达“这是兼容面”。
- CLI 名称全部不变（`metriccanvas-authoring` / `-content` / `-platform-content` / `-platform-content-v1` / `-lifecycle`）。部署按 console script 启动（`uvx --from <sdist> metriccanvas-authoring`），模块路径对部署不可见，因此四个旧模块路径直接退役，不留根级别名。
- 根级只保留 `platform_server.py` 一个委托：`bundle.json` 的 toolServices、`check_bundle.py`、导出器断言与 Relay 接入文档都点名这个导入路径，属于对宿主已发布的名字，本批不改。
- 仓内消费者同批更新：pyproject 五个脚本、`tool/server.py`、README 三处、6 个测试、模型评测 `preflight.py` / `run_local.py`、两个浏览器检查脚本。`docs/archive/authoring-tickets-126/*-evidence.md` 与 `model-evals/history/` 是历史证据，未改。

## 第六批：Adapter 与 MCP 入站归位

对应第 6 步剩余部分，批次划分见[剩余迁移计划](2026-09-21-authoring-remaining-migration.md)。

- 入站 MCP 不再算 Adapter：`platform_mcp.py` 进 `entrypoints/mcp/`，`content_mcp.py`、`unified_content_mcp.py`、`lifecycle_mcp.py`、`publish_mcp.py`、`fastmcp.py` 进 `entrypoints/compat/`，与各自的启动入口同处。
- 出站按外部边界分组：`adapters/firstparty/`（Lab Data Context、DQE、页面资产、草稿生命周期、未接入的发布）、`adapters/relay/`（Relay 注入的只读输入与服务态身份）、`adapters/storage/`（两个 SQLite 适配器）。身份端口定义留在 `adapters/service_identity.py`，由全部出站适配器共同消费。
- `adapters/inbound/`、`adapters/outbound/` 两个目录已删除。仓内引用同批更新，含 `apps/platform/tests/workbench/language-relay-fixture.py` 这个跨目录夹具；历史证据与归档文档保持原路径不改。

命名上用 `firstparty/` 而不是方案骨架里的 `java/`：Lab 与 DQE 不是 Java 契约，按实际提供方分组更准确。

## 第七批：`application/` 与 `domain/` 按能力归位

对应[剩余迁移计划](2026-09-21-authoring-remaining-migration.md)第 2 节，分轮进行；每轮只搬位置与更新引用，不改行为。第三到第六批已于 2026-09-21 拆成五条提交进入 `codex/grouped-page-params`（第一、二批此前从未提交，作为同系列的基线提交一并落下）。

- **7a** `pages/composition/`：`compose_page.py`、`compose_content.py`、`unified_composition.py`、`structure_composition.py`、`create_content_page.py` 从 `application/` 迁入。`compose_content` 对 `edit_page` 的相对导入改为绝对路径（`edit_page` 到 7b 才搬），`authoring_deployment` 对 `compose_page` 的相对导入同样改绝对。仓内引用同批更新：`bootstrap/{platform,compatibility}.py`、三个兼容 MCP 入站、`build_page.py`、7 个测试与两个 stdio 夹具、`apps/platform/tests/workbench/language-relay-fixture.py`、ARCHITECTURE.md。
- **7b** `pages/editing/` 与 `pages/components/`：先把第一批的批次执行器 `pages/editing.py` 改为 `pages/editing/operation_batch.py`，给包腾出名字（三个消费者的导入同步）；再把 `edit_page.py`、`unified_edit_page.py`、`domain/page_editing.py`、`domain/section_editing.py`、`domain/interaction_editing.py` 迁入 `pages/editing/`，`component_policy.py`、`domain/component_editing.py` 迁入 `pages/components/`。`authoring_submission` / `authoring_recovery` 对 `edit_page` 的相对导入改绝对。产品参考真源 `docs/page-metadata/actions-and-navigation.md` 与 `components/README.md` 里的“源码定位”路径同步更新，派生副本由生成器重生。
- **7c** `domain/` 里的页面构造规则归位：`page_building.py`（单元派生、查询源与数据组件构造、整页装配）、`page_structure.py`、`layout_policy.py`、`section_layout.py` 进 `pages/composition/`；`container_building.py`、`text_map_building.py`、`component_selection.py` 进 `pages/components/`。`data/query.py`、`data/results.py` 对 `page_building` 的既有依赖随路径更新，但这条 `data → pages.composition` 的依赖本身与方案第 6 节“`data` 不调用页面装配”相悖，是搬迁前就存在的事实，留给第八批一并处理。`test-harness/fixtures/component-building.json` 里 `provenance.sources` 记录的是当时提交的来源路径，且其摘要被评测证据钉住，不改。至此 `domain/` 剩 `business_terms`、`data_context`、`execution`、`grouped_params`、`page_build_spec`、`source_mapping`（7d）、`page_validation`（7i），以及第三批新增的 `canonical`、`java_save_fingerprint`——后两者在剩余迁移计划里没有落点，需要在 7d 前补上。
- **7e** `work/`：`authoring_turns.py`、`authoring_candidates.py`、`authoring_submission.py`、`authoring_recovery.py`、`content_ports.py` 从 `application/` 迁入，与 `state.py`、`submission_records.py` 同处。三个模块之间的相对导入随包一起走；`authoring_submission` / `authoring_recovery` 对留在 `application/` 的 `lifecycle`、`lifecycle_ports` 改绝对导入，`authoring_deployment` 里四处延迟导入同样改绝对。仓内 30 个消费者（含 `adapters/relay/content_baselines.py`、`adapters/storage/sqlite_authoring_state.py`、`entrypoints/mcp/platform_mcp.py`、13 个测试、模型评测三份脚本、`apps/platform` 夹具）同批更新。先于 7d 做，因为它不依赖 `canonical` 的落点。
- **7d** `data/` 与两处用户拍板的落点：`discover_data_context.py`、`business_interpretation.py`、`source_description_ports.py`（原 `application/`）与 `data_context.py`、`business_terms.py`、`execution.py`、`source_mapping.py`、`page_build_spec.py`（原 `domain/`）迁入 `data/`；`domain/canonical.py` 按用户决定留在包根 `metriccanvas_authoring/canonical.py`；`domain/java_save_fingerprint.py` 随 `authoring_deployment.py` 一起进 `assets/`（后者原列在 7f，提前完成）。`authoring_deployment` 对留在 `application/` 的 `lifecycle`、`lifecycle_ports` 改绝对导入。**`domain/grouped_params.py` 没有随 7d 走**：它唯一的消费者是 `domain/page_validation.py`（相对导入）与 `test_page_validation.py`，两者都是另一处正在改的文件，按跨会话约定留到 7i 一起搬，落点也应改为 `pages/validation/` 而不是 `data/`。至此 `domain/` 只剩 `page_validation.py` 与 `grouped_params.py`；`application/` 剩 `build_page`、`bundle_info`、`lifecycle`、`lifecycle_ports`、`lifecycle_publish`、`platform_authoring`、`publish_ports`、`summary_capability`（7f–7h）。

## 后续依赖与明确未完成项

1. P0/P1：真实 Lab 语义摘要访问、详情身份映射、实际 Tokens 请求与响应贯穿对账；不能用其他指标详情补单位。
2. P2：受身份与版本约束的结果引用、模型证据投影、共享预算、独立查询注册面。当前查询内核仍消费兼容 Page Build Spec，不是目标纯取数协议。
3. P3/P3a：合并新建模型入口，结果引用装配与编辑，单份工作稿、冻结提交快照、工具内单次保存及恢复迁移。
4. P4：正式 Skill 与工具 Schema、安装资产整体切换；现有 Skill 不提前调用未注册工具。
5. P5：真实模型轨迹、页面业务与视觉检查、Relay 工作台交付验收。

Relay 的 compose_page_result 注入实现、edit 关联、卡片替换协议尚未取得；本批没有修改或验证真实 Relay/Java 部署。保留 `{{RESPONSE_START}}` 与 `{{PAGE_METADATA_PREVIEW_JSON}}` 的目标约束。源码测试只能证明本仓行为，不证明外部接线或保存回执。

## 验证

本批新增 `test_shared_authoring_capabilities.py`：取数不装配页面、章节/新增组件不造临时整页、入口不创建兼容 MCP Server、同步/异步 partial 与 unchanged 一致、失败数据操作隔离、跨页基线拒绝。

- 完整创作测试：454 项通过（29.846 秒，含本机 HTTP 与 MCP stdio 测试）。初次运行暴露两处随模块迁移需要更新的测试引用，已迁移；回环端口测试需在沙箱外运行。
- 最终非法输入保护补充后，新增能力测试与原 compose 回归共 21 项通过（0.219 秒）。
- 使用现有生成器 `node --import tsx tools/scripts/export-authoring-contracts.ts` 更新派生产物；导出检查为 481 product / 4 authoring / 1 interface。
- Bundle 完整性检查、`git diff --check` 通过。完整测试日志：`/private/tmp/metriccanvas-implementation-tests.log`。
- 未进行真实模型、Lab、Java 或 Relay 联调，也没有以测试夹具替代业务/视觉验收。

### 第三批验证（2026-09-21）

同一命令基线：`PYTHONPATH=metriccanvas-authoring/tool python -m unittest discover -s metriccanvas-authoring/test-harness/tests`（Python 3.12.13）。

- 改动前基线 479 项通过（34.4 秒）；A06/A09 改动后 479 项通过（32.5 秒）；`agent_core` 迁移与文档同步后再次 479 项通过（33.7 秒）。
- `python metriccanvas-authoring/scripts/check_bundle.py`：接手时报 2 处漂移，重新导出后 1542 项摘要校验通过。
- `node --import tsx tools/scripts/export-authoring-contracts.ts --check`：接手时报 `bundle.lock.json: stale`，重新导出后 current（481 product / 4 authoring / 1 interface）。
- `git diff --check` 通过。
- 仍未运行真实 Lab/DQE/Java/Relay 联调；本批只证明本仓行为不变，不证明外部接线。

### 第四批验证（2026-09-21）

- 恢复截断文件后先跑基线：479 项中 51 error / 1 failure，全部由上一会话未完成的接线造成（`application.ports` 拆分后 `DqeExecutionResult`、`DataContextError`、`PageAssetError` 三个名字在 6 个测试/夹具文件里漏接，模型评测夹具引用已迁走的私有类）。补齐后 A08 改动完成，同一命令再次 **479 项通过（31.7 秒）**。
- 逐个 import 五个入口模块与三个 `bootstrap` 模块，并实际装配 lifecycle、content 两个兼容 Server，确认委托链可用。
- 生成器一度不可用：页面 schema 6.7（`levelQueryFields`）缺参考文档时 `export-authoring-contracts.ts` 直接抛错。那是同一工作区里另一处进行中的改动，未代为修改；其文档于 15:08 补齐后重跑生成器，见第五批验证。
- 未运行真实 Lab/DQE/Java/Relay 联调，未做工作台视觉验收。

### 第五批验证（2026-09-21）

- 全量创作测试 479 项，**473 通过 / 6 失败**。6 项失败全部是 `test_page_validation` 的 `level-query-fields-*` 契约夹具：TypeScript 校验器与 schema 已实现 6.7 的逐级谓词字段规则（`validate.ts` 7 处），Python 对等校验器 `domain/page_validation.py` 里一处都没有。夹具于 15:08 由另一处进行中的改动写入，与入口归位无关，也不在本批范围内，未代为补写。
- 入口归位前的同一命令基线是 479 项全通过；归位后失败集合与归位前的差异只有上述 6 项夹具，`test_distribution`、`test_lifecycle_stdio`、`test_publish_stdio`、`test_model_eval_harness`、`test_content_mcp`、`test_unified_content_mcp` 等直接受影响的用例全部通过。
- 生成器恢复可用后重跑：`check_bundle.py` **1571 项摘要校验通过**，`export-authoring-contracts.ts --check` **current（489 product / 4 authoring / 1 interface）**。第三、四、五批的源码变更已一并进入 `bundle.lock.json`。
- `git diff --check` 通过。

### 第六批验证（2026-09-21）

- 全量创作测试 479 项，**469 通过 / 10 失败**。失败仍然全部是 `test_page_validation` 的页面 schema 6.7 契约夹具（`level-query-fields-*` 三个，另一处在本轮期间又加了 `duplicate-hierarchy-level-id`、`hierarchy-filter-flat-query-field`），Python 对等校验器未实现这些规则，与本批无关。
- 其余 469 项全部通过，包含直接受影响的 stdio、Relay、lifecycle、publish、platform v2 与部署装配用例。
- `check_bundle.py` **1577 项摘要校验通过**；`export-authoring-contracts.ts --check` **current（491 product / 4 authoring / 1 interface）**；`git diff --check` 通过。
- 一次性批量改写曾误伤归档与历史文档（`docs/archive/**`、几份 09-17/09-18/09-20 分析记录、`ARCHITECTURE-V1.md`），已逐份反向还原为当时的真实路径；历史记录不随重构改写。

### 第七批验证（2026-09-21）

- 7a：全量创作测试 479 项，**463 通过 / 16 失败**。16 项仍全部是 `test_page_validation` 的页面 schema 6.7–6.9 契约夹具（`level-query-fields-*`、`duplicate-hierarchy-level-id`、`hierarchy-filter-flat-query-field`，本轮期间另一处又加了 `boolean-target-not-boolean`、`number-range-target-not-number-range`、`time-point-target-not-time-point`），Python 对等校验未实现，与本轮无关；搬迁前同一命令的失败集合与之完全相同。重跑生成器后 `check_bundle.py` **1588 项摘要校验通过**，`export-authoring-contracts.ts --check` **current（495 product / 4 authoring / 1 interface）**，`git diff --check` 通过。
- 7b：全量 479 项，**463 通过 / 16 失败**，失败集合与 7a 完全相同。生成器由另一处（页面 schema 6.10）在本轮搬迁后重跑，`bundle.lock.json` 连同 7b 的新路径随对方的 `chore(contracts): regenerate exports for page schema 6.10` 提交进入；`check_bundle.py` **1590 项通过**，`--check` current，`git diff --check` 通过。
- 7c：全量 479 项，**437 通过 / 42 失败**。42 项仍全部在 `test_page_validation`：另一处的 6.10（`openDetail`）提交改写了 13 个 `navigation-*` 反例、两个版本反例与合法样例，Python 对等校验尚未跟上，与本轮无关（本轮未触碰 `page_validation.py` 与任何契约夹具）。生成器重跑后 `check_bundle.py` **1590 项通过**，`--check` current，`git diff --check` 通过；`bundle.lock.json` 的差异只含本轮 7 个搬迁模块、其消费者与两份参考文档的摘要。
- 7e：全量 479 项，**437 通过 / 42 失败**，失败集合与 7c 完全相同（全部 `test_page_validation`）。生成器重跑后 `check_bundle.py` **1590 项通过**，`--check` current，`git diff --check` 通过；`bundle.lock.json` 差异只含本轮五个模块、其消费者与 `authoring_deployment`。
- 7d：全量 479 项，**437 通过 / 42 失败**，失败集合与 7c、7e 完全相同。生成器重跑后 `check_bundle.py` **1590 项通过**，`--check` current，`git diff --check` 通过。本轮生成器顺带把另一处上一条提交（`chore(embed)`，改了 `packages/embed/tests/browser/embed.spec.ts`）漏再生的产品参考 `index.json`、`contract-lock.json` 与两份 manifest 更新到与 HEAD 一致，一并带入本轮提交；它们对应的源文件都已在 HEAD 里。
