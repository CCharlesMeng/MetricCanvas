# Relay 返回意见的采纳与保留判断

日期：2026-11-02。原件：[feedback.original.md](feedback.original.md)；字节摘要：[receipt.json](receipt.json)。返回件仍为 Relay 源码/配置静态意见，没有 R/T/P 运行证据。本轮没有直接访问 Relay 检出；用户转交内容作为待核对来源，不将其中的修正指令自动视为事实。

结论：**采纳职责细分、两项可信上下文供给缺口、召回对象类型和新默认路由；不采纳覆盖两个检出的注册数量、把轮次文件桥等同 StateStore/CAS、把 inspect 整体视为静态知识或以最新意见消除先前冲突。** v1.0 冻结保留，新版为[评审稿 v1.1](../../plan/2026-11-02-product-relay-evolution/relay-review-design-v1.1.md)。

## 1. 可直接进入方案的内容

| 返回发现 | 采纳与实现决定 |
|---|---|
| 三个 tool_mc_* 同名双提供方，与 publish/list/submit 不同 | 拆两组：R02 对账签名/返回/产物并唯一绑定，R10 保留三个唯一入口的实际用例。不由集合差异推断历史首次新增 |
| turn_provider 覆盖 10 个，list_existing_page_urls/submit_ai_summary_body 缺注入 | 作为 Relay 静态发现登记 I02；首选扩展可信注入，保留 Gate。供给不足可导致拒绝，不能据此断言授权绕过或一定空串 |
| 三个 tool_mc_* 不接受 context_ref | 不注入未知 kwargs；query/compile 与 inspect 的授权需求分别看实际行为 |
| nl2sql_prefetch/plugin、unified_dsl_execute/工具、recall-report/subagent_visibility | 修正对象类型和调用图；定位不等于完整行为已验收 |
| data-agent 流式路径由 nl2sql_prefetch 参与 | 纳入 I04/预览及召回的交接回放，不只测试 preview_bridge |
| domain/ 平行副本已删除 | 按 Relay 静态说明记录，迁移不预设仍有该双实现；没有将删除日期作为本仓独立历史验证 |
| Guard 默认入口改 data-exploration-report，platform-authoring 需显式指定 | 关键新增范围：I01/I07 清点两个 Skill、Guard 触发与工具/产物；默认与显式入口分别验收，不擅自改回旧路由 |
| I07 协同点未明确 | 拆成只读分析、普通源接数、方法减负、多槽接续四项依赖；I05/I08 可并行，T1 不阻塞首条普通源切片 |

## 2. 不应照单执行的修正

### C01：9 与 15 是不同检出的事实

本轮重新执行公共 FastMCP 工厂 list_tools，结果仍为 9 个；见[重新复核](mc-registration.rechecked.json)和[完整导出](tool-contracts.mc-v1.1.json)。Relay 文件静态定义 15 个也可以成立。不能把本仓实际结果改为 15，或把其静态定义称为运行注册。

v1.0 的“fork 新增六入口”措辞会混淆历史来源，本版改为“两个检出的工具集合差异”，并分唯一/双提供方。是否归公共默认是政策/产品归属问题，不能用它消除实际代码差异。

### C02：CurrentAuthoringTurnPort 不是 StateStore

本仓 AuthoringAdapters 明确分别装配 current_turns 和 store。file_based_turns 的 current_scope/current_turn 证明轮次供给方式，不能证明工作稿、query、budget、submission 的存储位置。

本仓 StateStore 的 Interface 为 read(namespace,key) 和 compare_and_swap(namespace,key,version,value)。原子替换文件只证明单次写不撕裂；身份 Gate 只验证当前绑定。两者组合并未证明“比较指定版本并写入”的并发原子性。需要工厂 store 实例及其具体 read/CAS 方法，文件或数据库实现均可；竞争、跨进程与崩溃行为另验。

因此不确认“实际 store=文件桥”或“SQLite 仅为未来候选”。本仓存在 SqlitePlatformState 实现，也不能反向证明私有 Relay 使用它。

### C03：inspect 不能整体归入静态知识

原报告明确 tool_mc_inspect 读取预览文件并按 artifactRef 匹配，是对程序产物的检查。没有 context_ref 参数，只说明签名不能接受该参数，不说明不需要可信作用域。

保留参数兼容时可使用当前轮次 Port/可信程序上下文核对 binding/artifact/spec；若改签名，注册、注入和兼容调用一起演进。不以报表名或模型给出的引用替代程序关联。

### C04：I07 不应被全部 I06 强制阻塞

首条普通查询源换绑不需要多槽表达。I07 的多槽接续扩展依赖 I06；只读分析依赖 I05/I03；普通源接数依赖本批连接/正确性及 I03/I04；删除方法兜底依赖相应工具和 local 路径覆盖。采用后者，避免把独立支线串成不必要的长链。

## 3. 三组前后冲突仍需小范围消歧

| 项目 | 先前报告 | 本次意见 | 最小补证 |
|---|---|---|---|
| Relay MC 内容 6.77 | 给出 mc-content.version.json、product-contracts/manifest.json、contract-alignment.json 的具体位置 | 称 6.77 不在其检出 | 两次实际内容根目录、文件摘要、Git/安装身份；不要仅重新 grep 一个版本字面量 |
| 状态存储 | 补充称 SQLite 已用于工作稿 | 称当前为文件桥、SQLite 是未来候选 | 同一根目录 factory 中 current_turns/store 装配及方法实现 |
| turnId | 称 sha256(session_id)，稳定 per-session | 称从 trace_id 派生，逐请求变化；requestId/runId 仍等于 session_id | 派生函数体、trace 生命周期与完整 binding 样例，随后做隔离回放 |

返回件声称代码同步只改 RELAY_GUARD.md。这不足以解释以上实现陈述为何变化，故不自动认定后件全部替代前件。可能的根目录/版本/解释差异保持未知，不推测唯一原因。

state 文件中存在完整 documentJson，也不能证明其来自前端未保存工作副本；可能来自 Java 读页。R05 仍需输入来源链，不能以“完整”替代“当前且来自工作副本”。

## 4. 本轮 MC 独立复核

- 实际公共注册仍为 9 个，完整 Schema 重新保存。
- 并行产品演进已使当前活动协议成为 **6.80**；源码 CURRENT_MINOR、活动 lock/snapshot manifest 和 MC alignedWith 相符。v1.0 的 6.77 保留为历史快照，不改写成运行时永恒目标。
- 既有 check_bundle.py 本轮退出 0，**6,568** 项摘要核对通过；[回执](check-bundle.json)。早前 6,464 项及 218/15 项测试保持各自时间点，本轮未重跑这些行为回归。
- 只读核对公共 AuthoringAdapters、CurrentAuthoringTurnPort、StateStore 和 SQLite Adapter；没有加载真实内部工厂/服务。

本轮只保存原文、更新设计和评审资料，未改运行代码/Skill、生成产品投影或覆盖内部安装。无新增可执行分支，不伪造复杂度前后变化。

## 5. 对启动条件的影响

共享分析、呈现纠错、多槽产品补齐仍可启动；新默认入口不改变双策略共享底座目标。正式线上统一接入需先取得 data-exploration-report 的实际能力链，并消除版本/工厂/轮次三组冲突。集中补这四类材料即可，其他运行项留在对应批次，不要求再做泛化审计。
