# 页面创作范围、两套 Skill 与能力归属

日期：2026-11-02。基于当前本地仓库与实际公共 MCP 注册核对；现已收到 Relay 源码/配置静态报告，见[接收与修正](https://github.com/CCharlesMeng/MetricCanvas/blob/09a7815c965bce921c2ef50202fa727ba9a8e705/docs/evidence/2026-11-02-relay-authoring-static-audit/README.md)。尚未直接取得私有源码、实际安装/注册或服务回执，不阻塞本次规划。本文补全[演进主计划](../2026-11-02-product-relay-evolution.md)的消费路径盘点，不将静态报告或参考 Skill 等同于真实部署。

## 0. 先按创作逻辑理解本清单

用户进一步明确：当前 local-authoring 主要承载**页面先行创作**，从页面到用数需求、数据源对接再完成页面；Relay 参考 Skill 主要承载**数据先行创作**，从用数需求与查询证据反推页面。两者共享 Schema 和统一运行时；页面先行能力未来也要在线上支撑用户自定义闭环。

因此，下文的文件/MCP、可见数据和安装差异是当前承载方式，不是两种创作逻辑的定义。后续能力记录同时标明“页面先行/数据先行”和“本地/线上”：不能因 local 的某脚本尚未在线注册就认为该创作逻辑只能离线，也不能仅把脚本搬到服务器就宣称线上闭环完成。详细统一方式以主计划和[接缝规格](implementation-seams-v1.md)为准。

最新源码级探查、实际测试及复杂度基线见[探查报告](source-audit.md)，据此形成[迁移和同步执行计划](migration-sync-plan.md)。以下为能力位置索引，不替代最新实测回执。

## 1. 先区分四个对象

1. **Relay Skill**：Relay 环境中的需求理解、计划确认、任务编排和结果采用。它通过受控工具执行任务，依赖 MC 提供的知识、契约和能力。实际部署可能有私有扩展；未见源码前不确认其实现清单。
2. **公开平台创作参考 Skill**：本仓 `metriccanvas-authoring/skill/metriccanvas-platform-authoring/`，含 SKILL.md、四类 workflows 和生成的事实参考。它描述 MC 的平台工具使用方法，是交付给接入方的参考，不能证明实际 Relay 已安装、未修改或完成相同流程。
3. **local-authoring Skill**：本仓独立安装的 `metriccanvas-local-authoring`。模型直接读取/编辑用户的完整 Page JSON，使用随 Skill 分发的知识与 Node 工具。运行时无需 Relay、MCP、Python 服务或开发仓源码。
4. **MC 产品能力**：Schema、统一运行时、共享查询执行、确定性装配/编辑、公共 MCP 服务及其知识输出。Skill 调用能力和决定如何采用结果，公共用例不能仅因在 Relay 中运行就变成 Relay 私有实现。

“线上/本地”区分执行路径和交付对象，不决定数据真假：local-authoring 可以消费项目已有的真实执行入口；没有入口时只能交未执行候选。Relay 也必须证明真实授权和服务接通，不能由工具名推断。

## 2. 两种逻辑当前的承载差异

| 比较项 | Relay Skill 路径（以公开契约为依据） | local-authoring 路径（入口已核对） |
|---|---|---|
| 输入 | 用户问题、当前页/选中项摘要、可信上下文、工具证据 | 用户需求、完整 Page JSON、设计源、指标说明 MD、项目提供的数据契约 |
| 模型写什么 | 结构计划、受控 edit operations、精确结果引用 | 完整页面声明或最小 JSON 对象修改 |
| 模型看什么 | 配置摘要、经授权的有界查询证据；全文在程序通道 | 需要修改的完整页面对象，可按对象提取大页 |
| 创建/修改执行者 | 公共确定性 MCP 服务 | Coding Agent 直接编辑文件，随包工具检查 |
| 能力上限 | 公共 request/operation 闭集及真实注册；私有扩展另核 | 页面 Schema 的合法表达范围与现有引擎行为；不受 compose/edit 枚举限制 |
| 数据获取 | discover/query 工具和可信 Adapter；结果由程序持有并发引用 | 分析材料与已有绑定；新增查询需项目已有真实执行入口；分析脚本自身不执行 DQE |
| 布局 | Skill 选信息结构；工具按受支持计划装配；能力不足明确缺口 | Skill 选范式后直接写 sections、布局、容器和交互声明 |
| 校验/迁移 | MC 内容脚本和公共服务；接入调用是否落地另验 | Node 独立校验/升级、尝试快照，直接作用于本地文件 |
| 交付 | 现行公共用例合法变化内部保存草稿，再交精确预览；发布由既有工作台/Java 裁决 | 校验过的文件和验证报告；文件不等于线上资产 |
| 更新方式 | MC 内容整包更换；产品工具服务配套更新；Skill 方法论和 Relay 接线按影响更新 | 完整 Skill 目录替换，知识、脚本、例子、清单一并升级；不依赖外部 MC 目录 |

因此必须分别维护 `renderable`、`local-json-authorable`、`composeable`、`editable`、`relay-deployed` 的证据，不能用其中一个状态代替其余状态。以上为能力记录维度建议，不是现有协议新增字段。

这些维度描述现有执行能力；还须补“页面先行用数需求提取/数据映射/增量绑定闭环”和“数据先行需求发现/证据到页面”的业务能力维度。最终不能用工具数量代替两种逻辑的任务验收。

## 3. 当前已核对能力

当前页面 Schema 与 local-authoring 校验器均报告 **6.77**，local-authoring SKILL.md 标注 **1.14.11**。公共组件目录有 **19 类**；compose 的数据块枚举为 **10 类**，另有文本块；实际 edit request 有 **36 个操作分支**。这些数字证明源码/注册范围，不证明所有业务组合、模型任务或真实服务已验收。

| 能力 | 当前所在位置/实现 | Relay 路径已知范围 | local-authoring 范围与限制 |
|---|---|---|---|
| 需求理解、口径澄清、计划审核 | 平台参考 Skill 的 `workflows/data-analysis.md`；local 的任务路由/形态/数据分析说明 | 参考流程要求审核计划再查数；真实 Skill 方法论待核 | 按任务决定局部/整页、Dashboard/Report、数据依据与缺口；不凭分析材料证明真实执行 |
| 数据能力发现与真实查询 | 公共 `discover_data_context`、`query_data`，Python data 能力及 Adapter | 公共工具已注册；实际权限、元数据、DQE 接通另验 | `analyze-data.mjs` 有 scan/find/index/draft/check/prepare；不内置在线发现和 DQE 执行 |
| 完整页面新建 | 公共 `compose_page`；local 直接写 JSON | title/layout/sources/sections/dateFilters/pagedJoins；仅受控形状 | 可声明合法 Schema 全页；原始需求覆盖、校验和实际呈现分别验证 |
| 普通数据组件 | 产品 19 类组件目录；compose 10 类数据块 | bar/line/pie、metricCard、table、gauge、keyValuePanel、categoryBreakdown、rankingCard、rankingDetailCard | 可按合法组件声明写 JSON；目录/示例完整不等于已验证创作质量 |
| 组合卡、页签、地图 | 产品 Schema/引擎；公共 edit 的 add_composite_card/add_tab_container/add_map_chart | compose 未直接支持；edit 组合卡子项和页签内容有受限 recipe | 直接写产品允许的结构，不受该 recipe 限制；仍需验证绑定/布局/交互 |
| IOC 页头、筛选和时间程序 | Schema/运行时；edit 的 set_ioc_header、维度/日期/区间筛选、set_time_program | 有公开操作；compose 默认创建 reportHeader，完整在线新建链需再核 | 已有专用页头迁移流程、筛选知识、场景与独立校验 |
| 分区、重排、标题、列宽等 | 公共 edit 操作；本地 JSON；平台人工工作台 | 有受控编辑；set_properties 等有白名单 | 按最小对象修改并核对完整引用和共享源消费者 |
| pagedJoin/pagedUnion/跨源计算 | 产品数据源、共享执行、MC/本地知识 | compose 有 pagedJoins；其他源型不能仅凭 Schema 存在认定可创建 | 有查询分页、完整性、行粒度和算子说明；真实 DQE 条件/行身份须另验 |
| 父子表/parentLookup/完整子表导出、自动同比环比 | Schema/引擎、生成参考与知识 | 当前受控装配/编辑缺完整入口，不宣称线上 Skill 已支持 | 可以按合法声明表达并校验；业务数据与导出结果仍需运行验证 |
| 模板参数提取/选择/填值 | 公共三个参数工具；产品参数变换；本地协议知识 | 三工具已注册；运行依赖/可信来源配置仍需检查 | 可编辑 params 与绑定；没有同名在线 extraction/template/instance 工作流 |
| MC 知识、模板编译、检查和升级 | `tools/mc-content/` 真源、生成 MC 独立包 | query/compile/inspect/schema/upgrade/evaluate 已提供确定性程序；真实 tools.py 注册未核 | 安装投影含知识读取、升级与校验；不要求调用线上 MC 工具 |
| 冻结失败样本、预览和自助修复 | local snapshot/校验/工作流；平台参考 create/edit 的预览复核 | 参考流程有精确预览与视觉复核要求；是否已真实执行未知 | `snapshot-attempt.mjs` 保留原字节，结构后可预览实际文件并修复；缺浏览器则明确未验 |
| 保存、发布、用户会话 | 公共创作服务、Java、Relay/云宝/集成门户 | 现行服务协调单次草稿保存；Relay 负责上下文和产物，Java 裁决状态 | 无内置线上资产保存、发布和创作会话能力 |

### 3.1 已核对公共工具

实际公共注册为 9 个：`read_page_context`、`discover_data_context`、`query_data`、`compose_page`、`edit_page`、`page_metadata_emit_preview`、`extract_page_parameters`、`apply_page_parameter_selection`、`resolve_page_parameters`。

Relay 的 `publish_page`、`submit_ai_summary_body`、`list_existing_page_urls`、`tool_mc_query/compile/inspect` 等在前序交接材料出现，但不是上述 9 工具的现成证明。它们究竟是已部署扩展、规划样例还是旧接口，须以真实 Relay 的注册和代码对账。

### 3.2 已核对本地独立工具

5 个 Node 脚本：`read-knowledge.mjs`、`validate-page.mjs`、`upgrade-page.mjs`、`analyze-data.mjs`、`snapshot-attempt.mjs`。分别负责知识读取、文档/文件名校验、旧页继续开发、用数材料分析和候选准备、原始尝试快照。没有脚本代替真实查询授权或在线保存。

## 4. 还在其他地方的创作能力

| 位置 | 作用 | 处理原则 |
|---|---|---|
| `packages/metric-canvas/` | 创作画布、选中/移动/就地编辑意图 | 人工页面搭建路径；不持有文档、属性面板、保存或撤销历史 |
| `apps/platform/src/lib/workbench/` | 工作副本、属性修改、历史、保护与保存协调 | 与 AI 路径共同修改 PageDocument；不能在两套 Skill 之外漏掉人工路径 |
| `docs/pangu-agent-authoring.md` 与平台集成接口 | 云宝 Agent/独立 dialogue、前端冻结快照和会话接入 | 与旧 Relay 当前资源模式分开核对；不是 local-authoring，也不能据接缝存在证明内网部署已接通 |
| `metriccanvas-page-builder`、compat entrypoints | 普通问数/临时页面路径及历史兼容资料 | 当前目录真实存在，部分说明仍写 Schema 6.11；先盘点消费者和活动入口，不能当成平台创建路径或直接删掉 |
| `.agents/skills/repair-page-metadata/` | 仓库内定位页面、查询和运行问题 | 复用产品校验，依赖仓库上下文；与独立 local-authoring 的离线修复范围不同 |
| `@metriccanvas/data-execution` 与 Node Bridge | 共用页面查询执行、参数与产品语义程序 | 供浏览器/可信程序/独立工具复用，不是另一套 Agent Skill |
| `docs/page-metadata/`、`reference-map.json`、`tools/mc-content/`、页面示例 | 规则、语义、布局组合与场景真源 | 同源派生两个消费面，不在安装 Skill 内反向维护事实 |

## 5. 当前同步链已经做了什么

- `export-authoring-contracts.ts` 从产品输出图导出契约、local 投影、知识和脚本；`mc-content-knowledge.ts` 也从产品 reference 与同一个知识核心生成 MC，不回读已安装的 local Skill。
- `tools/mc-content/layouts/report-composition.md` 已同时生成到平台参考 Skill 和 local 的 `references/page-patterns/report-composition.md`。
- `mcPlatformFacts()` 将工具、编辑、参数、交付、场景、数值等 MC 作者源投影到公开平台参考 Skill；这部分已是生成参考，不应另行手工维护。
- 两套 Skill 的工作流和任务判断仍为作者维护内容。共享事实已部分同源，不代表两套工作流、MCP 支持面及真实 Relay 部署已经同步。

这不是从零建设知识共享，而是补上“能力覆盖、公开服务同步、两条创作路径验收、真实 Relay 采用”的闭环。

## 6. 待真实 Relay 源码关闭的清单

需要取得：实际 SKILL.md 与 workflows/references/scripts、MC 安装包身份、工具注册/allowed-tools、tools.py 包装层、私有扩展工具、MCP 服务版本、加载/缓存/权限路径、artifact/preview 接线和真实保存回执。

后续接入时按“实际文件/段落 → 方法论/MC事实/产品用例/Relay接线/部署配置 → 真源 → 输出投影 → 验收”逐项对账。当前按用户确认的参考范围完成接口设计、能力盘点和迁移策略；不为真实 Relay Skill 宣布部署完成或保证升级无损。

## 7. 本文证据入口

- [本地 Skill](../../../metriccanvas-authoring/skill/metriccanvas-local-authoring/SKILL.md)、[本地用数分析](../../../metriccanvas-authoring/skill/metriccanvas-local-authoring/references/data-analysis.md)。
- [平台参考 Skill](../../../metriccanvas-authoring/skill/metriccanvas-platform-authoring/SKILL.md)、[创建流程](../../../metriccanvas-authoring/skill/metriccanvas-platform-authoring/workflows/create.md)、[编辑流程](../../../metriccanvas-authoring/skill/metriccanvas-platform-authoring/workflows/edit.md)。
- [公共 MCP 注册](../../../metriccanvas-authoring/tool/metriccanvas_authoring/entrypoints/mcp/platform_mcp.py)、[compose 契约](../../../metriccanvas-authoring/tool/metriccanvas_authoring/pages/compose_contract.py)、[受控容器构造](../../../metriccanvas-authoring/tool/metriccanvas_authoring/pages/components/container_building.py)。
- [MC 作者说明](../../../tools/mc-content/README.md)、[知识生成](../../../tools/scripts/mc-content-knowledge.ts)、[平台事实投影](../../../tools/scripts/mc-content.ts)、[本地投影](../../../tools/scripts/local-authoring-projection.ts)。
- [独立 Skill 维护与同步要求](../../agents/local-authoring-skill-maintenance.md)、[前序责任划分](../2026-10-24-layout-standards/mc-content-completeness-plan.md)。
