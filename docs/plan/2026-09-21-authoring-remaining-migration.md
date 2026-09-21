# 创作模块剩余迁移计划（第六批起）

日期：2026-09-21。依据：[模块架构方案](2026-09-20-authoring-module-architecture.md)第 5、6、10 节；已完成部分见[实施记录](2026-09-20-authoring-implementation-progress.md)。本文只覆盖**还没做的**部分，给出批次、目标位置、退出条件与不做什么。

前五批已完成 A01、A02、A04–A10 与迁移六步中的第 1–5 步；第 6 步只走完「入口」这一段。A03 剩尾巴，A11、A12 未做。

## 0. 每批共同的退出条件

一批不算完成，除非下面五项同时成立：

1. 全量创作测试通过（当前基线 479 项；与本批无关的跨会话红项单独列出，不计入但必须写明）。
2. `python metriccanvas-authoring/scripts/check_bundle.py` 摘要校验通过。
3. `node --import tsx tools/scripts/export-authoring-contracts.ts --check` 为 current；派生产物只用生成器再生，不手改。
4. `git diff --check` 通过；新增文件无 lint 报错。
5. 仓内存活消费者全部改完再退役旧路径，不先删后补。历史证据文档（`docs/archive/authoring-tickets-126/*`、`model-evals/evidence/`、`model-evals/history/`）不改。

跨会话约定：`packages/page` 与 `domain/page_validation.py` 目前由另一处改动占用（页面 schema 6.7 `levelQueryFields`），本计划的批次排序刻意避开它们，直到那边落完。

## 1. 第六批 · Adapter 与 MCP 入站归位

现状：`adapters/inbound/` 6 个、`adapters/outbound/` 11 个平铺，入站 MCP 其实是接入点而不是外部协议实现。

| 移到哪里 | 放什么 | 理由 |
|---|---|---|
| `entrypoints/mcp/` | `platform_mcp.py` | 目标工具面的参数与返回投影，属于接入点 |
| `entrypoints/compat/` | `content_mcp.py`、`unified_content_mcp.py`、`lifecycle_mcp.py`、`publish_mcp.py`、`fastmcp.py` | 旧注册名的工具面，与旧启动入口同处 |
| `adapters/firstparty/` | `data_context_http.py`、`dqe_http.py`、`java_page_assets.py`、`lifecycle_http.py`、`publish_unavailable.py` | 第一方服务（Lab / DQE / 页面资产 / 草稿生命周期）的协议转换。方案骨架写作 `java/`，但 Lab 与 DQE 不是 Java 契约，用 `firstparty/` 更符合实际边界 |
| `adapters/relay/` | `content_baselines.py`、`lifecycle_spool.py`、`env_identity.py` | Relay 注入的只读输入与来自 MCP config 的服务态身份 |
| `adapters/storage/` | `platform_state.py`、`sqlite_authoring_state.py` | 存储技术实现 |
| `adapters/service_identity.py` | 身份端口定义 | 由全部出站适配器共同消费，留在 `adapters/` 根 |

本批额外退出条件：`bootstrap/` 之外没有模块 import 具体适配器；入站模块不再位于 `adapters/`。

## 2. 第七批 · `application/` 与 `domain/` 按能力归位（分轮做）

这是剩下最大的一块：`application/` 25 个模块、`domain/` 20 个。**不一次性搬完**，按下列顺序分轮，每轮独立满足退出条件。

| 轮次 | 搬什么 | 去哪里 |
|---|---|---|
| 7a ✓ | `compose_page.py`、`compose_content.py`、`unified_composition.py`、`structure_composition.py`、`create_content_page.py` | `pages/composition/`（2026-09-21 已完成） |
| 7b ✓ | `edit_page.py`、`unified_edit_page.py`、`component_policy.py`、`domain/{page_editing,section_editing,component_editing,interaction_editing}.py` | `pages/editing/`、`pages/components/`（2026-09-21 已完成；原 `pages/editing.py` 改名 `pages/editing/operation_batch.py`） |
| 7c ✓ | `domain/{page_building,page_structure,container_building,layout_policy,section_layout,text_map_building,component_selection}.py` | `pages/composition/`（page_building、page_structure、layout_policy、section_layout）、`pages/components/`（container_building、text_map_building、component_selection）（2026-09-21 已完成） |
| 7d | `discover_data_context.py`、`business_interpretation.py`、`source_description_ports.py`、`domain/{data_context,business_terms,execution,source_mapping,page_build_spec,grouped_params}.py` | `data/` |
| 7e | `authoring_turns.py`、`authoring_candidates.py`、`authoring_submission.py`、`authoring_recovery.py`、`content_ports.py` | `work/` |
| 7f | `lifecycle.py`、`lifecycle_ports.py`、`lifecycle_publish.py`、`publish_ports.py`、`authoring_deployment.py` | `assets/`（草稿保存与发布兼容） |
| 7g | `build_page.py` | `ask/`（普通问数/探索用例） |
| 7h | `platform_authoring.py`、`summary_capability.py`、`bundle_info.py` | 平台用例进 `pages/` 应用入口；摘要配置进 `delivery/`；bundle 元信息进 `bootstrap/` |
| 7i | `domain/page_validation.py` | `pages/validation/`。**排在最后**，等 6.7 的 Python 对等校验落完再动 |

约束：每轮只搬位置与更新引用，不顺手改行为；`domain/` 清空后删除该包，不留空目录；不新建 `common/utils/helpers`。

7a–7c 做完后补记两点（2026-09-21）：

- 上表没有给第三批新增的 `domain/canonical.py`（确定性 JSON 编码与 sha256）和 `domain/java_save_fingerprint.py`（旧 Java 幂等键）安排落点，`domain/` 因此清不空。方案第 5 节允许保留“确有多个消费者且语义相同的技术函数”，但没说放哪；7d 动手前先定：`java_save_fingerprint` 只服务 v1 保存路径，可随 `authoring_deployment` 一起进 `assets/`；`canonical` 被 data / work / assets / pages 四处共用，候选是留在包根或进 `work/`，需要拍板。
- `data/query.py`、`data/results.py` 直接 import `pages.composition.page_building`（`derive_executable_units`、`build_query_source`、`ExecutableUnit`），与方案第 6 节“`data` 不调用页面装配”相悖。这是搬迁前就有的依赖，7c 只把路径搬了过去；单元派生与查询源构造到底归 `data` 还是 `pages`，放到第八批（A03 尾巴）一起看，不在搬迁轮次里顺手改。

## 3. 第八批 · A03 尾巴：三种组件能力的关系显式化

`component_selection.py` 已读产品 catalog 做准入，但 `page_building.ASSEMBLED_COMPONENT_TYPES` 与 `component_editing.DATA_COMPONENTS` 仍各自维护。目标不是合并成一个列表——可渲染、可自动构造、允许编辑是三种能力——而是：三者各有唯一维护点，且用一致性检查表达关系（可自动构造 ⊆ 可渲染、允许编辑 ⊆ 可渲染），新增产品组件时缺配套会失败而不是静默漏掉。

## 4. 第九批 · A12：test-harness 按验证层次分类

60 个测试文件与 6 个 stdio/浏览器入口分为：纯行为规则、Adapter 契约、宿主交付（MCP stdio / 浏览器 / Relay）、真实模型评测。附带约束：生产装配不 import 任何测试入口，测试夹具与真实接线证据分开存放。排在 7i 之后，避免与 `page_validation` 的跨会话改动撞车。

## 5. 第十批 · A11：真源与派生链标注

在 `contracts/`、`contract-snapshot/`、Skill references、`bundle.lock.json` 各处写明：哪份是手写真源、哪份是生成物、用哪条命令再生、离线安装为什么需要副本。不删任何离线安装所需副本。

## 6. 明确不做

- 不改 MCP 工具名、参数 Schema、保存策略、两个 Relay 占位符。
- 不改 `metriccanvas_authoring.platform_server` 这个对宿主已发布的导入路径（`bundle.json`、`check_bundle.py`、导出器断言、Relay 接入文档都点名它）；要改需按外部契约变更单独决定。
- 不为目录整齐重排 `contracts/authored/` 下的 Schema，不动 `$id/$ref`。
- 不代写另一处正在进行的页面 schema 6.7 Python 对等校验。
- 本地测试不当作真实 Lab / DQE / Java / Relay 的验收证据。
