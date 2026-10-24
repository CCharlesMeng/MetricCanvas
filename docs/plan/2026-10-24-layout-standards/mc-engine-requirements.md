# 对 MC 侧（引擎方）的诉求与约束：布局标准模块 + skill 依赖解耦

> 状态：**供 MC 侧/引擎方对接的需求文档**
> 日期：2026-10-24
> 背景：`metriccanvas-platform-authoring` skill 改造（布局标准模块 + MC 依赖解耦 + 原子化查询 + 基础能力评测）。本仓 skill 侧实施见 `skill-side-implementation-plan.md`；权威设计细节见 `layout-standards-frozen-design.md`。
> 核心诉求：**skill 与 MC 分别相对独立演进**——MC 依赖面（元数据协议/组件拼接/布局 standards/运行时契约）由 MC 整体提供，skill 核心只保留结构 + 必备信息要求。

---

## 1. 背景与运行原理

### 1.1 现状与问题

当前 skill（15 文件，451 行）对 MetricCanvas 存在**多重依赖**，且以**文件读取**方式消费：

| 依赖面 | 内容 | 规模 |
|---|---|---|
| D1 元数据协议 | discover/query 协议、业务域场景 | data-analysis.md、scenarios/ |
| D2 组件拼接/工具契约 | 工具签名与行为、错误码、operations 语法、组件能力边界 | tools.md、errors.md（**64 错误码**）、edit/create/parameters |
| D3 布局 standards | report/dashboard 布局参数、场景布局经验 | layouts/、scenarios.md |
| D4 运行时契约 | saveStatus、交接标记、**版本字面量**、字符约束、部署状态 | execution.md、SKILL.md、tools.md |

**三个问题**：
1. **耦合**：MC 演进（新工具/新错误码/新布局/新版本）必须同步改 skill 文档，否则运行时错误或视觉偏差（错误码/工具签名/布局经验三类最隐蔽——结构校验通过但行为错误）；
2. **上下文过载**：模型要读"整个文件"才能用"其中一段"（查一个错误码要读 64 条表），双层读取（索引+内容）放大，无返回边界；
3. **无版本实体**：MC 依赖散落 skill 文档，无版本指纹可校验，无法对齐 MC 演进。

### 1.2 目标运行原理（解耦后）

```text
                    ┌──────────────────────────────────────────┐
                    │  MC 侧（引擎方）独立维护 mc-content/       │
                    │  （随 MC 版本演进，不随 bundle wheel 打包）│
                    │                                            │
                    │  自动导出（构建期）：                       │
                    │    mc-closed-sets/snapshot.json            │
                    │    mc-content.version.json（含 evalStatus）│
                    │  内容包：                                   │
                    │    protocols/ tool-contracts/ runtime/     │
                    │    layouts/ eval/fixtures/                 │
                    └──────────────────┬─────────────────────────┘
                                       │ 注入（injected-or-file-read 通道）
                                       ▼
┌──────────────────────────────────────────────────────────────┐
│  skill（本仓）                                                │
│  ├─ 核心：方法论 + 工作流骨架 + 结构/必备信息要求              │
│  ├─ 引用校验：mc-content.version.json（不一致报错）             │
│  ├─ tool_mc_query：原子化查询（索引→原子片段，优先 CLI）       │
│  ├─ layout_compiler：缺省填充 + hardPin + 装配后复查           │
│  └─ eval/：能力矩阵 + 本地预筛（不依赖大模型）                  │
└──────────────────┬──────────────────────────────────────────┘
                   │ 输出纯结构计划（COMPOSE_SCHEMA 合法）
                   ▼
        compose_page（现有 MCP 工具，零改动）
                   │
                   ▼
        verify_after_assembly（装配后复查）→ preview（预览时验真）
```

**关键机制**：
- **评测闸门**：MC 内容包升级后，先跑 skill 基础能力评测（阶段 1 本地预筛脚本 + 阶段 2 真实回执），通过（`evalStatus=passed/exempted`）才允许模型用新包执行；failed 拒绝/回退旧包（程序强制，不依赖模型自律）；
- **原子化查询**：模型查单错误码/单工具契约，`tool_mc_query(topic, key)` 返回有界片段（同轮缓存、上限可配置），不读全量文件；通读场景（布局模板整体语义）才文件读；
- **版本对齐**：`mc-content.version.json` 记录 `authoringContractVersion/pageSchemaVersion/platformProtocolVersion/snapshotSha256/evalStatus`，与 `contract-lock.json` 对齐，不一致拒绝编译。

### 1.3 skill 侧能力边界（约束源头）

- skill 侧脚本是**工具函数**（skill_loader 自动注册）与**纯函数脚本**（layout_compiler），**不注册 Tool/Hook/不进 RuntimeView/不碰 PluginManager**（走 skill 原生 scripts/ 通道，不走插件体系）；
- 编译/装配全在 pages/ 活动链路，生效契约是 `referenced.py` COMPOSE_SCHEMA（`platform_mcp.py:19` 绑定），**MC 侧无需改工具签名**；
- 模型**无通用编程执行能力**（可编程 CLI 需改生产代码，推后）；mc_query 是受控工具函数，参数受 schema 校验。

---

## 2. 对 MC 侧的诉求清单

| # | 需求 | 说明 | 优先级 |
|---|---|---|---|
| R1 | **自动导出 `mc-closed-sets/snapshot.json`** | bundle 构建期从 `contracts/authored/*.json` + `contract-snapshot/page/component-catalog.json` + `capabilities.py` 装配门控导出闭集枚举（组件 10 类/width 4 值/purpose 7 值/pattern 7 类/assembled 门控集）；**禁止手工维护副本**（单一真源） | P0（第一批前置） |
| R2 | **同步写入 `mc-content.version.json`** | 记录 `authoringContractVersion/pageSchemaVersion/platformProtocolVersion/snapshotSha256/evalStatus`，与 `contract-lock.json` 对齐 | P0 |
| R3 | **skill 资源注入通道** | 覆盖 `protocols/` + `tool-contracts/`（含**错误码全集表**）+ `runtime/` + `layouts/`（catalog/standards）+ `mc-closed-sets/` + `mc-content.version.json` + `eval/fixtures/`；沿用 `referenceMode: "injected-or-file-read"` | P0 |
| R4 | **脚本执行能力（评估）** | skill 侧 scripts/tools.py 由 skill_loader 自动注册（本仓已支持）；**无需 MC 侧提供执行通道**；若部署态 tools.py 通道不可用，退化为文件读（skill 侧 F3 并存已保证） | P0（确认） |
| R5 | **bundle.json skills 声明确认** | `metriccanvas-platform-authoring` 的 scripts/references/layouts 子资源注入范围显式化；移除死声明 `skill/metriccanvas-page-builder` | P0（分发验收） |
| R6 | **评测夹具提供** | `eval/fixtures/`：用例数据 + 模拟回执 + run_eval 脚本骨架（E1：skill 定义能力矩阵，MC 提供夹具） | P0 |
| R7 | **模板内容卫生守卫** | 布局模板**只声明数据角色，不得含业务示例数值/字段名**（防止污染模型通道）；自动校验机制由 MC 侧在导出时执行 | P1（后续批次） |

## 3. 对 MC 侧的约束

### 3.1 内容包约束

- **mc-content 是"静态只读资源"**：不进 Session/durable store、不进 plugin/registry/manager、不进进程缓存（多容器须可达，由注入通道保证）；唯一合法载体是 skill scripts/ + references/ + mc-content/ 子目录，经引擎方注入通道分发（A1 架构口径）；
- **布局由 MC 整体提供**：`layouts/catalog.json`（唯一可校验入口，executable/planned 显式区分）+ `layouts/standards/<scene>-<variant>.json`（模板三段式）；**skill 侧只保留结构与必备信息要求，不复述 MC 事实**（E-形态）；
- **模板字段约束对照 COMPOSE_SCHEMA**（`pages/referenced.py:14-21`），**不是**旁路 v3 schema（`page-structure-plan.schema.json` 零调用）；但 v3 的 **purpose 枚举经 `structure_presentation.purpose_intent()` 间接消费**，模板 purpose 保留 v3 7 值集合；
- **可执行与不可执行显式区分**：`executable:false`（如 IOC 目标场景）必须带 `executableReason`（columnTracks 无创作入口 / mapChart·tabContainer·compositeCard 自动装配未迁移 / SOURCE_REFS maxProperties:6）；不可执行模板不得被编译；
- **版本对齐**：`mc-content.version.json` 与 `contract-lock.json` 对齐，`LAYOUTS_VERSION_MISMATCH` 时拒绝编译（版本治理从单轴变双轴，对齐责任归 MC 侧/引擎方）。

### 3.2 编译与校验约束

- **闭集知识从快照读，不复制**：MC 侧导出快照，skill 脚本零内置枚举副本（A3 单一真源）；
- **受控输入不变**：模型输出仍走 compose_page 现有链（受控输入/能力检查/数据引用检查/页面校验/单稿 CAS），MC 侧**不新增绕过校验的独立入口**（红线 1）；
- **必须内容不降级冒充**：删除/替换/降级必须内容时明确失败或报缺口，不以占位文本（`structure-missing-{id}`）冒充满足（C3 报缺口不静默覆盖）；
- **布局质量仅预览时验真**：脚本不解决视觉验收，MC 侧无需提供保存前视觉校验（红线 2）。

### 3.3 评测约束

- **skill 定义能力矩阵，MC 提供夹具**（E1）：能力清单+通过标准在 skill 侧（真源），用例数据/模拟回执/运行骨架在 MC 侧；
- **评测不依赖大模型**：阶段 1 本地预筛是确定性脚本（CI 可跑）；阶段 2 真实回执以部署环境为准（本地替身通过不能替代真实回执，execution.md 既有原则）；
- **全通过 + 显式豁免**（E3）：`evalStatus ∈ {passed, exempted, failed}`；exempted 须带豁免清单（原因+失效风险，MC 侧确认）；failed 阻塞纳入；
- **读前校验**（E4）：`mc-content.version.json` 写入 evalStatus，编译器/模型读包前校验，failed 拒绝编译/回退旧包（程序强制）。

### 3.4 演进责任约束

- **MC 导出 + skill 引用校验**（E-演进）：MC 侧负责内容包版本演进与导出；skill 侧保留引用校验层（引用版本指纹，不一致报错）；skill 核心仅当方法论受影响时才改；
- **版本对齐发布责任归 MC 侧**（B3）：检测到不一致时编译器拒绝编译，由 MC 侧重新导出对齐版本；
- **死声明处置**：`bundle.json` 的 `skill/metriccanvas-page-builder` 为死声明（目录不存在），按本次分发验收处理（移除或修正），不拖到以后。

---

## 4. 依赖面清单（MC 侧应提供的内容范围）

| 依赖面 | 应提供的 mc-content 内容 | 对应 skill 现文件 |
|---|---|---|
| D1 元数据协议 | protocols/：discover/query 协议（dataContextVersion/businessDomain/queryBinding/granularities/metricCompatibility/validationMode/discoveryProtocolVersion/readyRequirementIds/interactionEnvelope）+ 业务域场景 | data-analysis.md、scenarios/ |
| D2 组件拼接/工具契约 | tool-contracts/：10 工具签名与行为 + **错误码全集表（含修复策略映射）** + operations 语法 + 组件能力边界（metricCard 需 match/pieChart 需完整行集） | tools.md、errors.md、edit/create/parameters |
| D3 布局 standards | layouts/：catalog.json + standards/*.json（三段式模板）+ 布局参数（75rem/12 轨道/760px/columnTracks/backdrop）+ 场景布局经验 | layouts/、scenarios.md（部分） |
| D4 运行时契约 | runtime/：saveStatus 语义 + SAVE_RECONCILIATION_REQUIRED 锁死 + 交接标记（artifactRef/ready/两标记）+ **版本字面量** + utf8mb4 字符约束 + 部署装配状态 | execution.md、SKILL.md、tools.md |

## 5. 第一批验收前置条件（MC 侧需确认）

1. **R1-R6 可提供**，或明确降级路径（skill 侧文件读 fallback）生效；
2. **无状态"静态只读资源"口径**与 MC 侧对齐（§3.1）；
3. **bundle.json 分发清单治理**本次完成（§3.4 死声明）；
4. **评测两段式**可运行（阶段 1 脚本 + 阶段 2 真实回执环境）。

## 6. 相关文档索引

- `skill-side-implementation-plan.md`（本仓 skill 侧实施）
- `layout-standards-frozen-design.md`（权威设计：C1-C4/D1-D4/E-系/F1-F4 + 架构冲击 + 事实核验）
- handoff v2 `D:\tmp\metriccanvas-layout-standards-handoff.md`（原始背景）