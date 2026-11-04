# Relay 四项交付与平滑升级 Spec

日期：2026-11-03。状态：Interface 1.0.0、发行 0.1.0 的 MC 实现已在隔离工作树集成验收；默认页面 Schema 6.82。真实 Relay 采用/在线流程另验，当前未提交主线。本文中的“必须”均有验收编号，实际结果见执行台账。

上位计划：[四项交付实施规划](four-artifact-delivery-plan.md)。推进台账：[实施任务与状态](relay-reference-execution.md)。本文定义对外契约，计划定义顺序，证据记录实际完成；三者不互相替代。

## 1. 目标、归属和范围

Relay 初次准备 Python、Node 及约定第三方依赖后，普通升级仅同步 `mc-content/`、`mc-content.md`、`mc-tools/`、`mc-tools.md` 四项，不构建、不安装本仓 wheel、不读取其他源码目录、不在线安装依赖。MC 内部结构变化由导出层吸收，Relay 包装不依赖私有模块路径。

MC 维护无网络的页面/查询派生/结果处理/作用域与回执规则、产品资源及可重复发行；Relay 维护真实 MCP 装配、可信身份与轮次、数据发现和 DQE、实际状态/CAS、Java 保存/恢复及前端交接。Skill 选择任务、解释状态；完整修改保存过程由 Relay 程序协调。产品规则不得通过回调/Port 间接联网；哈希或布尔授权标记不证明权限。

本次职责裁决见 [ADR-0129](../../adr/0129-four-artifact-product-tools-and-relay-execution.md)。创作期中间态不进入 PageDocument；渲染期数据网关及引擎归属不变。页面先行与数据先行共用产品规则和当前工作副本。

## 2. 稳定布局与消费面（S01）

```text
references/
├── mc-content/
│   └── index.json
├── mc-content.md
├── mc-tools/
│   ├── cli.py
│   ├── interface.json
│   ├── release.json
│   └── [私有实现与预构建 Node 程序]
└── mc-tools.md
```

这四项是一次发行的完整文件集合；部署目录可另有 Relay 自有文件，但候选暂存根必须只有这四项。`release.json` 校验范围只包含这四项，升级程序不得覆盖其他 references。无第五个必需同步文件。

产品CLI按安装范围校验四项，忽略四项之外的宿主文件，并对四项内部完整文件集合、原始字节和非法路径继续严格检查；构建侧seal/verify/compare默认使用严格候选范围。Interface2正式路径使用复数mc-tools，旧Interface1的单数发行由构建侧检查器只读识别，公开路径变化返回needs_migration。请求/结果格式及19项操作不因目录更名改变。

固定入口、请求/结果信封、操作标识、错误语义、公开资源 ID 和 `publicPaths` 是兼容面。内部 Python/Node 文件可迁移，Relay 不直接导入/执行它们。资源索引负责寻址，公共文档链接路径若改动必须保留兼容别名。主版内不得删除已有公开操作/资源。

## 3. Interface 与调用（S02）

`mc-tools/interface.json` 固定为对象，字段不隐式扩展：

| 字段 | 类型与含义 |
|---|---|
| `format` | 常量 `metriccanvas-mc-tool-interface/1` |
| `version` | 工具 Interface 的三段非负整数版本，禁止前导零和 prerelease |
| `entrypoint` | 常量 `mc-tools/cli.py` |
| `publicPaths` | 无重复的相对文件路径数组，包含本节布局中的入口、两份根指南、Interface、release 和资源索引 |
| `operations` | 操作 ID 到描述的对象；首版只能列入真实实现并通过仓外验收的能力 |

每个操作描述有且仅有 `inputSchema`、`outputSchema`（JSON 对象）、`errorCodes`（唯一字符串数组）、`sideEffects`（本产品工具固定为 `none`）。 **inputSchema 只校验请求的 input，outputSchema 只校验 ok/partial 回执的 data；二者均不重复描述外层信封。** error 回执由稳定入口核对状态/诊断结构，不用成功 data Schema 覆盖原业务错误；全局 format/requestId/operation 由入口统一处理。JSON Schema 语义由产品真源导出，发行检查器只做完整性及保守差异检查，不自创通用 Schema 包含性证明。不得因为操作名存在就声明 compose/edit 全协议覆盖。

稳定产品 CLI：

```text
python -B mc-tools/cli.py describe
python -B mc-tools/cli.py check-release
python -B mc-tools/cli.py self-test
python -B mc-tools/cli.py invoke <operation>   # stdin: UTF-8 JSON
```

`invoke` 请求固定为 `{ "format": "metriccanvas-mc-request/1", "requestId": "...", "input": {...} }`。输出固定为 `{ "format": "metriccanvas-mc-result/1", "requestId": "...", "operation": "...", "status": "ok|partial|error", "data": {}, "diagnostics": [] }`；`data` 的实际类型和业务诊断由各操作 Schema 定义。结果仅表示产品计算，不表示外部查询/保存/发布成功。stdin/stdout 仅一份 JSON，日志走 stderr；成功/部分成功退出 0，产品拒绝退出 2，运行环境/发行错误退出 3；不使用网络补齐缺输入。

`describe` 返回真实 Interface；`check-release` 校验四项；`self-test` 在禁网条件执行发行自带固定产品样本，不产生外部业务写入。检查通过不授予权限。这些产品入口已由 S05 实现；开发检查器的 seal/verify/compare 仍是独立的构建侧入口。

### 首版真实支持面

以发行内 `interface.json` 的实际操作 Schema 为机器真源；下表列首版已有实现，不把操作名解释成任意创作需求均可完成。查询与外部状态作为显式材料传入。

| 操作 | 产品职责 |
|---|---|
| `content.read` | 按稳定资源索引读取、检索产品知识 |
| `page.project` | 页面/Schema 读取投影 |
| `page.scan` | 页面用数扫描和指定组件作用域 |
| `page.validate` | 同源页面规则及指定文件名/布局校验 |
| `page.upgrade` | 受支持版本的页面升级 |
| `page.parameters` | 页面参数解析、候选准备及受控应用 |
| `query.prepare` | 从显式上下文派生查询定义 |
| `results.normalize` | 显式查询结果的字段映射/归一化与呈现纠错 |
| `page.compose` | 显式结构计划与已提供结果装配候选 |
| `page.edit` | 对指定文档执行受控修改并校验候选 |
| `results.check` | 查询结果证据及通用作用域规则核对 |
| `work.check` | 工作副本/版本前置规则核对 |
| `receipt.check` | 显式执行回执、版本与页面结果核对 |

首版运行要求为 Python >=3.12、Node >=22 和发行声明的六个精确 Python 依赖；依赖升级走显式环境升级。`internal.evaluation.validate` 仅为发行内 Python/Node 共用的私有校验路由，不列入上述操作，也不注册为 MCP。

## 4. 资源索引（S02）

沿用 `mc-content/index.json` 的 `topic → key → content-relative-path` 对象结构，空 topic 允许；每个 topic/key/path 必须是非空字符串。topic 不含冒号，资源 ID 为 `topic:key`，与正文哈希无关。每个路径必须指向四项中 `mc-content/` 下的实际文件，不允许绝对路径、父级跳转、反斜杠或路径别名。

0.3.2按实际Interface为各操作增加`runtime:operation.<操作名>`输入概览，包含必填项与完整契约指针，不作为完整校验器或MCP注册Schema。完整Interface由程序持有，模型按任务读取概览和必要属性；公开请求从`mc-tools/examples/index.json`选择并通过固定入口执行。

旧 ID 必须继续解析；可调整内部存储地址。旧公开路径的保留由 `publicPaths` 检查。两份指南按任务解释资源，不复制全量产品规则；索引、链接和生成物同源检查。

## 5. 发行清单与确定性（S03）

`mc-tools/release.json` 字段有且仅有：

| 字段 | 约束 |
|---|---|
| `format` | `metriccanvas-relay-reference-release/1` |
| `releaseVersion` | 三段整数发行版本，独立于其他版本序列；同版本不得替换为其他内容 |
| `interfaceVersion` | 必须等于实际 Interface version |
| `resourceIndexVersion` | 索引格式的独立三段整数版本 |
| `runtime` | `{ "python": "约定版本要求", "node": "约定版本要求", "dependencies": {"name": "精确依赖约束"} }`；值非空；初始版本按真实运行审计冻结 |
| `pageSchemaVersions` | 非空且无重复的页面版本字符串数组 |
| `defaultPageSchema` | 必须属于 pageSchemaVersions；普通升级不得静默提高默认产物版本 |
| `files` | 每个相对文件路径到原始字节 SHA-256 小写十六进制摘要的映射，包含两份指南 |
| `releaseId` | 下述规范化内容的 SHA-256 |

清单生成只从明确的候选目录及元数据读取；元数据为构建侧输入，非第五项运行输入。`files` 包含四项中的全部普通文件，但排除 `mc-tools/release.json`，以消除自引用。`releaseId` 对去掉 releaseId 字段后的整个清单做规范化 JSON 计算：UTF-8、键排序、紧凑分隔符、`ensure_ascii=False`、无末尾换行、禁止 NaN/Infinity。清单落盘采用同一规范化字节加一个 LF；verify 同时要求清单字节符合此规范。所有输入 JSON 必须 UTF-8，数值指数溢出为 Infinity 也拒绝。

路径必须规范化、大小写不冲突；符号链接、特殊文件、Python bytecode、`__pycache__`、`.DS_Store` 均拒绝。JSON 拒绝重复键和非有限数字。校验必须同时发现缺项、多项、摘要变化和清单篡改。完整性只证明字节相配，不证明来源可信或运行语义正确；来源由实际采用流程记录。

产品确定性计算若依赖“当前时间”，完整输入还须包括明确评估时间及业务时区；不得默默读取机器时钟或机器默认时区。 时间敏感操作采用 `input.evaluation = {instant, timeZone}`，不改变全局请求信封，也不写入 PageDocument。共享 JSON Schema 由页面产品模块的 `EVALUATION_SCHEMA` 单一维护（当前作者位置 `metriccanvas-authoring/core/page/product-contract.ts`），导出器从同源描述生成并内联到各操作契约；其他模块及导出器不手写第二份语义规则。最终 Interface 的引用必须在四项内闭合。 业务模块可用构建侧 `SCHEMA_BINDINGS` 声明共享定义依赖，导出器必须在发行前解析所有声明；缺少/未知共享定义或绑定未解析时导出失败，不得将构建占位当作最终契约发布。 声明绑定无实际命中同样拒绝导出；解析后的共享约束必须在运行时生效，不能只生成说明。业务输入优先由同源操作处理器校验以保留诊断顺序，稳定入口不重复重排它们；声明 evaluation 的操作不得忽略已提供的非法上下文。ISO 时间与 IANA 时区语义由同一产品实现校验，可由发行内私有 Node checker 供 Python 入口复用；私有 route 不加入公开操作/模型工具，不以页面自检夹具代替生产校验。结构与语义诊断保持同源，声明 evaluation 的非页面校验路径亦须覆盖；缺/非法上下文分别返回 `EVALUATION_CONTEXT_REQUIRED`、`INVALID_EVALUATION_CONTEXT`。由可信程序按本轮固定一次并供给评估上下文，Relay 不允许模型覆盖；它不是分析 asOf/筛选期间，产品也不把它当作授权。节点 path/hash/schemaVersion 只从已校验发行解析，不接受公开请求中的任意本机资源位置。本批已完成时间敏感校验透传，仓外/跨进程时区向量和实际页面浏览器对照分别验收；不能以全局替换 Date 或改期望值伪造通过。

同一冻结源码/输入/工具链双次导出，路径/字节必须一致。不写当前时间、开发绝对路径或随机 ID；有序序列化，不因内部重构批量重命名公开资源。不变内容不更新哈希。原始产物的字节是摘要真源，不能通过规范化业务文件掩盖实际变化。

## 6. 兼容比较与采用判据（S03/S06）

开发侧固定命令（S03 实现）：

```text
python -B tools/relay-reference/cli.py seal <candidate-root> --metadata <build-metadata.json>
python -B tools/relay-reference/cli.py verify <candidate-root>
python -B tools/relay-reference/cli.py compare <current-root> <candidate-root>
```

`seal` 仅写候选中的 release.json；已有不同清单拒绝覆盖，同内容重复生成不改字节。`verify` 只读；`compare` 先校验双方完整性，再做保守兼容预检查。它们不是安装器，不激活发行、不修改 Relay 状态、不调用 Java/DQE。开发检查器可用标准库执行，不能由此宣称未来所有产品操作零依赖。

检查回执固定包含 `format: metriccanvas-relay-release-check/1`、`status`、`code`、`details`、`eligibleForSmoke`、`automaticPromotion: false`。`verify/seal` 成功的 eligibleForSmoke 仍为 false；只有 compare 的兼容预检查通过为 true，含义仅为可以进入 Relay 冒烟。CLI 成功退出 0；合法但需迁移退出 2；损坏/非法输入退出 3。状态分别 `ok`、`needs_migration`、`error`，不得输出“已部署”。

必须拒绝普通自动采用的变化：

- Interface 或索引格式主版改变、版本倒退，已有操作被删除或其任一契约字段变化。
- 已有资源 ID 或 publicPaths 消失；默认页面版本改变、旧支持版本被删；运行依赖约束改变。
- 同一 releaseVersion 出现不同 releaseId，或普通升级发行版本倒退；精确相同发行可返回 no-change。
- 新增操作但未升 Interface 次版本；缩小既有支持范围；缺失稳定入口/指南。

首版预检查只自动接受“旧契约原样保留 + 增加新操作/资源 + 内部实现/内容变化”等可保守判定情况。修改既有 JSON Schema，即使只是加可选字段，也暂判需迁移复核；不凭新代码声称的 compatible 布尔值放行。以后若增加更细的兼容判定，须有冻结旧消费者向量和版本化规则，不自动重录旧样本。

候选语义正确还必须由 MC 固定产品回归、受支持最早消费版本/最后采用版的冻结调用回放及实际 Relay 包装的本地 fixture 冒烟证明。清单或预检查通过不能代替这些。兼容报告必须列出版本、真实差异、未验层级；契约/依赖变化走显式集成升级。纯文档/内部重构也执行固定自动回归；额外人工联调由行为影响或失败触发。

## 7. Relay 原子采用与回退（S06，Relay 所有）

候选四项进入暂存根 → 完整性/兼容预检查 → 固定产品与 Relay 包装冒烟 → 锁定切换 → 重新加载资源/程序缓存 → 检查实际注册和结果 → 成功采用或完整回退。阶段和失败原因必须可观察，不能依赖模型解释变更文档来做机器兼容判断。

切换只改四项，保留 Relay 其他文件。发布锁或已有原子切换机制防止读取半批内容；在途轮次使用原批次完成或冻结，unknown/取消/迟到状态不丢、不触发重发保存。回退明确恢复已验证的旧 releaseId，不能因普通 compare 拒绝降版就以新版本重新生成旧清单。

实际程序行为验证包括保存前/后取消、真正并发 CAS、崩溃重启、未知写入、预览失败和迟到产物。默认 data-exploration-report 与显式 platform-authoring 的真实注册、可信注入和唯一工具绑定均要验证。MC 不在本仓写生产 Relay 替身来关闭这一项。

## 8. 验收编号和证据边界

| 编号 | 验收 | 证据 |
|---|---|---|
| A01 | 顶层严格四项、缺项/混批/篡改拒绝 | 发行检查器正反例 |
| A02 | 稳定 Interface/资源路径，旧调用与 ID 保留 | 冻结旧契约、资源样本和实际包装回归 |
| A03 | 双次生成逐字节一致，换 cwd 可读，输入不变 | 独立目录导出与回读；清单双次生成仅证明清单部分 |
| A04 | 删除操作/资源、改必填/输出、依赖/默认 Schema 改变、主版变化被拦住 | 兼容矩阵，且不发生安装/业务写入 |
| A05 | 不透明内部文件移动后旧包装仍能调用 | 真正产品 facade + 仓外四项；模拟目录仅是结构检查 |
| A06 | 产品入口禁网运行，参数/校验/compose/edit 等首版承诺能力完整 | 同一真源打包、仓外实际产品样本 |
| A07 | 无 wheel、无仓库/node_modules 回退、无目标端构建 | 四项清洁安装、初始环境清单及缺依赖负例 |
| A08 | 连续兼容更新、跳跃更新、切换失败回退，包装/Skill/配置不改 | 实际 Relay + 固定发行夹具；随后纳入真实发行 |
| A09 | CAS/单次保存/unknown/取消/迟到/精确交接守恒 | 实际 Relay 包装 + 本地 HTTP fixture；真实环境另记 |
| A10 | 页面规则与 local-authoring 同源，独立安装继续成立 | 相关产品/页面试验场浏览器/生成/独立 Skill 检查 |

首批 S03 的最小四项夹具不是可供生产的 MC 工具，也不证明 A05–A10。真实 Relay 仓库、内网身份/Java/DQE、真实模型、CI/部署的回执分别记录；没有运行保持未验。不得通过目录/操作名占位把首版支持矩阵写成全绿。

## 9. 分批推进与实施约束

S01 spec/ADR/来源基线 → S02 稳定外壳与覆盖矩阵 → S03 发行检查器 → S04 纯核心 → S05 四项导出/实际稳定 facade → S06 Relay 采用/联调 → S07 剩余创作能力。任务依赖、文件范围、负责人、退出条件和未验项见[执行台账](relay-reference-execution.md)。

本批不增加 PageDocument 字段；纯核心提取、显式评估上下文和旧在线包装的同源委托已实现。S04/S05 同批更新页面场景、协议文档、Content 和 local-authoring（1.19.3）；旧渲染调用省略 evaluation 时保持原默认行为。实现代码均实测自身及全部新辅助函数复杂度，禁止手改派生摘要。本仓旧在线代码只在实际 Relay 接收并通过相关验收后按 allowlist 退役。Git/CI/部署随明确交付执行，不因 spec 落盘自动发生。

## 2026-11-04首次正式基线确认

用户确认首次尚未接入Relay的正式基线采用Schema6.83。发行0.2.0/Interface1.1.0在这一基线做初步对接；开发期0.1/6.82固定消费样本仍保存原始SHA。其对6.83的23条实际回放有8条完整回执变化，defaultPageSchema及旧compose/edit内嵌Schema变化，必须如实报告needs_migration，不能更新旧预期改成兼容。

首次采用使用仓内版本化来源记录、独立新消费样本与人工审查差异；构建侧正式/历史基线分别报告。`--current`始终比较真实当前采用四项，任何不兼容均拒绝，首次记录不提供force绕过。新消费记录不自引用未来candidate releaseId；归档及来源回执另外绑定实际候选字节与构建Git状态。内部源码重排不变更稳定入口/ID/描述；实际默认或契约改变继续按迁移流程处理。
