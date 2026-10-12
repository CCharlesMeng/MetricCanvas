# 创作模块剩余迁移计划（第六批起）

日期：2026-09-21。依据：[模块架构方案](2026-09-20-authoring-module-architecture.md)第 5、6、10 节；已完成部分见[实施记录](2026-09-20-authoring-implementation-progress.md)。本文只覆盖**还没做的**部分，给出批次、目标位置、退出条件与不做什么。

前五批已完成 A01、A02、A04–A10 与迁移六步中的第 1–5 步；第 6 步只走完「入口」这一段。A03 剩尾巴，A11、A12 未做。

## 2026-09-22 续跑状态

已完成结构计划实现收敛与 7i 源码归位；`application/`、`domain/` 的存活模块迁至 `data/`、`pages/composition/`、`pages/components/`、`pages/editing/`、`pages/parameters/`、`pages/validation/`。v1/v2/v3 共用一套结构实现，保留独立取数，不构造临时整页再拆取。`data/results.py` 从 authored 计划契约读取请求 Schema，消除对页面装配模块的依赖。

参数链以 ADR-0088 为准：`params.query`/`params.display`，`filter.time.param/window`；原位 start/end-part 退役。页面包、Python 对等验证、发布消费者与运行时已同步。具体修改、测试与未完成项见[续跑证据](2026-09-22-authoring-resume.md)。

A11 来源矩阵已落到 `metriccanvas-authoring/SOURCES.md`，ARCHITECTURE 与 README 已链接；导出检查 current、Bundle 1683 项摘要检查通过。A12 已采用显式分类清单与统一 runner：69 个测试文件分为 rules 16、adapters 8、delivery 42、evaluation 3，默认全跑，遗漏/删除/重复登记均拒绝运行。保留物理路径以兼容跨文件夹具导入；这是对原目录搬迁方案的实施调整。完整 runner 运行 541 项，538 项通过、3 项受沙箱端口限制报错；不将本计划标为全部验收完成。Git 提交、远端 CI、浏览器与真实外部接线仍未完成。

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
| 7d ✓ | `discover_data_context.py`、`business_interpretation.py`、`source_description_ports.py`、`domain/{data_context,business_terms,execution,source_mapping,page_build_spec}.py` | `data/`（2026-09-21 已完成）。`grouped_params.py` 只被 `page_validation` 消费，改随 7i 进 `pages/validation/` |
| 7e ✓ | `authoring_turns.py`、`authoring_candidates.py`、`authoring_submission.py`、`authoring_recovery.py`、`content_ports.py` | `work/`（2026-09-21 已完成，先于 7d） |
| 7f ✓ | `lifecycle.py`、`lifecycle_ports.py`、`lifecycle_publish.py`、`publish_ports.py`（`authoring_deployment.py` 已随 7d 进 `assets/`） | `assets/`（草稿保存与发布兼容）（2026-09-21 已完成） |
| 7g ✓ | `build_page.py` | `ask/`（普通问数/探索用例）（2026-09-21 已完成） |
| 7h ✓ | `platform_authoring.py`、`summary_capability.py`、`bundle_info.py` | 平台用例进 `pages/platform_authoring.py`；摘要配置进 `delivery/`；bundle 元信息进 `bootstrap/`（2026-09-21 已完成，`application/` 包随之删除） |
| 7i | `domain/page_validation.py` | `pages/validation/`。**排在最后**，等 6.7 的 Python 对等校验落完再动 |

约束：每轮只搬位置与更新引用，不顺手改行为；`domain/` 清空后删除该包，不留空目录；不新建 `common/utils/helpers`。`application/` 已在 7h 清空并删除，`domain/` 要等 7i 才空。

7a–7c 做完后补记两点（2026-09-21）：

- 上表没有给第三批新增的 `domain/canonical.py`（确定性 JSON 编码与 sha256）和 `domain/java_save_fingerprint.py`（旧 Java 幂等键）安排落点。用户已拍板（2026-09-21）：`canonical.py` 留在包根 `metriccanvas_authoring/canonical.py`；`java_save_fingerprint.py` 随 `authoring_deployment.py` 进 `assets/`。两者已在 7d 落地。
- ~~`data/query.py`、`data/results.py` 直接 import `pages.composition.page_building`~~（2026-09-21 第八批已解决：取数单元一侧拆到 `data/executable_units.py`，共同的 `PageBuildingIssue` 进包根 `build_issues.py`）。同批把 `bundle_info.py` 从 `bootstrap/` 改到包根。剩 `data/results.py` → `pages.composition.page_structure` 的四个 schema 原语未解，归 A11。

## 3. 第八批 · 依赖方向与 A03 尾巴

依赖方向两条已于 2026-09-21 完成（见[实施记录](2026-09-20-authoring-implementation-progress.md)第八批）。下面的 A03 尾巴仍未做。

### A03 尾巴：三种组件能力的关系显式化 ✓

2026-09-21 已完成：新增 `pages/components/capabilities.py`，可渲染由产品目录决定（唯一读取点），可自动构造与允许编辑由一张显式声明表派生，覆盖检查在 import 时执行。原 `page_building.ASSEMBLED_COMPONENT_TYPES` 与 `component_editing.DATA_COMPONENTS` 两处硬编码删除。

至此第八批只剩本文第 5 节的 A11 与第 4 节的 A12 两批未做。

## 4. 第九批 · A12：test-harness 按验证层次分类

60 个测试文件与 6 个 stdio/浏览器入口分为：纯行为规则、Adapter 契约、宿主交付（MCP stdio / 浏览器 / Relay）、真实模型评测。附带约束：生产装配不 import 任何测试入口，测试夹具与真实接线证据分开存放。排在 7i 之后，避免与 `page_validation` 的跨会话改动撞车。

## 5. 第十批 · A11：真源与派生链标注

在 `contracts/`、`contract-snapshot/`、Skill references、`bundle.lock.json` 各处写明：哪份是手写真源、哪份是生成物、用哪条命令再生、离线安装为什么需要副本。不删任何离线安装所需副本。

### 5.1 反例投影片段化

`page-reference.ts:191` 现在把 `page/conformance/invalid/*.json` 逐字节搬进 `errors/`，每个用例内嵌一整页 invalid JSON。一棵参考树写到三处（`contracts/metriccanvas/page/reference/`、`contract-snapshot/page/reference/`、Skill references），174 个文件 1482 KiB × 3。

投影规则改为：保留 `case`/`invariant`，`input` 换成 `inputExcerpt`——只留每个 `expected[].path` 的祖先链，命中节点保留 2 层子树，超过 200 字符的字符串截断并标出原长（`*-too-large` 用例的体积全在这里）；`expected` 按 `type + message` 聚合为 `paths[]`，因为同一文案大量重复（`navigation-legacy-target-rejected` 135 条只有 25 句）；另加 `fullInput` 指回 `page/conformance/invalid/<case>.json`。

实测：1482 KiB → 209 KiB（−86%，单文件峰值 72.6K → 10.7K），仓内共省约 3.7 MiB，Skill 参考树 3.6M → 约 2.4M。完整向量原封留在 `page/conformance/invalid/`，不删任何离线安装所需副本，信息不丢。

改动点四处，都不动契约真源：

| 位置 | 改什么 |
|---|---|
| `tools/scripts/page-reference.ts:191` | 换成片段化投影 |
| `tools/scripts/page-reference.ts:220` | 生成的 md 末句「反例文件包含完整input及预期type/path」改成片段措辞并指出完整向量在哪 |
| `tools/scripts/page-reference.ts:246-255` | `branchExceptions` 改从 `inputs` 取原向量跑 `validate`/`branchWitnesses`，不再读投影产物（当前只有 `navigation-text-row-source` 一条） |
| `tests/page-reference.test.ts:50-53` | 对每个 `errors/*.json` 重跑 `validate(vector.input)` 的断言改为对 conformance 向量执行 |

已定的两件事（2026-09-21，用户拍板）：一是**验证职责从投影产物移回契约夹具**，反例文件此后只是文档，门禁由 conformance 向量承担；二是 SKILL.md 承诺的「参考目录自包含」收窄为片段自包含，反例的完整页面不再进 Skill，修页面元数据需要的是「哪个 pointer 触发哪条不变式」而不是整页。

本批额外退出条件：`errors/` 投影后每个用例仍能定位到全部 `expected` 路径；`validateReferenceLinks` 无断链；反例相关门禁在 conformance 侧仍然会因为陈旧向量而失败。

## 6. 明确不做

- 不改 MCP 工具名、参数 Schema、保存策略、两个 Relay 占位符。
- 不改 `metriccanvas_authoring.platform_server` 这个对宿主已发布的导入路径（`bundle.json`、`check_bundle.py`、导出器断言、Relay 接入文档都点名它）；要改需按外部契约变更单独决定。
- 不为目录整齐重排 `contracts/authored/` 下的 Schema，不动 `$id/$ref`。
- 不代写另一处正在进行的页面 schema 6.7 Python 对等校验。
- 本地测试不当作真实 Lab / DQE / Java / Relay 的验收证据。
