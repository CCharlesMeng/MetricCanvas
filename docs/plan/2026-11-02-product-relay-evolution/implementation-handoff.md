# 新会话实施交接：统一创作能力与 Relay 接入

> **2026-11-03 接续入口更新：** 先读[四项交付与 Relay 拆分规划](four-artifact-delivery-plan.md)，再将本文作为首批历史上下文。I08a 百分比纠错、I05a 纯扫描/范围已在 `/Users/moon/.codex/worktrees/relay-product-first-batch/DataDashboard` 实现并留有证据，未集成主线；不重复从零实现，也不整体覆盖生成物。新一轮先执行 B0，产品规则留 MC，真实 MCP/Java/DQE/状态存储/保存交接归 Relay。本文原有“公共保存协调归产品”等归属已被新决定修订。

日期：2026-11-02。用户已要求转入新会话实施。本轮设计、材料接收和内网反馈修订已完成；本任务尚未修改产品运行代码、MCP Interface 或生产 Skill。**接续目标是实施首批可验证改动，不再停留在泛化探查或重复方案整理。**

## 1. 接续入口与阅读顺序

工作目录：`/Users/moon/Documents/Code/公司项目/DataDashboard`。

1. 先读本文、当前 AGENTS.md 和 CONTEXT.md。
2. [实施规格](implementation-seams-v1.md)：首批文件职责、D1–D4、I00–I08 和退出条件。
3. [Relay 意见采纳判断](https://github.com/CCharlesMeng/MetricCanvas/blob/09a7815c965bce921c2ef50202fa727ba9a8e705/docs/evidence/2026-11-02-relay-design-feedback/assessment.md)：哪些已采纳、哪些仍矛盾，避免按返回件机械重写。
4. 需要完整 Interface 时读[内网评审稿 v1.1](relay-review-design-v1.1.md)的第 7–12、14.1 节；方法整理读 [skill-flow-simplification.md](skill-flow-simplification.md)。

主计划为[统一演进](../2026-11-02-product-relay-evolution.md)，执行任务为[迁移同步](migration-sync-plan.md)。v1.0 原稿和旧 ZIP 是历史冻结快照，当前评审版为 v1.1。维护文档不加入日常 Skill 必读链。

## 2. 已确认的产品方向

- 页面先行：页面/设计/固定结构 → 用数需求 → 数据发现/验真 → 映射接数 → 完善页面。local-authoring 是当前主要载体，未来也进入线上用户自定义闭环。
- 数据先行：业务问题/用数需求 → 可信查询证据 → 页面表达。保留不同的策略起点和顺序；本地/线上只是运行与交付维度。
- 两种策略共享产品 Schema、引擎、执行语义、确定性创作能力和知识真源；在同一工作副本接续，不重建会话或丢未保存修改。
- 公共查询/结果作用域、工作版本/CAS、保存协调、unknown 恢复和精确 preview 契约归产品。Relay 接线与公司 Java/DQE/元数据/存储 Adapter 独立维护。整个 adapters/ 当前是内部所有权，公共同步不覆盖。
- Skill 保持短，MC 完整可查，模板按需参考。格式/语义/绑定检查放进现有用例，不新增模型闸门、总控 Skill 或无必要管理器。工具验证承接后才删兜底提醒，local 直接编辑 JSON 的路径也要覆盖。
- 用户明确本轮显示约定为“百万仅用于 Tokens”；可信原始单位/刻度不篡改、不重复缩放，不从名称猜语义。全产品统一几位小数尚未裁决，不能自行发明统一策略。
- 优先保持或减少 Page Schema，将可复用逻辑放进既有产品能力；创作分析/映射中间状态不写入渲染 Schema。MCP 创作操作的演进与 Page Schema 升版分开判断。

## 3. 新会话先做什么

### A. 冻结当批基线，随后进入代码

核对最新 main、状态、工作树和相关文件差异，遵守当前仓库规则。需要隔离时优先复用合适管理工作树或创建新的隔离检出，保留主目录并行修改。

**重要：本交接和大量计划/原始证据目前未提交。新工作树不会自动带上它们。** 从上述主目录绝对路径读取；如需携带，按本批明确文件表复制必要设计/证据，保留出处，不能将主目录全部脏文件整体复制或暂存。

只做足以确定当批代码范围和测试基线的复核；已定目标不重新 grill。Relay 私有证据缺失不阻塞独立产品工作。

### B. 优先实施 I08 的第一个确定问题

先定位并复现现有字段格式决策：已确认百分比语义时，部分结果不应清除已知单位；来源 defaultFormat 是建议，不自动等于业务事实。首个小批优先修可证实的确定性缺陷，保留原值、粒度、查询、无关配置和保存行为。

主要定位：

- `metriccanvas-authoring/tool/metriccanvas_authoring/data/field_presentation.py`
- `data/source_mapping.py`、现有 `data/query.py` / `data/results.py` 调用点
- 现有字段/查询/装配测试、产品实际格式器和页面绑定规则

测试至少区分完整/部分/未知覆盖、已声明百分比/未知刻度、来源格式与用户显式意图、已缩放值、零/缺失/微小非零。先确认当前缺陷仍在，旧会话的探针不是当前代码的失败回归。不要一次把所有精度/图表策略塞进同一修复。

I08 完整范围还包括百万误用、最终绑定覆盖、local 同源承接和对应方法减负。没有明确可唯一推导的业务规则时保留缺口；可独立完成的部分继续，不擅自更改业务值。

### C. 随后推进或独立分批执行 I05

从以下文件提取无 I/O 的用数扫描/范围核心，保留原导出、CLI、材料证据和 execution:not-run 的边界：

- `tools/scripts/local-authoring-data-analysis.ts`
- `tools/scripts/local-authoring-data-scope.ts`
- `tools/scripts/local-authoring-data-cli.ts`

保持显式页面/Schema 输入、完整有序诊断、影响闭包和输入不变。Node hash、磁盘/manifest 与退出码留包装；线上先沿既有 Node 程序桥，不重写 Python 扫描器、不直接导入浏览器。

I05 与 I08 可分批并行设计，修改同一真源/生成物时串行集成。I06 多槽表达另成清晰批次；首批不以大搬目录或新增 mc-tools 包为前置。

## 4. 已知独立实现先核对复用

工作树：`/Users/moon/.codex/worktrees/presentation-knowledge/DataDashboard`。

包含未提交的呈现规则、`analyze-presentation.mjs`、`mc_presentation.py`、`presentation-policy.json`、向量和图表相关实现。已见策略 JSON 主要针对单系列柱图轴空档，不代表所有百分比问题已修。

只读核对相关函数、依赖、测试与主线的差异，按需复用。不要整包覆盖本仓真源，不把独立工作树代码称为主线已生效，也不要创建重复策略。该树由其他工作占用，保留其未提交内容。

## 5. Relay 返回意见：已采纳与不得混淆

已采纳的静态发现：

- Guard 据报更新至短提交 ca6c4b78：默认报告入口是 data-exploration-report，platform-authoring 需显式指定。I01/I07 应盘点两份 Skill/引用/scripts、真实工具和产物链；不擅自改回旧路由。
- list_existing_page_urls、submit_ai_summary_body 接受 context_ref，却不在十工具注入集合；I02 补可信注入，保留 Gate，不选择门禁豁免。
- tool_mc_* 是 MCP/Skill 同名双提供方，需要对账后唯一绑定；publish/list/submit 是另一组唯一提供方用例。
- nl2sql_prefetch 是 plugin、unified_dsl_execute 是工具、recall-report 是 subagent_visibility 名称。data-agent 流式路径还包含 nl2sql_prefetch。

不得按返回件覆盖的结论：

- 本仓实际离线注册 9 个与 Relay 静态定义 15 个是不同检出的事实。不能统一写成“15 个全公共”，也不能用相同版本号证明字节相同。
- current_turns 的轮次文件桥不等于 store。StateStore.read/compare_and_swap 的 namespace/key/version 与提交持久性需单独证明；原子写加身份 Gate 不等于 CAS。
- inspect 读取程序产物，不能因没有 context_ref 参数就归为纯静态知识；仍需可信 binding/artifact/spec 关联。
- state 中有 documentJson 不证明来自前端未保存工作副本；输入来源链仍需核对。
- 原页面换源首条切片是保留 ID、列、布局、交互和消费者的普通查询源替换，新增组件后删除旧组件不替代验收。

## 6. 仅需补的四类私有材料

1. 前后审计的实际内容根目录/manifest/摘要：原报告称 Relay MC=6.77，后反馈称不存在。
2. 同一工厂 current_turns/store 的实例和 read/CAS 实现：SQLite/文件桥说法冲突。
3. turnId 派生函数体、trace 生命周期与完整 binding：session/trace 说法冲突。
4. data-exploration-report 与显式 platform-authoring 的正文/引用/脚本、工具和产物链。

这些材料未齐时登记具体批次限制，不在 MC 猜造内部实现，也不等待它们才修独立产品缺陷。没有用户授权，不主动向其他聊天或外部渠道发消息索取。

## 7. 依赖与验收边界

- Relay 采用/接入：I01 → I02 → I03 → I04。
- 产品：I05 与 I08 可独立启动；I06 基于活动契约冻结后独立推进。
- I07 只读分析依赖 I05/I03；普通源接数依赖本批连接/相关正确性与 I03/I04；多槽接续扩展才依赖 I06。
- 精简某段生产方法，须先验证对应工具和 local 路径已承接；不增加默认模型步骤。标题/列宽等简单任务不强制读取查数/新建/模板材料。
- 沿原批处理、完整页验证、partial、单次保存、unknown 和精确 preview，不引入全页新准入门禁。

实施前读 `docs/agents/code-complexity.md`、`feature-acceptance.md`；Skill/知识变化读 `local-authoring-skill-maintenance.md`；Schema 变化先执行 `page-metadata-changes.md` 的最小化检查。修改及所有新增辅助函数均实测复杂度，新增目标 CC≤15，存量超限按规则处理。

功能/协议行为变化完成页面试验场可观察场景、页面元数据文档和 local 同步。产品、实际注册、MC、local 投影沿官方生成链对账，不手改生成知识或摘要。默认 Skill 验收只覆盖 local-authoring；真实 DS、内部部署、业务接口另按明确范围验收，不以夹具成功冒充。

原始输入、结构/语义、程序执行、浏览器/视觉、独立安装、真实服务、模型、远端 SHA/CI 分开报告。源码/格式/注册/包变化按本批运行适当回归，相关检查通过后不无理由重复扩大。

## 8. 交接时点状态与历史证据

交接实测主目录：main，HEAD `552ef5c1228ce292ad9a2ec66673fa82e1c67ba4`；活动 contract-lock 为 6.80。它已从早期探查的 `2133241...` 前进，不能用旧快照代替新会话基线。当前状态和源码指纹另存 [audit/handoff-start-snapshot.json](audit/handoff-start-snapshot.json)。本轮未 fetch/核对远端最新状态。

主要并行脏项包括 AGENTS/CONTEXT、其他计划、query-cascade 测试、pages/说明及多个其他任务产物；精确状态在快照，新会话再次读取。不要 reset、clean、整树暂存或删除这些工作。

当前工作树：主目录 552ef5c main；approver-params-delivery 已在 552ef5c detached；presentation-knowledge 仍在 2133241 detached。它们不是本次可直接清理的残留证明，接续按实际附件/状态核对。

历史证据：

| 时间点 | 结果 | 使用限制 |
|---|---|---|
| 初轮探查 | 218 项：206 通过、3 失败、9 报错 | 旧版本断言/路径/日期候选等台账，当前是否仍失败须重核 |
| 多槽补充 | 表格行对齐/页面契约 15/15 | 不证明工具支持多槽，不证明真实 Relay |
| v1.0 | MC 9 工具、6.77、Bundle 6,464 摘要通过 | 历史检出/脏工作区，不是当前 HEAD 的回归 |
| v1.1 返回复核 | MC 9 工具、6.80、Bundle 6,568 摘要通过 | 回执见 feedback 证据目录；不冒充交接后新 HEAD/远端/部署已验收 |

原始 Relay 静态报告及复核：`docs/evidence/2026-11-02-relay-authoring-static-audit/`。
本次返回原件、采纳判断、完整公共工具导出：`docs/evidence/2026-11-02-relay-design-feedback/`。
关联讨论“优化 mc-content 创作规范”的回执：`docs/evidence/2026-11-02-authoring-flow-alignment/`。
旧 UI/架构图在 `.archify/`，属于目标/设计，不是已实现能力证明。

内网包：`artifacts/metriccanvas-relay-design-review-20261102-v1.1.zip`；SHA-256 `29cb29ffff4dbf10b9c9238a8d16f4cb9f31de949350ebfbe331544b3915233b`。需要核对时以实际文件和 manifest 为准。

## 9. 新会话首轮交付

完成至少一个范围清楚的实现批次：给出原先失败的业务条件、修复行为、代码/生成范围、必要回归、复杂度前后值及剩余项。优先完成 I08 第一个确定缺陷，然后继续 I05 或下一清晰子批，不以再次生成计划替代实施。

用户本轮授权是接续实施，没有请求立即推送/部署。Git 交付在范围明确后遵守仓库 scoped-main-delivery；内部真实服务和模型范围另列。若遇到需要业务选择的真实歧义，具体定位并继续不依赖该决定的工作，不重问已定架构。
