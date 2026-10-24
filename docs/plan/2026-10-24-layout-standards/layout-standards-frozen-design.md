# 布局标准模块 设计冻结文档（v1.0）

> 状态：**设计冻结**（C1-C4/D1-D4/E-系/F1-F4 已 grill 确认）
> 日期：2026-10-24
> 依据：handoff v2 `D:\tmp\metriccanvas-layout-standards-handoff.md`（第 6 节四项 + 第 7 节四步）；源码事实核验见 §5、§1B、§13
> 范围：模板 schema + catalog 结构 + layout_compiler 接口 + skill 接线 + MC 依赖解耦 + mc-content 原子化查询。**不修改生产代码**（本轮红线）。

---

## 1. 已冻结决策（C1-C4）

| # | 决策 | 冻结结论 | 直接影响 |
|---|---|---|---|
| C1 | 输入模式 | **完整计划为主**：模型每次输出完整闭集结构计划；节点缺失=本页没有它；脚本只对**已存在节点**补缺省字段 | §4.3 输入语义全部按"存在性生效"，无继承/删除指令 |
| C2 | 模板引用传递 | **新增编译输入封套**（`templateRef` + `plan` 双层），脚本解封套→加载模板→补缺省→hardPin 校验→输出纯结构计划→走现有 compose 链 | §4.1 封套结构；不触碰 COMPOSE_SCHEMA/工具签名 |
| C3 | hardPin 管理 | **三类分层**：`productMandatory` / `userRequired` / `authorSuggested` 独立管理，冲突**报缺口不静默覆盖** | §4.2 模板 schema 的 hardPins 结构 + §4.4 缺口报告 |
| C4 | 第一批范围 | **不含 IOC 目标场景**：第一批只交付当前接口可完整生成的可执行场景闭环；IOC 在 catalog 标记 `planned`（不可执行），缺口清单+改动层级附 §6，不动生产代码 | §3 catalog 的 executable/planned 区分 |

**第二轮 grill（核心架构演进，D1-D4）**：

| # | 决策 | 冻结结论 | 直接影响 |
|---|---|---|---|
| D1 | 编译器形态与闭集知识来源 | **纯函数脚本 + 读契约快照**：脚本零内置枚举副本；组件/宽度/purpose/pattern/assembled 能力从**契约快照**动态读取（快照由引擎方随 skill 注入，见 D2） | 无双实现维护；契约升级→快照更新（随引擎方 skill 版本对齐） |
| D2 | 模板/标准资源分发归属 | **引擎方提供（skill 资源通道，独立维护）**：catalog/standards/scripts/契约快照全部作为 skill 资源由引擎方注入，**不随 bundle wheel 打包**，独立于 bundle 演进 | 走现有 `injected-or-file-read` 通道，零生产代码改动；验收"脱离开发目录可运行"的前提=引擎方注入完整 skill 资源 |
| D3 | 场景选择纠错责任 | **弱一致性校验**：脚本比对 plan 与模板的 pattern/component 重叠度，显著不匹配报 `SCENE_MISMATCH_GAP`（提示不阻断，模型可改 templateRef 或确认继续）；不强匹配（保留裁剪/重排发挥空间） | 选错场景时有提示；闭集合法性仍由 compose 兜底 |
| D4 | userRequired 来源真实性 | **封套声明 + 装配后校验**：模型在封套声明 userRequirements，脚本校验"声明的 mustBe 装配后保留、未被降级"；程序证明的是声明与产物一致，**不**验证用户原话真实性（靠模型诚实）；程序证据通道（受控上下文注入）推后 | 与 C3 一致；诚实度边界明确写入 skill 文档 |

**保留红线**（本次未变更）：
1. 脚本输出必须走现有编译链（受控输入/能力检查/数据引用检查/页面校验/单稿 CAS），**不新增绕过校验的独立入口**；
2. 布局质量仅预览时验真，脚本不解决视觉验收。

**外部依赖（待引擎方确认，不阻塞第一批设计）**：
- 引擎方 skill 注入范围须覆盖 `references/layouts/`（catalog/standards）+ `scripts/layout_compiler.py` + 契约快照（闭集枚举/能力门控导出）；
- 模型侧须具备脚本执行能力（layout_compiler.py 由模型运行）或引擎方提供等价工具通道；若两者皆无，D1 形态退化为"规则文档化"（见 §10 降级路径）。

---

## 1A. 架构冲击识别与处置决策（第三轮 grill，2026-10-22）

对方案的架构冲击按级别分类，每条对照已核实源码事实。**A1/A2/B1/B2/B3 已 grill 冻结；A3 自动导出方向已定，引擎方需求清单见 §1A.6；5 项架构待决项列入 §1A.7。**

### 1A.1 高冲击（架构性质被改变，必须显式管理）

**A1. 无状态架构新增"静态只读资源"类别 — 已认可**
- 现状：AGENTS.md §2.4 无状态铁律只有两类——跨消息状态（必须进 durable store）与代码。布局模板/catalog/脚本介于两者之间：静态只读、不进 Session、不跨消息，但也不是纯代码。
- 冲击：若不在架构口径上补一条"静态只读资源层"，两类误放会发生——①有人把模板塞进 plugin/registry/manager（违反无状态硬约束）；②有人把模板做成进程级缓存（多容器不可达）。本轮设计靠"引擎方注入"绕开了这两种，但无状态原则的表述本身需要扩展。
- **冻结处置**：新增"静态只读资源"类别（skill 携带的 .md/.json/.py 文件，由引擎方注入，不进 durable store、不进 plugin、不进进程缓存）。本设计文档作为该类别的首个实例；后续同类资源遵循同一约束。

**A2. 受控输入边界后移，信任链出现新环节 — 已认可**
- 现状：受控输入 = 模型输出完整结构计划 → 程序校验闭集（compose 的 COMPOSE_SCHEMA + validate_page_document），信任边界清晰。
- 冲击：布局标准后输入变两段式 `封套 → layout_compiler.py → 结构计划`，**脚本由模型侧执行**（D1 冻结形态）——脚本成了模型与工具之间的中间层。若模型有权改写脚本/模板，就是新的注入面（比直接传结构计划更隐蔽）。信任模型从"闭集校验"下移到"脚本产物校验"。
- **冻结处置**：显式声明**脚本只读守卫**——模型无权写 skill 资源（catalog/standards/scripts/snapshot），脚本作为不可变静态资源由引擎方注入；编译产物（plan + gaps）仍是结构计划，最终闭集校验由 compose 兜底（不变）。脚本执行若在模型侧沙箱，沙箱须禁止 skill 资源写入（架构待决项 §1A.7-T2）。

### 1A.2 中高冲击

**A3. 单一真源原则受威胁：快照导出机制 — 自动导出方向已定**
- 现状：生效契约单一真源 = bundle 契约（`contract-lock.json` 锁 sha256，`runtime_assets.py` 解析）。
- 冲击：D1 冻结"读契约快照"避免枚举双实现，但 **`closed-sets/snapshot.json` 谁生成**未定义。手工维护 = 双实现（违反单一真源）；自动导出 = 需要一个现仓不存在的导出机制（"缺源"模式）。
- **冻结处置**：**自动导出**（用户决策）。引擎方在 bundle 构建期生成 `closed-sets/snapshot.json`，随 skill 资源注入。本仓不维护枚举副本。详见 §1A.6 引擎方需求清单。

**B1. skill 可执行代码 vs PluginManager 收敛原则 — 已认可：走 skill 原生 scripts/ 通道，不走插件规则**
- 事实核对：`PROJECT_SKILLS.md:538/589` 明确 skill 标准目录结构含 `SKILL.md, scripts/, references/, assets/` → **skill 内含 scripts/ 是 skill 系统原生约定**，不是新机制；plugin contribution model（`RELAY_PLUGIN_SPEC.md` §2-3 Hooks/ToolDefinition/mode）针对"扩展 Agent 平台能力"（Tool/Hook/Mode/Auth），不针对 skill 内静态资源+辅助脚本——混用会让 PluginManager 堆职责（违反 AGENTS.md §2.3）。
- **冻结处置**：`scripts/layout_compiler.py` 走 **skill 原生 scripts/ 通道**，不走 plugin contribution model。显式声明边界（写入 skill 文档）：
  - `layout_compiler.py` **不**注册 Tool、**不**注册 Hook、**不**进 RuntimeView、**不**碰 PluginManager；
  - 它只是 skill 携带的纯函数脚本（与 `SKILL_PACKAGE_GUIDE.md` skill 目录结构一致）；
  - 这与现有 `references/` + `workflows/` 是既有目录树的自然扩展（不引入新机制）。

**B2. 双分发通道：分发验收从单包变双通道协调 — 已认可**
- 现状：分发 = wheel 打包（`hatch_build.py` force_include bundle/contracts）+ bundle.json skills 声明；`bundle.json` 已有死声明 `skill/metriccanvas-page-builder`（目录不存在）暴露分发清单治理缺失。
- 冲击：D2 决策后资源走**引擎方注入**（不随 wheel），验收"脱离开发目录可运行"需两条通道同时就绪。死声明必须本次修，否则"分发清单不可信"会传染到新通道。
- **冻结处置**：本次分发验收必须同时处理：①移除/修正死声明 `skill/metriccanvas-page-builder`；②补全 bundle.json skills 声明，明确 `metriccanvas-platform-authoring` 的 scripts/references/layouts 子资源由引擎方注入；③验收"脱离开发目录可运行"时显式确认引擎方注入通道就绪。

**B3. 版本治理从单轴变双轴 — 已认可**
- 现状：单轴版本 = bundleVersion + contract-lock（sha256 锁死）。
- 冲击：新增 templateVersion / catalogVersion / layouts.version.json 三件套，与 bundle 双轴并存。对齐责任（谁保证"新标准配新契约"）未分配——`LAYOUTS_VERSION_MISMATCH` 只检测不一致，不解决谁负责发布对齐。
- **冻结处置**：版本对齐由**引擎方**负责（与 A3 自动导出同一责任主体）；`layouts.version.json` 由引擎方在导出快照时同步写入（§1A.6-R2）；检测到 `LAYOUTS_VERSION_MISMATCH` 时编译器拒绝编译，由引擎方重新导出对齐版本。

### 1A.3 中冲击（需守卫或补机制）

**C1. 数据通道分离的污染面**
- 模板若含业务示例数值/字段（§4.6 已禁止），会污染模型通道（模型只应消费有界证据）。引擎方维护内容、本仓不控制 → 需要编译时"模板内容卫生"校验（扫描禁止字段），当前设计只有声明没有机制。
- 处置：列为架构待决项（§1A.7-T4），第一批先靠 skill 文档纪律 + 模板 schema 自校验（§4.2 禁止业务数值/字段名出现在模板）；自动化卫生校验进后续批次。

**C2. 测试/回归资产分散**
- 无 test-harness（F10），编译回归样例在 skill 侧新建，不入 pytest → 回归覆盖靠 skill 文档纪律，非 CI 强制。
- 处置：接受为独立回归通道（`workflows/layout-authoring.md` 显式声明回归样例位置与运行方式），CI 强制推后。

**C3. Guard/审计面变化**
- 模型输出从"纯结构计划"变为"封套"，Guard 的审计需要看到 templateRef/调整记录。现有事件协议不改（红线），先靠 modelSummary + 预览承载；观察项，不阻塞。
- 处置：观察项；若 Guard 审计后续需要 templateRef 进入正式事件，按事件协议规范（`event_protocol.md`）单独决策。

### 1A.4 明确无冲击（已由 C2/D2/红线保证）

- **MCP 工具签名 / COMPOSE_SCHEMA**：零改动（`platform_mcp.py:19` 绑定不变）
- **Session durable store / 数据查询链 / 证据通道**：模板不产生状态、不碰取数
- **前端 / 事件协议**：无新事件、无渲染改动；预览验真复用现有 `page_metadata_emit_preview`
- **Plugin 声明模型**：零新扩展点（B1 明确不走 plugin 通道）

### 1A.5 无状态原则扩展建议（A1 落地的架构口径补丁）

AGENTS.md §2.4 现有表述只覆盖"跨消息状态"与"代码"两类。建议后续在 AGENTS.md（或 DURABLE_STORAGE_PLATFORM.md）补一条：

```text
**静态只读资源**（skill 携带的 .md/.json/.py 文件，由引擎方注入）：
- 不进 Session / History / durable store（不产生跨消息状态）
- 不进 plugin / registry / manager（不扩展 Agent 平台能力）
- 不进进程缓存（多容器须可达，由注入通道保证）
- 唯一合法载体：skill scripts/ + references/ 子目录，经引擎方注入通道分发
```

本设计文档作为该类别的首个实例。**此项不阻塞第一批设计**，但建议在第一批交付前与引擎方对齐口径。

### 1A.6 向引擎方提的需求清单（A3 自动导出 + B3 版本对齐）

| # | 需求 | 依据 | 优先级 |
|---|---|---|---|
| R1 | **bundle 构建期自动导出 `closed-sets/snapshot.json`**：从 `contracts/authored/*.json` + `contract-snapshot/page/component-catalog.json` + `capabilities.py` 装配门控导出闭集枚举（组件 10 类、width 4 值、purpose 7 值、pattern 7 类、assembled 门控集），作为 skill 资源随引擎方注入；**禁止手工维护副本** | A3 单一真源 | P0（第一批前置） |
| R2 | **同步写入 `layouts.version.json`**：记录 `authoringContractVersion` / `pageSchemaVersion` / `platformProtocolVersion` / `snapshotSha256`，与 `contract-lock.json` 对齐 | B3 版本对齐 | P0 |
| R3 | **skill 资源注入通道**：覆盖 `references/layouts/`（catalog/standards）+ `scripts/layout_compiler.py` + `closed-sets/snapshot.json` + `layouts.version.json`；沿用 `referenceMode: "injected-or-file-read"` | D2 + A1 | P0 |
| R4 | **脚本执行能力**：模型侧沙箱可执行 `scripts/layout_compiler.py`，或引擎方提供等价工具通道；沙箱须**禁止 skill 资源写入**（A2 只读守卫） | A2 信任边界 | P0 |
| R5 | **bundle.json skills 声明确认**：`metriccanvas-platform-authoring` 的 scripts/references/layouts 子资源注入范围在声明中显式化；移除死声明 `skill/metriccanvas-page-builder` | B2 分发验收 | P0 |
| R6 | **模板内容卫生守卫（后续）**：引擎方维护模板时，模板不得含业务示例数值/字段名（只声明数据角色）；自动校验机制由引擎方在导出时执行 | C1 数据通道分离 | P1（后续批次） |

### 1A.7 架构待决项（第一批设计可冻结，但需在交付前确认）

| # | 待决项 | 冻结时默认 | 触发确认时机 |
|---|---|---|---|
| T1 | **快照导出机制**（A3） | 自动导出（R1），引擎方构建期生成 | 第一批前置验收 |
| T2 | **脚本执行者 + 只读守卫**（A2） | 模型侧沙箱执行，沙箱禁止写 skill 资源（R4）；无沙箱则退化为规则文档化（§10） | 第一批前置验收 |
| T3 | **版本对齐发布责任**（B3） | 引擎方负责（R2），检测不一致拒绝编译 | 第一批前置验收 |
| T4 | **skill 可执行资源加载语义**（B1） | 走 skill 原生 scripts/ 通道，不注册 Tool/Hook；4 层技能加载对 scripts/ 的隔离与只读规则沿用 skill 既有约定 | 第一批前置验收 |
| T5 | **模板内容卫生校验机制**（C1） | 第一批靠 skill 文档纪律 + 模板 schema 自校验；自动化进后续批次（R6） | 后续批次 |

**第一批前置验收条件**（T1-T4 必须确认或明确降级路径，T5 可延后）：
1. 引擎方确认 R1-R5 可提供，或明确降级路径（§10）生效；
2. 无状态原则扩展建议（§1A.5）与引擎方对齐口径；
3. bundle.json 分发清单治理（B2）本次完成。

---

## 2. 目标架构（混合模式，C1/C2 冻结后）

```text
模型（读标准后发挥，输出完整闭集结构计划）
   │
   ▼
layout_compiler.py（skill 侧前置纯函数）
   │  输入：编译封套 { templateRef:{scene,variant,version}, plan:{...完整闭集结构计划} }
   │  处理：1) 加载 catalog + 模板（按 scene/variant/version 精确解析）
   │        2) 仅对 plan 中【已存在】的 section/block 补缺省字段（模板值）
   │        3) hardPin 校验：productMandatory 装配后复查；userRequired 声明满足
   │        4) 缺口冲突 → 返回 gap 报告（不静默覆盖、不写库）
   │  输出：纯结构计划（COMPOSE_SCHEMA 合法输入）
   ▼
compose_page（现有 MCP 工具，生产代码零改动）
   │  normalize_compose → compose → validate_page_document → 单稿 CAS 保存
   ▼
页面草稿 → page_metadata_emit_preview → 预览时验真（布局质量）
```

关键约束（源码核验结论，见 §5）：
- 生效契约是 `pages/referenced.py:14-21` 的 **COMPOSE_SCHEMA**（sections 必填、minItems 1、块级 oneOf 闭集、`additionalProperties:false`），不是旁路 v3 schema；
- MCP 工具 `compose_page` 的 request 类型直接绑定 COMPOSE_SCHEMA（`platform_mcp.py:19`）→ **模板字段不能进工具请求**，只能走 skill 侧封套；
- 模板缺省填充必须在 `normalize_compose` 通用默认填充**之前**完成（否则无法区分模型显式选择与程序补值，修订意见补充五）。

---

## 3. catalog.json 结构（唯一可校验入口）

**文件**：`references/layouts/catalog.json`（skill 侧新增，与模板同目录）

```json
{
  "catalogVersion": "2026-10-22",
  "schemaVersion": 1,
  "scenes": [
    {
      "scene": "business-report",
      "title": "经营分析报告",
      "executable": true,
      "variants": [
        { "variant": "compact", "templateFile": "standards/business-report-compact.json" },
        { "variant": "standard", "templateFile": "standards/business-report-standard.json" },
        { "variant": "rich", "templateFile": "standards/business-report-rich.json" }
      ]
    },
    {
      "scene": "usage-report",
      "title": "资源用量报告",
      "executable": true,
      "variants": [
        { "variant": "standard", "templateFile": "standards/usage-report-standard.json" }
      ]
    },
    {
      "scene": "ioc-overview",
      "title": "IOC 总览（目标场景）",
      "executable": false,
      "executableReason": "columnTracks 无创作入口 / mapChart·tabContainer·compositeCard 自动装配未迁移 / SOURCE_REFS maxProperties:6",
      "variants": [
        { "variant": "standard", "templateFile": "standards/ioc-overview-standard.json" }
      ]
    }
  ]
}
```

**语义**：
- `executable: true` = 模板内所有 section/block/component 均在 COMPOSE_SCHEMA 闭集可执行（10 组件枚举），脚本编译可闭环；
- `executable: false` = 目标场景，仅设计层模板（可读、可评审），**不可编译**；`executableReason` 列出明确缺口；
- catalog 是**唯一可校验入口**：模板引用（scene/variant）先在此解析，未知组合直接报 `CATALOG_ENTRY_NOT_FOUND`；
- 单文件 variants 策略：每个 scene-variant 一个模板文件（无跨变体继承，缺省继承关系在模板文件内自包含）；变体继承规则（如有）在后续版本定义，第一批不引入。

---

## 4. 模板 schema（三段式，v1）

**文件**：`references/layouts/standards/<scene>-<variant>.json`

```json
{
  "schemaVersion": 1,
  "scene": "business-report",
  "variant": "standard",
  "templateVersion": "2026-10-22",
  "layout": { "form": "report", "columnTracks": [12] },
  "defaults": {
    "layout": "report",
    "container": "panel",
    "pattern": "overview-with-trend",
    "width": "full",
    "purpose": "trend"
  },
  "hardPins": {
    "productMandatory": [
      { "pinId": "page-header", "kind": "component", "mustBe": "reportHeader" }
    ],
    "userRequired": [],
    "authorSuggested": []
  },
  "adjustable": ["columnTracks", "sectionOrder", "container", "blockWidth", "componentChoice"],
  "sections": [
    {
      "id": "summary",
      "pattern": "overview-with-trend",
      "container": "panel",
      "blocks": [
        { "id": "kpi", "width": "third", "purpose": "primary-value" },
        { "id": "trend", "width": "full", "purpose": "trend" }
      ]
    },
    {
      "id": "map",
      "pattern": "custom",
      "container": "plain",
      "suggested": true,
      "blocks": [
        { "id": "map", "width": "full", "purpose": "distribution" }
      ]
    }
  ]
}
```

### 4.1 字段说明（对照生效契约）

| 字段 | 类型 | 语义 | 契约依据 |
|---|---|---|---|
| `scene`/`variant`/`templateVersion` | string | 模板标识，封套引用精确匹配；不匹配报 `TEMPLATE_VERSION_MISMATCH` | catalog 唯一入口 |
| `layout.form` | enum `report`/`dashboard` | 页面形态 | COMPOSE_SCHEMA `layout.enum` |
| `layout.columnTracks` | int[] | **仅目录/设计元数据**：创作入口当前不存在（§6-I1），脚本**不得**将其写入产物；可执行模板缺省 `[12]`（等权） | 页面契约 `sectionColumnTracks`（`contract-snapshot/page/schema.json:2635`）+ 校验规则 `page_validation_common.py:257`（span≤tracks） |
| `defaults` | object | 模板作者为**已存在节点**提供的缺省值，key 均须在 COMPOSE_SCHEMA 属性集内 | COMPOSE_SCHEMA |
| `hardPins` | 三类数组 | 见 §4.4 | 修订意见补充三 |
| `adjustable` | string[] | 模型可调面（闭集枚举内）；模板声明而非强约束 | handoff §4.1 |
| `sections[].id` | string | **稳定匹配标识**：模板节点 id 与产物节点 id 一对一；匹配**不能**按标题/位置猜测（修订意见补充二） | compose 块按 id 存在性生效 |
| `sections[].suggested` | bool | `true` = 模板作者场景建议，模型可删可增可重排；**不自动升级为必须** | handoff §4.1 |
| `blocks[].id` | string | 同上稳定标识 | — |
| `blocks[].width` | enum `full`/`half`/`third`/`two-thirds` | 闭集枚举 | v3 schema + COMPOSE_SCHEMA 均确认 |

### 4.2 模板 schema 自校验规则（layout_compiler 加载时执行）

- `scene`+`variant`+`templateVersion` 必须在 catalog 中精确存在；
- `layout.form` ∈ {report, dashboard}；`defaults.*` 键 ∈ COMPOSE_SCHEMA 对应属性集（section: id/title/pattern/container/blocks；block: width/purpose/…）；
- `hardPins.*[].pinId` 引用的 section/block id 必须在模板 sections 中声明（**自引用闭合**，防模板作者笔误）；
- `sections[].id` 全局唯一（含 blocks 内 id）；
- 可执行模板：所有 `component` 枚举 ∈ COMPOSE_SCHEMA 10 组件闭集；不可执行模板不受此限但必须 `executable:false` + `executableReason`。

### 4.3 输入语义（C1 完整计划为主，逐情况定义）

| 输入情况 | 处理（完整计划模式） |
|---|---|
| 缺整个 `sections` 字段 | 拒绝（`PLAN_SECTIONS_REQUIRED`）：compose 契约 sections 必填（minItems 1）；完整计划模式下入口**不允许省略** |
| `sections` 为空数组 | 拒绝（`PLAN_SECTIONS_EMPTY`）：无任何章节的页面无意义，由模型补或改需求 |
| 数组缺某模板章节 | **有意删除**：完整计划模式下节点缺失=本页没有它，脚本不补回（否则违反 C1 存在性语义） |
| 章节存在但缺 `blocks` | 输入不完整：报 `PLAN_SECTION_BLOCKS_REQUIRED`，**不**自动继承模板（缺省填充只补字段，不补节点） |
| 字段为 `null` | **拒绝/删除**：`null` 语义在 COMPOSE_SCHEMA 无定义；normalize 会删除 `null` 可选字段。脚本在填充前剥离显式 `null`（记 adjustment `OPTIONAL_NULL_OMITTED`），不继承模板值 |
| 章节存在、块存在、块缺 `width`/`purpose` | 补模板缺省（`defaults` 或模板块上字段）→ 记为 `LAYOUT_DEFAULT_FILLED` adjustment |
| 模型显式给出值 | **保留**（显式优先）：`normalize_compose` 不再覆盖（模板缺省填充先于 normalize 完成） |
| 节点匹配 | 按 `id` 精确匹配；无 `id` 的输入块在填充前报 `PLAN_BLOCK_ID_REQUIRED`（不允许按标题/位置匹配） |

**顺序**（修订意见补充五）：
`输入形态整理（剥 null/校验 id）→ 模板缺省填充（只补已存在节点的字段）→ hardPin 校验 → 输出 → normalize_compose（通用默认填充，不再触碰已填充值）`

### 4.4 hardPin 三来源管理（C3 冻结）

| 来源 | 存储位置 | 校验强度 | 处理 |
|---|---|---|---|
| **productMandatory**（产品不可违反约束） | 模板 `hardPins.productMandatory` | 脚本**强制**：装配后复查（能力保留/数据绑定/容器关系，§4.5） | 失败 → gap 报告 `PRODUCT_MANDATORY_VIOLATED`，不保存 |
| **userRequired**（本次用户明确要求） | 模板 `hardPins.userRequired`（或封套 `userRequirements[]` 覆写） | 模型**声明满足**，脚本校验 | 未满足 → gap 报告 `USER_REQUIREMENT_GAP`（列 gap 明细） |
| **authorSuggested**（模板作者场景建议） | 模板 `hardPins.authorSuggested` + sections `suggested:true` | **不约束**，仅阅读提示 | 不校验，不报缺口 |

**冲突处理**：任何 must 校验失败**不静默覆盖**（不自动降级为 table、不补占位、不改模板、不写库）——返回 gap 报告，由模型回填或用户决策后重新编译。

### 4.5 装配后复查（修订意见补充四）

现状（源码核验）：`compose()` 对失败块替换为 `structure-missing-{id}` 占位（`referenced.py:99`）、`normalize_compose` 对非法组件降级为 `table`（`input_tolerance.py:29-33`）——**输入计划只检查 ID 存在，无法证明最终保留能力**。

`layout_compiler` 装配后复查（对 compose 返回的 document 做，而非仅输入计划）：
1. **能力保留**：`productMandatory` 中 `mustBe=mapChart` 等 → 复查产物 section/block 的最终 component type == mustBe（排除 `structure-missing-*` 占位与 `table` 降级）；
2. **数据绑定**：block `source` 引用的 dataSource 必须仍挂在该 section 的 components 上（未被剪裁/替换移除）；
3. **容器关系**：`container: plain` 与 backdrop/占位规则冲突时报缺（复用 `page_validation_common.py` 语义，不绕过页面校验）；
4. 复查在 compose 返回 document 上执行；compose 自身的 `validate_page_document` 已保证页面契约合法，复查只补"必须内容"层。

**必须内容降级 ≠ 满足**：发现降级即报 gap（`MANDATORY_COMPONENT_DEGRADED`），不把占位文本当成功。

### 4.6 数据槽位与绑定（修订意见补充六）

- 模板**只声明数据角色**（如 `dataRole: "primaryValue"`），**不**固定业务 source ID/字段名/查询结果；
- 模型/上游负责把角色绑定到已有数据引用（`sources` 的 resultRef + block 的 `fields`）；缺字段时脚本报 `DATA_ROLE_BINDING_GAP`（列出缺失角色）——**不**用模板里的示例字段冒充；
- 布局编译所需引用/字段/受控能力均走程序通道（同现有 compose 的受控输入）。

### 4.7 模板版本固定 + 单次保存（修订意见补充七）

- 编译时记录 `(templateVersion, catalogVersion, compilerVersion, pageSchemaVersion, platformProtocolVersion)` 摘要（存 adjustment/日志，不写进页面正文）；
- **重试不切换模板**：同一轮内同 `templateRef` 只解析一次，固定版本；失败重试沿用已解析模板；
- 复用编辑构造能力时**优先内部组装候选页面统一校验后单次保存**（即走一次 compose，不实现为多次外部编辑调用）。

---

## 5. layout_compiler.py 接口定义（skill 侧，纯函数）

**文件**：`scripts/layout_compiler.py`（skill 侧新增，不修改生产代码）

### 5.1 输入封套

```python
# 模型产出 → layout_compiler.compile()
COMPILER_INPUT = {
    "templateRef": {"scene": "business-report", "variant": "standard",
                    "templateVersion": "2026-10-22"},   # 必须 catalog 精确存在
    "userRequirements": [{"id": "map", "mustBe": "mapChart"}],  # 可选，C3 userRequired
    "plan": {
        "layout": "report",
        "sources": {"s1": "<resultRef>", ...},
        "sections": [ ...完整闭集结构计划... ],
    },
}
```

### 5.2 公开函数与契约

```python
def load_catalog(catalog_path) -> dict
    # 加载+自校验 catalog.json；结构非法抛 CompilerError(CATALOG_INVALID)

def resolve_template(catalog, template_ref) -> dict
    # 按 scene/variant/templateVersion 精确解析；未知 → CompilerError(CATALOG_ENTRY_NOT_FOUND)
    # 解析成功 → 返回模板对象（含 executable 标记与 executableReason）

def compile(compiler_input) -> CompileResult
    # 0) 闭集知识加载：从【契约快照】（引擎方注入，D1/D2）读取组件枚举/width/purpose/pattern/assembled 门控
    #    快照缺失或版本不匹配 → CompilerError(CLOSED_SET_SNAPSHOT_UNAVAILABLE)
    # 1) 输入形态整理：剥显式 null、校验 id/必填
    # 2) 模板缺省填充（仅已存在节点，显式值优先）→ adjustments
    # 3) hardPin 校验（productMandatory 强制 / userRequired 声明满足）
    # 4) 弱一致性校验（D3）：plan 与模板 pattern/component 重叠度 < 阈值
    #    → gaps += SCENE_MISMATCH_GAP（提示不阻断）
    # 5) 输出 CompileResult：
    #    {status: "ok"|"gap"|"invalid",
    #     plan: {…COMPOSE_SCHEMA 合法结构计划…} | None,
    #     adjustments: [...], gaps: [...], templateFingerprint: {...}}

def verify_after_assembly(document, mandatory) -> list[Gap]
    # 装配后复查（§4.5）：对 compose 返回 document 检查能力保留/数据绑定/容器关系
    # 输入：compose 的 document + 模板 productMandatory + userRequirements（D4 封套声明）
    # 输出：gap 列表（MANDATORY_COMPONENT_DEGRADED / DATA_ROLE_BINDING_GAP / ...）
```

**Gap 结构**：
```json
{ "pinId": "map", "requirement": "mustBe mapChart", "reason": "ASSEMBLED_FALLBACK_TABLE",
  "actual": "table", "expected": "mapChart", "path": "/sections/1/components/0" }
```

### 5.3 输出链（红线 1 保持）

```text
compile() 输出 plan（纯结构计划，COMPOSE_SCHEMA 合法）
    → compose_page(context_ref, plan, expected_version)   # 现有 MCP 工具
    → compose 内部 normalize → compose → validate → 单稿 CAS
    → 返回 document → verify_after_assembly(document, mandatory)  # skill 侧复查
    → 有 gap → 报缺口，不保存/不改写；无 gap → page_metadata_emit_preview
```

**不新增绕过校验的独立入口**：compiler 本身不调用任何保存/发布工具，只做纯计算；写库唯一入口仍是 compose_page。

### 5.4 引擎方注入的资源契约（D2 落地形态）

```text
引擎方（部署时注入，独立于 bundle wheel 演进）
  ├─ references/layouts/catalog.json          # 标准索引（唯一可校验入口）
  ├─ references/layouts/standards/*.json      # 场景模板（executable / planned 区分）
  ├─ scripts/layout_compiler.py               # 编译器（纯函数）
  ├─ closed-sets/snapshot.json                # 契约快照：组件枚举/width/purpose/pattern/assembled 门控
  └─ layouts.version.json                     # 资源版本指纹（与 bundle 契约版本对齐校验）
```

- **独立维护**：标准/模板/编译器归引擎方独立版本与发布节奏，不随 bundle wheel 打包（`hatch_build.py` 仅 force_include bundle/contracts，不覆盖 skill 子资源——与现状一致，零改动）；
- **版本对齐**：`layouts.version.json` 记录 `authoringContractVersion` / `pageSchemaVersion` / `platformProtocolVersion` 对应关系，与 `contract-lock.json` 不符时报 `LAYOUTS_VERSION_MISMATCH`（防止旧标准配新契约编译出错误缺省）；
- **通道**：沿用 bundle.json 已声明的 `referenceMode: "injected-or-file-read"`（skill 资源由引擎方注入或允许文件读取），模型侧不新增 MCP 资源端点（MCP 资源端点方案推后，需改生产代码）；

---

## 6. IOC 目标场景缺口清单（C4：第一批**不实现**，仅设计层）

| # | 缺口 | 证据 | 改动层级 | 影响 |
|---|---|---|---|---|
| I1 | **columnTracks 创作入口缺失** | 页面契约 section 级 `allOf: sectionColumnTracks`（`contract-snapshot/page/schema.json:2553,2635`）；结构计划属性集**无** columnTracks（v3 schema props: id/title/pattern/container/blocks/businessQuestion/businessObject/distinctFrom）；compose/`pages/` 无写入点 | **创作入口**（已有页面字段新增创作入口，非协议能力扩展） | 模板 `layout.columnTracks` 无法落产物；校验规则 `page_validation_common.py:257` 已支持 span≤tracks，只缺装配写入 |
| I2 | **mapChart / tabContainer / compositeCard 自动装配不可用** | `capabilities.py:42,44,45`（assembled=False）；`text_map_building.py:71-95`（add_map_chart 拒绝 plain/card、拒绝 compute）；`container_building.py:35-55`（Tab 子组件仅限 table） | **装配能力**（compose 路径自动装配扩展；edit 构造逻辑存在） | 模板含地图/组合卡/Tab 时 compose 拒绝或降级；第一批模板**不得**混入这些目标形状（可执行模板只在 10 组件闭集内） |
| I3 | **SOURCE_REFS maxProperties:6** | `pages/referenced.py:14`（IOC 7 源场景被拒） | **容量变更**（契约变更，涉及 bundle 版本/契约快照联动） | 目标页阻塞，不阻塞布局模块本身；不得分批绕过 |
| I4 | （目标页衍生，未列入第一批）分页/排序表格、超集计算 | C07/C02 主计划依赖 | 协议/原语扩展 | 无表达点，进后续批次 |

**第一批明确排除**：上述缺口全部推后；第一批只交付 `business-report` / `usage-report` 可执行变体闭环。catalog 中 IOC 保持 `executable:false` + `executableReason` 显式区分。

---

## 7. skill 接线（改动点，全部在 skill 侧文档/脚本，不碰生产代码）

### 7.1 SKILL.md / create.md 新增步骤

在 create.md 第 3 步（组织 title/layout/sections）与第 4 步（compose_page）之间插入：

```text
3.5 布局标准（可选，layout-standard 模式）：
    a. 读 catalog.json（references/layouts/catalog.json）选 scene + variant；只选 executable:true 的模板；
    b. 读对应模板（references/layouts/standards/<scene>-<variant>.json），理解默认值/hardPins/adjustable；
    c. 输出完整闭集结构计划，调用 scripts/layout_compiler.py compile(封套)；
    d. 脚本输出 plan + adjustments + templateFingerprint；把 plan 传给 compose_page；
    e. 未选模板时跳过本步，直接 compose_page（现有路径不变）。
```

### 7.2 workflows/layout-authoring.md（新增）

持续更新标准/脚本流程 + 回归验收（handoff 第 7 节第四步映射）：
- 模板/编译器变更须同步更新 `templateVersion`/`catalogVersion`，并跑编译回归样例（`references/layouts/samples/` 下，第一批至少含 business-report standard 一例）；
- 验收：相同输入+模板版本+能力条件产生一致结果（确定性）；重排/裁剪不被意外补回；必须内容不降级冒充；单次保存 CAS；实际预览验真；
- 死声明处置：`bundle.json` 的 `skill/metriccanvas-page-builder` 条目为死声明（`local_mcp_servers/.../skill/` 不存在）——**本次分发验收处理**（移除或修正），不拖到以后。

### 7.3 第一批交付物清单

```
references/layouts/catalog.json                     # 新增：唯一可校验入口
references/layouts/standards/business-report-*.json # 新增：可执行模板（compact/standard/rich）
references/layouts/standards/usage-report-standard.json  # 新增：可执行模板
references/layouts/standards/ioc-overview-standard.json  # 新增：设计层模板（executable:false）
scripts/layout_compiler.py                          # 新增：纯函数编译器（含装配后复查）
closed-sets/snapshot.json                           # 新增：契约快照（D1/D2，引擎方注入）
layouts.version.json                                # 新增：资源版本指纹（D2，引擎方注入）
workflows/layout-authoring.md                       # 新增：持续更新+回归验收
SKILL.md / workflows/create.md                      # 修改：3.5 接线步骤
bundle.json（分发验收）                              # 修改：移除/修正死声明
```

---

## 8. 事实核验记录（2026-10-22 对照当前工作区，设计依据）

| # | 事实 | 证据 | 设计影响 |
|---|---|---|---|
| F1 | `domain/` 不存在，`pages/` 唯一活动链路 | `tool/metriccanvas_authoring/pages/` 存在，无 domain/ | 编译/装配全在 pages/ |
| F2 | `validate_plan()` 零活动调用（v3 schema 旁路） | `page_structure.py:44`；grep 无调用 | 模板字段约束对照 **COMPOSE_SCHEMA**，非 v3 schema |
| F3 | 但 v3 `purpose` 枚举经 `structure_presentation.purpose_intent()` 被 `block_component` 间接消费 | `structure_presentation.py:7,27` + `page_structure.py:122` | 模板 purpose 枚举保留 v3 集合（7 值），不能假设 v3 整体无关联 |
| F4 | `skill/metriccanvas-page-builder` 是死声明 | `bundle.json` | 本次分发验收处理 |
| F5 | columnTracks 页面契约在 section 级 allOf | `contract-snapshot/page/schema.json:2553,2635` | 创作入口缺口（I1），非协议能力 |
| F6 | computeOperator 闭集 5 个含 ratio | `contract-snapshot/page/schema.json` | 第一批模板不涉超集计算 |
| F7 | `sources≤6`（`SOURCE_REFS maxProperties:6`） | `pages/referenced.py:14` | IOC 7 源受阻（I3），不阻塞布局模块 |
| F8 | mapChart/tabContainer/compositeCard assembled=False | `capabilities.py:42,44,45`；`text_map_building.py:71-95`；`container_building.py:35-55` | 装配能力缺口（I2）；第一批可执行模板排除目标形状 |
| F9 | 容错三层（normalize_compose 补默认/降级/删 null + compose_envelope 放宽局部锁全局） | `input_tolerance.py` | 缺省填充顺序：模板填充早于 normalize（§4.3） |
| F10 | 无 test-harness、无测试骨架 | 仓库无 tests/test_platform_*.py | 编译回归样例在 skill 侧新建（layout-authoring.md） |

---

## 1B. MC 依赖解耦 + skill 基础能力评测（第四轮 grill，2026-10-24）

### 1B.1 需求背景

当前 skill（15 文件，451 行）对 MetricCanvas 存在**多重依赖**：元数据协议、组件拼接脚本、布局 standards、以及未列全的运行时契约（64 个错误码/保存交接语义/版本字面量/字符约束/部署状态）。需求：在 skill 内把所有 MC 依赖**高内聚维护**，与 skill 核心逻辑解耦，后续由 MC 整体提供完整内容，skill 与 MC **分别相对独立演进**。

### 1B.2 依赖面完整清单（15 文件通读盘点）

| # | 依赖面 | 位置 | 内容 |
|---|---|---|---|
| D1 | **元数据协议** | data-analysis.md、scenarios/business-report.md、usage-report.md | discover/query 协议（dataContextVersion/businessDomain/queryBinding/granularities/metricCompatibility/validationMode/discoveryProtocolVersion/readyRequirementIds/interactionEnvelope）；业务域场景 |
| D2 | **组件拼接/工具契约** | tools.md、errors.md、edit.md、create.md、parameters.md | 10 工具签名与行为（read_page_context×18/compose_page×17/publish_page×16/edit_page×12/…）；**64 个错误码枚举**；受控 operations 语法；组件能力边界（metricCard 需 match/pieChart 需完整行集）；参数流程（extraction_ref/candidate_id/instance_ref） |
| D3 | **布局 standards** | layouts/report.md、dashboard.md、scenarios.md、reading-design.md（部分） | report 定宽 75rem/12 轨道/760px 断点/columnTracks/connectPrevious/backdrop；场景布局经验；组件默认 span/容器语义；+ 新增 catalog/standards/scripts/snapshot（D2 已冻结） |
| D4 | **运行时契约** | execution.md、SKILL.md、tools.md | saveStatus 语义（saved/unknown/pending/rejected）+ SAVE_RECONCILIATION_REQUIRED 锁死；预览交接（artifactRef/ready/两标记）；**版本字面量**（Schema 6.11/platformProtocolVersion=2.0）；**字符约束**（utf8mb4 禁 emoji）；部署装配状态（CURRENT_TURN_UNAVAILABLE 等） |

### 1B.3 独立维护理由与衔接风险（Q1 交付）

| 依赖面 | 由 MC 独立维护的理由 | 与 skill 衔接的风险 |
|---|---|---|
| D1 元数据协议 | 协议字段由 MC 后端定义，MC 演进（新协议版本/发现模式）时描述必须同步；skill 侧无从得知字段语义变化；业务域是 MC 数据治理事实 | 字段/版本漂移 → 模型按旧协议取数失败；业务域新增 → skill 写死的"经营/用量两类"让新场景不可达；discoveryProtocolVersion 语义变化 → skill"集中核对一次"流程失效 |
| D2 组件拼接/工具契约 | 10 工具签名由 MC 平台服务端定义（platform_mcp.py + COMPOSE_SCHEMA + EDIT_RESULT_SCHEMA 是权威真源）；**64 错误码完全由 MC 程序抛出**，错误码→修复策略映射随程序演进；operations 语法由 MC 编辑契约定义；组件能力边界是 MC 装配逻辑事实 | **最危险耦合点**：工具签名变更 → 模型按旧签名失败；**错误码新增/重命名 → skill 映射过期，模型遇新码不知所措（运行时决定性）**；COMPOSE_SCHEMA 收紧 → 选型建议与实际门禁不一致；字符约束写死 → Java 库变更后过期 |
| D3 布局 standards | 布局参数（75rem/12 轨道/760px/columnTracks/backdrop）由 MC 运行时决定；场景布局经验是 MC 产品设计事实；默认 span/容器语义由 MC 装配逻辑决定（section-patterns.json 权威真源） | 布局参数变更 → 模型按旧布局生成，预览才暴露；**布局经验过期比结构错误更隐蔽（不报错，只是不好看）** |
| D4 运行时契约 | saveStatus 语义与锁死逻辑是 MC 保存服务事实；预览交接标记协议是 MC Adapter 事实；版本字面量由 MC bundle 决定 | 保存语义变更 → skill"保存成功判定"过期，模型误判；交接标记协议变更 → 交付强制顺序失效（前端不识别）；版本字面量过期 → skill 声明与实际 bundle 不符 |

**风险共同点**：所有 MC 依赖过期都是**运行时错误或视觉偏差**（不是编译期发现），且**错误码/工具签名/布局经验三类最隐蔽**——结构校验通过但行为错误。

### 1B.4 已冻结决策（第四轮 grill 结果）

| # | 决策 | 冻结结论 | 直接影响 |
|---|---|---|---|
| E-边界 | 解耦范围 | **全集进 MC 内容包**（D1-D4 四类依赖全部），skill 核心只保留通用创作方法论（阅读层级/通用表达）+ skill 自身工作流骨架 | skill 与 MC 演进彻底解耦；MC 内容包承载全部版本演进 |
| E-形态 | 内容包形态 | **布局信息由 MC 整体提供**，并入统一内容包；skill 侧只保留"结构 + 必备信息要求"（模板 schema 骨架 + hardPins 语义要求），不复述 MC 事实 | mc-content 统一包承载 D1-D4；skill 核心只剩结构与要求 |
| E-消费 | 消费方式 | **静态注入 + 文件读**（沿用 injected-or-file-read 通道），零生产代码改动；MCP 资源端点推后 | 模型 file-read 读协议/契约/错误/布局；layout_compiler 读闭集快照编译 |
| E-演进 | 演进责任 | **MC 导出 + skill 引用校验**：MC 侧负责内容包版本演进与导出；skill 侧保留引用校验层（引用版本指纹，不一致报错提醒更新） | MC 变更 → MC 更新 mc-content；skill 核心仅当方法论受影响时才改；skill 侧多一层校验维护 |
| E-评测 | 评测机制 | **skill 定义能力 + MC 提供夹具**（E1）；**本地预筛 + 真实回执**（E2）；**全通过 + 显式豁免**（E3）；**版本文件记录 + 读前校验**（E4）；**不依赖大模型，第一版脚本级可运行**（用户补充） | 详见 §1B.5 |

### 1B.5 skill 基础能力评测机制（Q4 详细设计）

**目标**：MC 内容包每次升级后，运行"skill 基础能力评测"，通过后才允许模型用新包执行；不通过 → 阻塞纳入，沿用旧包或降级。**不依赖大模型，第一版为脚本级确定性评测。**

**评测能力矩阵（skill 侧定义真源）**：

```text
eval/baseline-matrix.json（skill 核心，能力定义真源）
├─ close-loop    端到端闭环：读 catalog→选场景→编译→compose→保存→预览（模拟回执）
├─ error-mapping 64 错误码 → 修复策略映射覆盖（新码必须出现在 mc 错误表）
├─ tool-alignment 10 工具签名与 MC 实际 list_tools 对齐
├─ layout-alignment 模板缺省值与组件默认 span 对齐（snapshot vs section-patterns）
├─ version-alignment mc-content.version.json vs contract-lock（版本一致）
├─ char-constraint utf8mb4 字符约束适用
└─ delivery-order  交付强制顺序（标记协议 {{RESPONSE_START}}/{{PAGE_METADATA_PREVIEW_JSON}}）
```

**两段式运行**：

```text
阶段 1 本地预筛（skill 侧脚本 run_baseline.py，CI 可跑，确定性）
  ├─ 静态校验：版本对齐 / 错误码全集覆盖 / 工具签名对齐 / 布局缺省对齐
  ├─ 模拟回执闭环：mock 工具回执驱动编译→校验→保存→预览流程
  └─ 输出 evalReport.json {status, failed[], exempted[], coverage[]}
阶段 2 真实验收（部署环境，回执为准）
  ├─ 执行 execution.md 部署验收 7 项实跑（新建/标题修改/新增数据块/partial/
  │  外部修订变化/保存结果未知/预览失败后恢复）
  └─ 本地替身通过不能替代真实回执（execution.md 既有原则）
```

**通过标准与失败处理**：

```text
evalStatus ∈ {passed, exempted, failed}
- passed:  阶段 1+2 全部通过
- exempted: 带显式豁免清单（原因+失效风险，MC 侧确认），不影响默认强要求
- failed:  阻塞纳入（模型沿用旧包，升级挂起）；不得部分失败静默纳入
```

**结果消费（程序强制）**：

```json
// mc-content.version.json（MC 侧在评测通过后写入）
{
  "contentVersion": "2026-10-24",
  "evalStatus": "passed",
  "evalRunId": "eval-20261024-001",
  "evalAt": "2026-10-24T10:00:00Z",
  "coverage": ["close-loop", "error-mapping", "tool-alignment", "layout-alignment",
               "version-alignment", "char-constraint", "delivery-order"],
  "alignedWith": {"authoringContractVersion": "0.3.1", "pageSchemaVersion": "6.11",
                  "platformProtocolVersion": "2.0"}
}
```

- 编译器/模型读包前校验 `evalStatus`：`passed`/`exempted` 才允许用新包；`failed` 拒绝编译或回退旧包（读前校验，程序强制，不依赖模型自律）；
- **评测不依赖大模型**：阶段 1 是确定性脚本；阶段 2 是真实部署回执（可由集成方脚本驱动）；第一版交付脚本级可运行。

**责任分配（E1）**：

```text
skill 侧（核心真源）：eval/baseline-matrix.json  # 能力清单 + 通过标准
MC 侧（内容包）：      eval/fixtures/ 用例数据 + 模拟回执 + run_eval.py 运行骨架
                      mc-content.version.json      # 评测通过后写入 evalStatus
```

**衔接风险与评测的对应**：错误码/工具签名/布局经验三类隐蔽风险 → 评测的 error-mapping / tool-alignment / layout-alignment 三用例专项覆盖；版本字面量 → version-alignment；保存/交接 → close-loop + delivery-order + 阶段 2 真实验收。

### 1B.6 mc-content 内容包结构（统一形态）

```text
mc-content/  （引擎方/MC 侧提供，随 MC 版本演进，不随 bundle wheel 打包）
├─ mc-content.version.json    # 版本指纹 + evalStatus + alignedWith（R2 扩展）
├─ mc-closed-sets/snapshot.json  # 闭集快照（组件/width/purpose/pattern/assembled，R1 自动导出）
├─ protocols/                 # D1 元数据协议（discover/query 协议 + 业务域场景）
├─ tool-contracts/            # D2 组件拼接/工具契约（工具签名 + 错误码表 + operations 语法 + 组件能力边界）
├─ runtime/                   # D4 运行时契约（saveStatus/交接标记/版本/字符约束/部署状态）
├─ layouts/                   # D3 布局 standards（catalog/standards/scripts/snapshot，D2 已冻结并入）
└─ eval/fixtures/             # 评测夹具（用例数据 + 模拟回执 + run_eval.py 骨架，E1）
```

skill 核心（独立维护）：

```text
skill 核心：
├─ SKILL.md                   # 工作流骨架/强制顺序/标记协议（不含 MC 版本/契约事实）
├─ eval/baseline-matrix.json  # 能力矩阵（skill 定义真源，E1）
├─ references/reading-design.md  # 通用阅读层级（方法论，非 MC 事实）
└─ workflows/ 骨架             # 步骤流（引用 mc-content 协议，不内嵌 MC 契约）
```

---

## 13. mc-content 原子化查询（E-消费 落地，第五轮 grill，2026-10-24）

### 13.1 背景与问题定位

E-消费冻结为"静态注入 + 文件读"，但**文件读取的上下文过载/性能问题**真实存在：

- 根因 1：**模型要读"整个文件"才能用"其中一段"**——错误码 64 条、工具契约 10 个签名、协议全量，模型为查一个错误码要把整表读进上下文；
- 根因 2：**双层读取放大**——模型先读索引再读内容，索引+内容都占上下文；
- 根因 3：**无边界**——整文件读无返回上限，大文件（布局模板 sections 数组/协议文档）一次读进上下文。

**原子化 CLI 的本质**：把"全量文件读取"变成"按需查询接口"（查单错误码/单工具契约返回片段），控制上下文。

### 13.2 平台机制查证（源码事实，2026-10-24 核实）

| 机制 | 证据 | 结论 |
|---|---|---|
| skill 原生 scripts/tools.py | `skill_loader.py:781-841`（`_load_skill_tools`：加载 `scripts/tools.py` 中 `tool_` 前缀/`__relay_tool__` 标记函数，注册为 Agent 可调用工具）；`skill.py:44` | **零生产改动、零审批、参数受控**的受控工具注册通道——mc_query 的首选载体 |
| skill_play 渐进式披露 | `skill_play.py:147-211`（`_build_resource_index`：只给文件列表不含内容，模型按索引按需读取） | 平台设计意图本就是"按需读取"，但缺原子化查询能力（只能整文件读）——过载根源确认 |
| execute_command | `command_service.py:341`；`agent_builder.py:686`（GLOBAL、requires_approval=True） | 模型执行任意 .py 需审批 + 命令不受控（A2 信任面扩大），不作首选 |
| skill 级 command/CLI 注册 | SKILL.md frontmatter 只支持 name/description/allowed-tools/metadata（`skill_loader.py:651-673`）；skill 模型无 commands 字段；插件 `on_command_before` 是 hook 非命令注册 | **当前不存在**"skill 内注册声明式 CLI 供模型编程调用"机制；需改生产代码，推后 |

### 13.3 已冻结决策（第五轮 grill 结果）

| # | 决策 | 冻结结论 | 直接影响 |
|---|---|---|---|
| F1 | 原子化查询形态 | **skill 原生 tools.py 注册工具函数**（`tool_mc_query`），零生产改动、零审批、参数受控；execute_command 执行独立脚本（需审批+命令不受控）弃用；MCP 工具（需改生产代码）推后 | 复用 skill_loader 现有 tools.py 通道，模型经工具调用，返回有界 |
| F2 | 查询粒度 | **索引 + 原子双层**：mc-content 按原子单元拆（每工具/每错误码/每模板），索引先定位路径再查原子；布局模板单文件 scene-variant | 定位精确，模型不猜路径；文件多但每个小 |
| F3 | 文件读关系 | **短期并存，优先 CLI**：CLI 优先；CLI 不具备的能力（通读布局模板 sections 数组/协议整体语义）直接文件读 | 两类消费模式并存，skill 文档定义何时用哪通道 |
| F4 | 预算与缓存 | **返回上限 + 同轮缓存**（同轮同查询去重返回 cached 标记）；上限**不作为文档严格要求**，根据最终文档划分与 skill 运行结果动态调整（用户明确） | 上下文可控；上限可配置非写死 |

### 13.4 mc_query 工具函数接口（结构化参数，F1 冻结）

```python
# skill/scripts/tools.py（skill_loader 自动注册）
def tool_mc_query(topic: str, key: str, options: dict | None = None) -> dict:
    """Args:
    topic: 查询主题（受控枚举）
      - index         查询索引（F2 定位层，返回路径列表）
      - error         错误码（key=错误码，返回处理片段）
      - tool          工具契约（key=工具名，返回签名片段）
      - layout        布局模板（key=scene-variant，返回模板片段或完整模板）
      - protocol      元数据协议（key=协议段）
      - version       版本指纹（key 忽略，返回 mc-content.version.json）
    key: 原子 id（受控，按 topic 枚举/格式校验）
    options: 有限选项（如 includeExample/includeSections/mode: fragment|full）
    返回: {content, truncated, cached, topic, key}
    """
    ...
```

- **参数受 schema 校验**（topic/key 枚举、options 结构固定），模型可自主选择查询主题与参数值（"自主查询"），**不能**拼接任意表达式/代码（"可编程 CLI"当前 Relay 无此机制，见 §13.2 查证，推后）；
- 返回有界（上限可配置，非严格要求，F4）；同轮缓存返回 `cached: true`；
- 只读 mc-content（A2 只读守卫）；不触发保存/发布；无状态（纯查询）。

### 13.5 衔接（与既有冻结整合）

- **评测**：close-loop 用例覆盖 mc_query 路径（查错误码→修复策略映射→编译）；tool-alignment 用例校验 mc_query 返回的工具签名与 MC 实际 list_tools 对齐；
- **A2 只读守卫**：tools.py 工具函数只读 mc-content 静态资源，参数受控，天然符合（优于 execute_command 的命令不受控）；
- **第一版脚本级可运行**：mc_query 是确定性脚本函数（不依赖大模型），与 layout_compiler 同形态；评测阶段 1 本地预筛可覆盖其返回正确性；
- **降级**：若 skill_loader tools.py 通道在部署态不可用，退化为文件读（F3 并存已保证）；MCP 工具/可编程 CLI 需改生产代码，后续批次。

---

## 9. 遗留与后续批次（不阻塞第一批）
- IOC 目标场景三缺口（§6 I1-I3）实现排期：各标注改动层级（创作入口/装配能力/容量变更），需改 pages/ 生产代码并联动 bundle 版本与契约快照——**不在本轮范围**；
- 变体继承规则（模板单文件自包含的替代方案）留待后续；
- 布局质量视觉验收始终在预览时验真（脚本不解决）。

## 12. MC 依赖解耦落地建议（设计冻结补充，§1B 的接线）

### 12.1 第一批（与布局模块同批）可做的解耦动作

- **新增 `mc-content/` 骨架**（skill 侧占位，内容由 MC 侧填充）：`mc-content.version.json` + `mc-closed-sets/` + `protocols/` + `tool-contracts/` + `runtime/` + `layouts/` + `eval/fixtures/`；
- **新增 `eval/` 骨架**（skill 侧，能力真源）：`baseline-matrix.json` + `run_baseline.py`（阶段 1 本地预筛脚本，确定性、不依赖大模型）；
- **skill 核心瘦身**：从 SKILL.md/tools.md/errors.md 抽出 MC 事实（版本字面量/错误码表/工具签名）移入 mc-content 对应子目录，skill 核心只保留结构 + 必备信息要求；
- **MC 侧需求**：见 §1A.6 R1-R5 + §1B.6（mc-content 统一包 + eval fixtures + version 指纹 + evalStatus 写入）。

### 12.2 验收（第四步分发验收扩展）

| 验收对象 | 至少应证明 |
|---|---|
| mc-content 包 | 版本指纹与 contract-lock 对齐（version-alignment 通过） |
| 评测脚本 | 阶段 1 可跑（CI 可重复）、不依赖大模型、输出 evalReport |
| 读前校验 | evalStatus=failed 时编译器拒绝/回退旧包（程序强制） |
| skill 核心瘦身 | 不再内嵌 MC 版本/错误码/工具签名事实（引用校验层保留） |

### 12.3 外部依赖（待 MC 侧/引擎方确认，不阻塞第一批设计）

- mc-content 统一包由 MC 侧提供（含 eval fixtures 与 version 指纹）；
- 评测夹具（用例数据/模拟回执/run_eval.py 骨架）由 MC 侧提供；
- skill 核心的能力矩阵（baseline-matrix.json）由 skill 侧维护，MC 侧不改写。

## 10. 降级路径与外部依赖（D1/D2 的条件式）

| 条件不成立 | 降级路径 | 影响 |
|---|---|---|
| 引擎方不注入契约快照（D1 闭集知识不可读） | 编译器回退为"只做存在性校验 + 模板自引用闭合"，缺省填充字段枚举以模板文件自带声明为准；模型侧闭集判断依赖现有 skill 文档（tools.md 组件能力边界） | 确定性下降（模板自声明枚举无程序对账），但不破坏闭环 |
| 引擎方不注入完整 skill 资源（D2 不可达） | 布局标准退回开发态可读、部署态降级为纯文档参考（模型照规则自行填充），`executable` 标记仍区分 | 混合模式在部署态失效，需引擎方补注入 |
| 模型无脚本执行能力 | 编译器规则文档化（`references/layouts/rules.md`），脚本仅回归验收用 | 确定性依赖模型自律（D1 备选方案三的代价） |

**第一批交付前置条件（验收前确认）**：引擎方 skill 注入通道可提供 §5.4 资源契约，或明确降级路径生效；两者至少其一，否则"读标准再发挥"在部署态无载体。