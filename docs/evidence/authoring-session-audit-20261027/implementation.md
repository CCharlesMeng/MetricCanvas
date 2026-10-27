# 创作契约可靠性：本地实施与验收

日期：2026-10-27。实施基线 `d227d53814978e87753c79c9224c40a8a244d806`，隔离工作树 `authoring-contract-reliability/DataDashboard`。本记录形成于提交前；用户授权提交到 main 并使用 `[skip ci]`。没有生产访问或真实部署验收。

原始日志、截图和复杂度明细按仓库规则不提交，工作树清理前保存于本机 `/Users/moon/.codex/delivery-evidence/authoring-contract-reliability-20261027/`；下文同名产物可在该目录读取。

## 本批修改

| 事项 | 本地行为及证据 | 仍需部署确认 |
|---|---|---|
| T1 时间 | Python 公共查询与 TypeScript 最终指标 DQE 编码共用同一组 17 条验收向量；规范格式、紧凑格式、M 别名、日历、倒置、错精度；非法输入零 DQE 调用。等价输入规范化后授权、复用相同结果身份，回执仅展示本次输入调整 | 真实 DQE 的年/月/日协议编码；未擅自全局改成紧凑编码 |
| E1 诊断 | 查询错误按本次 batch 索引定位，缓存跨索引复用不串位；数据上下文路径保留单独 pathScope。操作 Schema 返回字段及安全期望，不回显用户值。编辑/装配保留 operationId/blockId 与实际组件类型；变化字段有可区分原因 | 外层 Relay 是否完整保留 modelSummary |
| D1 业务域 | 当前授权快照中精确同名/受治理别名候选，有界、显示单位/定义、覆盖及截断；兼容与可执行性保持未知；不自动换域或替代派生指标 | 实际元数据可见范围与候选采用情况 |
| R1 DQE 响应 | 保留 ERROR+空行失败、SUCCESS+空行业务空、非 SUCCESS+非空行现行消费矩阵 | 生产返回与参考 Adapter 是否一致 |
| C1 指标卡 | 完整性和唯一选行一次完成，普通卡与 metric-summary 使用同一可信结果；缓存部分行、总量未知、零/多匹配不构成证明；保留单位及关系要求 | 真实查询证据与生产卡片 |
| I1 产物检查 | 程序接口 inspect_artifact 按精确引用、摘要、binding、原样 spec/compileInput 关联检查；实际合成保存后的产物可在 preview 前检查；交叉产物/旧 spec 返回 not_run | 外部 tool_mc_inspect 采用该接口，不以“最新预览”代替引用 |
| K1 内容目录 | catalog queryRef 从同一索引生成；规范 key 优先，唯一 topic 内短名兼容，歧义返回候选，返回 canonical key/continuation | 外部工具封装耗时 |
| S1 连续编辑 | 成功回执可续编；保留服务端当前版本核验。失败操作和组装占位回显实际状态，独立操作及 dependsOn 原有语义保留 | 真实重复读取是否必要 |
| M1/P1 采用与归因 | 部署诊断增加实际类/模块和源码模块指纹，声明不等于验收；示例 Adapter 标注既有 turn-metadata 能力。公共调用、授权、元数据、DQE、远端基线和保存增加父子 span；缓存事件能关联当前 span | 内部 factory 与 Adapter 薄接、IAM/TitanScc、跨进程调用链、认证耗时 |

内部 `adapters/` 未覆盖。没有访问真正的 Relay、IAM、Java 保存或 DQE；未执行真实 DS 模型。公共模块能力和模板测试通过不能视为生产采用。

## 验证结果

- 相关 Python：187 项，186 通过、1 项按既有条件跳过。跳过项缺少 `调查报告/数据/语义层查询结果.json`，不是运行失败。覆盖公共 MCP、日期、授权与结果复用、装配/编辑、取消/重启/保存未知、元数据与 DQE Adapter、MC 内容及精确产物检查。命令与原始结果见 `implementation-python.log`。
- TypeScript：8 文件、87 项通过。包含共享日期向量、首次/重查一致性、非法范围零 HTTP、实际 Playground JSON 复验及既有网关响应矩阵。见 `implementation-runtime.log`。
- 当前 local-authoring：5 文件、187 项通过；包含知识链接闭合、仓外复制安装与全量页面契约向量一致性。见 `implementation-local-authoring.log`。
- 完整 `pnpm authoring:check`：6 文件、217 项全部通过，包含独立导出隔离检查，耗时 694.94 秒。见 `implementation-authoring-check.log`。该完整运行后另以当前源码复验上述 5 文件，并确认最终生成产物一致。
- `pnpm exec tsc --noEmit -p tests/tsconfig.json` 通过。生成器从真源更新产品快照、MC 内容和 local-authoring 知识；最终 `authoring:contracts:check` 通过（1255 product、4 authoring、1 interface），见 `implementation-contract-check.log`；最终生成后的目录/精确产物接口 smoke 2项通过。
- 扩展旧 harness 的 failfast 首个失败：`test_interaction_editing.BusinessFilterEditingTest` 读取 main 已不存在的 `pages/capabilities/ioc-header/ioc-header-business-options-demo.json`。`git ls-tree HEAD` 确认基线不存在该路径。全量旧 harness 不声明通过，其余旧套件失败未全部归因。见 `legacy-harness-first-failure.log`；没有为消除这项失败修改无关示例。

## 浏览器证据

- 入口：`http://localhost:5191/pages/authoring-contract-reliability`；listener cwd 是本隔离工作树的 `apps/playground`。
- 普通指标卡和汇总呈现都显示 2，17 条实际解析矩阵显示规范值/准确失败码。刷新后结果保持。
- 非法查询在控制台明确报告 `[MetricCanvas][DQE_QUERY_REJECTED] TIME_VALUE_PRECISION_INVALID: filter.time.start`。零 HTTP 由同一页面 JSON 的网关测试证明；浏览器工具本轮未提供独立网络捕获，不冒充网络证据。
- **现存呈现限制**：ComponentRenderer 将错误源投影为空行，所以末尾表格显示“暂无数据”。本批没有改全局错误样式；这一显示不代表业务空结果。错误诊断与空结果判别必须分开。该项不归为时间校验失效，也不宣称 UI 错误呈现已修复。
- 截图：[browser.jpg](browser.jpg)；控制台：[browser-console.json](browser-console.json)。生成式演示脚本只使用合成输入，未查询业务服务。

## 复杂度

口径：Radon 6.0.1（独立统计所有修改/新增 Python 函数、方法和闭包）；TypeScript 5.9.3 + metriccanvas-ts-ast/1。派生代码不重复作为作者分支统计。

| 函数 | 前 | 后 |
|---|---:|---:|
| block_component | 33 | 15 |
| QueryResults._execute_one | 12 | 14 |
| normalize_request | 5 | 8 |
| operation_batch._apply_operation | 14 | 14 |
| present_metric_summary | 7 | 7 |
| encodedMetricItem（TS） | 11 | 11 |
| mcContentOutputs（TS） | 9 | 9 |

新增 Python 函数最大 12；新增 TS 核心 endpoint=9、normalizeQueryTime=5、normalizeMetricTime=7、addLayoutQueryRefs=6，测试回调最大2。固定 Python 门禁 15 文件、371 函数，最大15、超限0。

存量未关闭：referenced.compose=42→42、referenced.edit=34→34。本批只改安全诊断/状态投影，保持组装、逐操作部分成功和保存语义；不在该修复中扩大到整条异步编排重构。后续仍沿 `docs/plan/2026-10-22-code-complexity.md` 治理。其他同文件未改的存量超限函数不算本次关闭项。完整明细见 `implementation-complexity.json` 与 `typescript-complexity.json`。

## 收口边界

本地代码、文档、演示页与派生产物构成一批可审查修改。实际内部 Adapter 采用、线上 inspect 接线、认证配置与性能、最终九月范围保持仍是外部待验事项。提交前核对远端 main 仍为实施基线；CI 按用户要求跳过，不声明通过。最终提交与远端验证见交付回执。

提交前复核补齐 `OPERATION_INVALID` 的显式错误说明，防止调用改为通用 Schema 诊断后静态目录遗漏该错误码。此次只补常量登记，函数复杂度不变；重新生成并验证分发产物。

补登记后的定向回归：创作契约可靠性与 MC 内容共 47 项通过，最终 contracts check 通过（1255 product、4 authoring、1 interface）。见 `delivery-tests.log` 和 `delivery-contract-check.log`。
