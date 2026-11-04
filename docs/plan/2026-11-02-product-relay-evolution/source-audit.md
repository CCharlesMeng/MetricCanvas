# 现有创作能力探查报告

日期：2026-11-02。范围：页面先行、数据先行、共享脚本、协议/知识生成、工作台与 Relay 参考接缝。用户已确认只据现有 Relay 参考判断，本次没有访问私有 Relay 或真实 DQE/Java。

结论：已有两条路径所需的大量基础能力；主要缺口集中在**页面用数需求到真实结果的连接契约、保留现有页面的受控增量接数、两种策略的状态接续，以及工作流/分发的同步验收**。不能只合并 Skill 文本，也无需重写 Schema、引擎或查询执行。

执行顺序、文件范围和退出条件见[迁移与同步计划](migration-sync-plan.md)，设计方向见[主计划](../2026-11-02-product-relay-evolution.md)。

用户提供三份存量拆分材料后的补充核对见[材料评估](legacy-material-assessment.md)：确认上游 DATA_BLOCK 的多槽表达缺口；修正编辑路径、完整工具契约注册与 firstparty 所有权判断；新增部署差异、Relay Skill 改良和召回探查。补充 15 项本地检查与契约探针单列，不替代下列原始回执。

再后续接收的 [Relay 静态审计及本仓复核](../../evidence/2026-11-02-relay-authoring-static-audit/README.md)已经落盘。本轮重新取得 9 个公共工具完整输入，Bundle 6,464 项摘要核对通过；原报告的生成 stale 是早前时间点结果，不代表当前状态。原始 218 项测试没有重跑，不能合并成一个新的全量通过声明。

## 1. 基线与证据口径

- 本地 HEAD：`2133241a6b4f259fc19ff54bfdd9a0dcb9c96e06`，工作区存在多项并行修改和未跟踪材料；不是干净发行快照。本次未 fetch、提交、push 或校验远端 CI。
- Node `v24.11.1`，Python `3.12.13`，TS AST 测量使用 TypeScript `5.9.3`。Python 使用仓库 Tool venv，避免将缺 FastMCP 的系统 Python 当产品失败。
- 实际离线 FastMCP 注册：9 工具、edit 36 分支、compose 10 类数据组件；组件目录 19 类。页面协议 6.77、产品版本 `1.0.0-rc.4`、Bundle/authoring 契约 0.3.1。local 入口标注 1.14.11。
- [实际注册能力及 Schema 摘要](audit/registered-capabilities.json)、[选择性源码指纹](audit/source-fingerprints.json)、[测试回执](audit/verification.json)、[TS 复杂度](audit/complexity-ts.json)、[已登记来源差异](audit/recorded-source-drift.json)。指纹在探查后记录，不冒称测试前冻结的不可变检出。

本报告区分：**可复用**（已有实现）、**需提取/适配**（有实现但受当前包装约束）、**待新增**（现有公开路径不足）、**仅参考/未部署验收**。本地测试不能证明真实服务、业务口径或视觉完整验收。

## 2. Skill、脚本、协议逐项核对

表中 Python 路径相对 `metriccanvas-authoring/tool/metriccanvas_authoring/`。

| 编号 | 能力与当前实现 | 已有事实 | 迁移判断 |
|---|---|---|---|
| C01 | local SKILL.md、data-analysis/local-workflow/page-form 等作者说明 | 页面先行、形态/场景选择、已有页最小修改、材料分析、真实执行边界、快照和预览修复均有流程 | 复用策略和作者方法；抽离文件宿主假设，保留独立安装 |
| C02 | 平台参考 SKILL.md 与四类 workflows | 需求/计划审核、discover/query、resultRef、compose/edit、参数和精确预览有明确流程 | 数据先行参考可复用；未证明真实 Relay 采用；补页面先行路由和同页接续 |
| C03 | `local-authoring-data-analysis.ts:181–203` | `scanPageData` 从产品 Schema/组件树提取用数，投影数据源并保留 filters/params 与诊断，避免输出 initial 行 | 需提取为程序可调用核心；不是设计稿自动理解能力，也不保证无合法绑定草稿的需求完整 |
| C04 | `local-authoring-data-scope.ts:32–87` | 复用产品引用规则计算共享消费者/依赖闭包，局部读取仍保留全局上下文 | 可复用读取范围；不得当最终变更授权或缩小报告覆盖 |
| C05 | `local-authoring-data-analysis.ts:224–264` | draft 产生 unresolved/not-run、MD 候选与缺口；check 核对输入摘要、位置覆盖、原文引用和状态 | 可复用材料证据记录；语义匹配由模型核对，材料匹配不等于查询执行 |
| C06 | `local-authoring-data-cli.ts:48–104` | 文件/manifest/Schema hash 包装；prepare 在内存替换 query 候选、拒绝 initial、校验整页，仍 not-run、不写原件 | 纯候选检查可提取；CLI/进程状态留 Adapter；不是接数提交工具 |
| C07 | `data/results.py:39–45,258–275` 及 query/authorization | 查询前授权、精确请求摘要、版本与验证策略、结果作用域、真实执行/字段证据、有限模型摘要 | 直接复用公共数据链；从页面形成的需求仍须经同样授权，不能复制查询语义 |
| C08 | `pages/compose_contract.py`、`pages/referenced.py` | 由验证结果构造页面；日期筛选/pagedJoins 已有；布局/组件和预算是受控闭集 | 可复用证据到页面；不能当任意已有页面重新接数接口 |
| C09 | `pages/referenced.py:148–183`、受控 edit 操作 | add_result_component 可原子引入结果源和新增组件；同源 ID 的定义不一致会 DATA_SOURCE_CONFLICT | 待新增保留现有组件/布局的改源与映射操作；不能用“再加一个组件”代替 |
| C10 | `pages/editing/operation_batch.py`、`pages/platform_authoring.py`、`assets/drafts.py` | 逐项候选/回滚/依赖、partial/no-change、完整页校验、CAS、冻结提交、单次保存和恢复已有 | 保持公共用例；新增接数操作复用，独立原子处理其完整依赖 |
| C11 | 产品校验与 Python `page_validation.py:81–110` | 同源 TS Node Bridge 已用；部分页面仍进入 Python Schema/语义分支 | 复用产品真源，但不能宣称所有规则已完全同一实现；迁移需完整有序错误回归 |
| C12 | `working-copy-agent.ts:41–90`、平台集成 contract | 保护/锁定后传完整未保存快照、hash、精确修订和 requestId；回执及更新按当前轮次应用 | 线上页面先行的现成承载接缝；尚无完整“需求→映射→接数”产品闭环 |
| C13 | 平台 document-edit 与创作画布 | 工作副本中的标题/组件/顺序/类型等人工编辑与统一渲染共存 | 保留并接续，不替换为远端旧页面或第二份文档持有者 |
| C14 | `mc-content-knowledge.ts:12–36`、投影/导出器 | MC/local 已从同一产品 reference/知识核心生成；platform 事实参考单向生成，Report 组合同源 | 直接扩展现有生成链；不是从零整合两份知识，也不手改安装投影 |
| C15 | MC query/compile/inspect/schema/upgrade/evaluate | 有界知识、模板编译、程序产物检查和旧页升级独立可用 | 可复用确定性函数；compile 仍产 compose request，不能用于既有页面换源；inspect 不保存/授权 |
| C16 | 参数/共享执行与产品引用/绑定工具 | 产品参数变换、page 数据执行与引擎共用执行能力已有 | 复用这些规则；不为页面先行再写一份分页、期间、参数或计算执行 |
| C17 | adapter_contract、ownership、Relay 交接 | 公共端口与内部 adapters 所有权已明确；真实 loader/tools.py/SDK/权限/预览接线只据参考 | 接线独立；公开工具/保存协调继续归 MC；私有扩展不冒充公共能力 |

源码链接：[分析核心](../../../tools/scripts/local-authoring-data-analysis.ts)、[范围核心](../../../tools/scripts/local-authoring-data-scope.ts)、[CLI](../../../tools/scripts/local-authoring-data-cli.ts)、[结果消费](../../../metriccanvas-authoring/tool/metriccanvas_authoring/pages/referenced.py)、[查询记录](../../../metriccanvas-authoring/tool/metriccanvas_authoring/data/results.py)、[操作批处理](../../../metriccanvas-authoring/tool/metriccanvas_authoring/pages/editing/operation_batch.py)、[工作副本接入](../../../apps/platform/src/lib/workbench/working-copy-agent.ts)、[知识同源生成](../../../tools/scripts/mc-content-knowledge.ts)。

## 3. 关键断点

### G01：用数位置和真实数据需求之间还没有闭合契约

现有 `DataUse` 记录位置、组件、源/槽/字段及少量声明；完整语义要求主要来自字段契约、材料和模型核对。draft 默认所有条目未匹配/未执行。不能自动当成已确认的取数单元，也未建立页面意图、真实结果和映射的统一关联。

报告检查绑定页面原始字节、MD、Schema 摘要，并以字段路径定位条目；页面重排会影响摘要/路径。迁移需要稳定身份加基线重核，不能无条件继承旧报告。尚未接数的页面意图也须在创作期承载，不能为闭环发明非法渲染字段。

### G02：材料候选、执行证据、写回页面是三个不同能力

prepare 只接受 query 候选，拒绝 initial，要求所有受影响用数已材料匹配，并对候选整页 parse；返回 `execution:not-run`。它没有 execute/save 能力，已有 scan/prepare 也不应被改名包装成已接数。

公共 resultRef 精确绑定当前 prepared.binding，并重新核对元数据版本、验证策略与授权。跨策略可以共享有效业务依据，但跨轮次/身份不得直接搬旧引用；需可信程序重核或重新查询。

### G03：已有源替换/字段重映射的公开操作不足

当前 add_result_component 面向新增结果组件，同源 ID 定义不一致会拒绝；set_properties 只是呈现白名单。没有一个完整的“现有组件保留→核对共享消费者→替换源与映射→全页验证→原保存路径”公共操作。

因此新增受控增量接数是实质功能，不只是迁移脚本。需在既有 edit/batch/保存用例里实现，不允许完整 JSON 补丁绕过验证或重新 compose 代替换源。

### G04：脚本实现可复用，但包装尚未宿主无关

分析核心使用 Node crypto，CLI 读取磁盘 Schema/manifest，错误依赖 process.exitCode；直接放进浏览器不成立。应拆纯分析/候选职责与文件/哈希/退出适配，先用已有 Node 程序接缝在线消费；不重复写 Python 扫描器或急于统一语言。

### G05：前端接缝已有，任务闭环未形成

工作台能冻结/保护/传送未保存快照及处理 completed/failed/unknown，但参考 Skill 主要走数据先行；页面先行的需求/映射交互、受控换源和双策略接续还需补齐。接缝测试通过不等于已上线用户自定义能力。

### G06：生成同源已有，采用与覆盖尚未闭环

工具完整 Schema 已从真实注册导出到 MC，local 和 MC 知识已同源；仍需按两种逻辑记录能力、宿主和公开操作。来源图、知识覆盖、生成一致性、独立安装、实际注册/部署是不同证据层。

## 4. 本轮实际验证

| 检查 | 结果 | 能证明的范围 |
|---|---|---|
| TS：local-authoring-tools、row-expansion、document-edit | 59/59 通过 | 知识读取、材料/候选、依赖、子表用数及现有文档修改行为 |
| TS：working-copy-agent | 9/9 通过 | 未保存快照、身份/轮次、unknown/网络异常、取消/迟到等公开接缝 |
| Python：platform_v2、page_editing、paged_join、page_parameters_mcp | 74/74 通过 | 公共注册、创作用例/保存预览/参数等合成 Adapter 路径 |
| Python：interaction_editing、compose_page、mc_content | 76 项：64 通过、3 失败、9 报错 | MC 33 项全部通过；交互/装配仍有存量失败，不能称整体通过 |
| authoring:contracts:check（正确 Tool venv） | 失败 | 仅报 MC source-identity.json 与 mc-content.version.json stale |

合计 **218 项：206 通过、3 失败、9 报错**，无跳过；不是全仓回归或远端 CI。测试基于本地脏工作区；完整病例和 traceback 在[验证回执](audit/verification.json)。本轮未运行真实模型、浏览器或真实服务验证，没有网络业务查询/资产写入。

存量失败分型：

- 9 个报错均为示例文件旧路径失效；对应 IOC 页面已在 `pages/capabilities/ioc-header/scenarios/` 找到，后续核对按 page id 发现方式，不盲目复制页面恢复旧路径。
- 3 个失败分别是固定 `6.40` 版本断言与当前 6.77 不符、日期用例的 `/iocHeader/filterIds/0` 基线无效、time-granularity 候选预期失配。前者明确是旧断言；其余须重新核对夹具和语义契约后判断，尚未归因或修复。
- 对当前来源清单已列入的 748 项，使用与 Node sourceIdentity 相同的 UTF-8 读/hash 方式比对，发现 2 项变化：`pages/business/report/sdt/README.md`、`pages/temporary/partner-health.json`。这只是已登记输入对比，不覆盖新输入遗漏；其中另有 19 个图像输入，说明分母范围还需核对。未修改这些并行内容，也未重生成清单。

## 5. 迁移相关复杂度基线

口径为 `metriccanvas-ts-ast/1`、TypeScript 5.9.3，selfCC，嵌套函数独立计数。此次未改函数，因此没有前后降幅；[完整结果](audit/complexity-ts.json)保留全部测量项。

| 函数 | 当前 selfCC | 对迁移的要求 |
|---|---:|---|
| scanPageData | 13 | 提取后保持行为及有序诊断，新增辅助函数也实测 |
| scopePageData | 1 | 不能用外层值替代闭包/依赖逻辑测量 |
| prepareCandidates | 14 | 先拆候选检查与 CLI 状态，避免叠加在线执行分支 |
| checkAnalysis | 10 | 同时看内层回调，不据外层判断达标 |
| checkAnalysis 内层 forEach 回调 | 19 | 存量超限；修改本职责时分解，不能搬家掩盖 |
| auxiliaryUses | 20 | 存量超限；新增用数种类前拆职责，或按仓库规则记录风险 |
| createWorkingCopyAgent / inputOf / settle / send | 1 / 3 / 7 / 10 | 复用现有快照/状态语义，全部修改/新增闭包另测 |

Python 本轮没有作新的 Radon 基线测量，不以 TS 数据替代；M0/S1 修改其函数前按固定 Radon 口径测量。这里是迁移审计，未新增可执行分支，无需伪造“复杂度改善”。

## 6. 计划输入与边界

上述事实形成 M0–M6 迁移计划的输入。先冻结与分型，再提连接契约和共享核心；先在线只读分析，再开放受控增量接数，最后验证两种策略接续及扩展能力。直接合并两个 SKILL.md、扩大属性白名单、把完整页面/原始查询送入模型、把匹配状态改成已执行，均不能关闭这些缺口。

公共服务和 MC 事实继续属于产品；Relay 接线独立；local 独立安装继续保持。产品 Schema/引擎、脚本和知识按一项能力同批核对，实际接入与发行回执另验。
