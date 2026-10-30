# pagedJoin 按需分页实施验收

实施基线：`ae60a264323d5c727601dd583a0869224fce5634`。候选项提交 `96e7166b7307f1d4adbd0dfae1d72db9d5a13c50` 已在该 main 中，祖先关系和实际代码均已核对。工作树 `/Users/moon/.codex/worktrees/paged-join-on-demand/DataDashboard`，原工作目录的并行改动保持原状。以上为本地实施验收时点。2026-10-30按用户指令向origin/main交付；精确提交与远端CI结论由交付结果报告。

## 已实现的行为

- Schema 6.76 显式声明 `pagination: {mode: "query", pageSize: 10, batchSize: 10}`。每页窗口与补列批次分别生效；禁止旧完整回退预算、完整记录批次及本地时间过滤混入新模式。历史声明继续原行为。
- 普通一键一行模式由能力成立的成员选当前页，再按本页键补齐其他成员。记录模式保留基准源每条真实记录及真实记录 id，不批量读完后再显示。
- 最后提交成员覆盖其他成员的表格过滤和排序，同成员条件可组合，回到第一页；页面、固定业务与权限约束保留。菜单预览使用预期提交上下文，打开菜单不提交视图。
- 新模式不自动完整预热候选，也不进行完整关联或异常数据全量恢复。复用 main 中已有候选查询、优先级、取消和缓存；旧模式预热保持原行为。
- 重复键、额外键、分页截断、无准确总数、记录单批超时、页字节超限均失败，不自动读取全集。显式导出才逐页收集完整匹配结果，新模式失败不给部分文件。
- 无法保持基准记录粒度的补列源过滤/排序、未经确认的完整为空条件、搜索及不可确认空值顺序的排序在提交前拒绝，保留有效页面并显示原因。隐含的成员默认排序同样接受预检。

## 三项验收对应关系

| 能力 | 可观察页面 | 产品真源 | Skill 同步 |
| --- | --- | --- | --- |
| 一键一行分页、成员覆盖、候选按需 | `/pages/paged-join-on-demand` | `schema/paged-join.ts`、`docs/page-metadata/data-sources.md`、`components/table.md` | `data.pagedJoin.pagination`、协议路由、场景索引 |
| 基准记录分页、真实身份、能力拒绝 | `/pages/record-join-on-demand` | 同上、`validate-record-join.ts`、ADR-0125 | `data.pagedJoin.records`、迁移检查 |
| 类型与版本边界 | 合法页面和非法契约向量 | `version.ts`、conformance vectors | 独立校验器与生成知识 |

Skill 版本1.13.0。仓外复制、零软链、版本查询与两个完整页面校验成功，见 [安装回执](standalone-skill.json)。两份完整元数据位于 `pages/capabilities/table/`；合成数据在 `apps/playground/fixtures/paged-join-on-demand.ts` 与 `fixtures/rejection-details/gateway.ts`。页面内容、请求回执和截图均为合成验收数据，未使用真实业务查询结果。

本地预览服务为 `http://127.0.0.1:5190`。两个入口分别为 [普通组合分页](http://127.0.0.1:5190/pages/paged-join-on-demand) 和 [记录组合分页](http://127.0.0.1:5190/pages/record-join-on-demand)。服务仅在本机进程存活时可用；启动方式与操作步骤见 `pages/capabilities/table/README.md`。

## 检查结果与证据边界

| 检查 | 实际结果 |
| --- | --- |
| 交付前补检 | 144页面全部通过，公开接口及MC覆盖2文件15项通过，契约派生再次一致 |
| `pnpm check` | 全部包与应用通过，Svelte 0 errors / 0 warnings |
| Page / data-execution / runtime / runtime-ui | 241文件、1986项通过；随后默认排序预检增加1项，受影响2文件18项通过 |
| Chrome 新旧候选回归 | 8项通过；最后默认排序及预览网关职责拆分后8项再次通过 |
| local-authoring、升级与页面参考 | 5文件、196项通过 |
| `authoring:contracts:check` | 1315 product、4 authoring、1 interface 派生文件一致 |
| MC | coverage一致、33项通过；最后文档生成引起诊断证据漂移，官方工具重新生成后 fixture check通过；原失败与修复后日志均在本地保留 |
| 仓外 Skill | 3项校验成功，0软链 |
| 最终产品包构建 | `pnpm build:packages`通过 |
| ADR 索引与 diff格式 | 通过 |
| 导出隔离套件 | 30项隔离场景通过；初轮总命令226项中2项失败（主题输出预算、旧升级示例），修复后5文件196项全通过；共覆盖226项，原总命令不记为全绿 |
| CI、真实DQE/Relay、真实DS模型 | 未运行，不以本地结果替代 |

[合成请求证据](request-trace.json)：总量80与100001均只发2次数据请求，每次窗口10行；100001不触发读完全集。另有注入 fetch 的原生DQE请求编码测试验证 `order.limit=10`、第二页 `offset=10` 及补列键条件；该测试仍为合成响应，不证明真实服务能力。浏览器截图见 [普通页](query-page.png)、[记录页](record-page.png)，已人工查看10行窗口与拒绝提示。

## Schema 与架构冲击

Schema 增加显式分页联合分支和 isNull 条件能力门禁；pagedUnion 的分页结构独立保留。历史模式的 fallback 与 records.batchSize 在语义校验中继续必填，新模式禁止这两套旧读取策略。作者默认写10/10，运行时不添加隐式JSON默认值。

提交状态仍由 TableSession 单一持有；按页选页和补列由共享执行器管理；QueryRunner 继续统一调度；UI controller只维护草稿和局部能力反馈。新增共享视图策略用于提交、执行预检和候选上下文，避免三处分别解释覆盖规则。未增加跨源DQE语法、完整匹配键收集器或新请求池。知识和校验器派生文件较多，来自正式导出器的版本、能力和内容哈希更新。

真实接入仍须验证 `canSelectPage` 的完整行域等价、单键唯一性、单源条件/计数/窗口和稳定排序。记录模式的非基准源操作与完整为空查询仍不可用。实时 offset 与补列请求间没有事务快照，不能保证数据变化时跨页一致。

## 复杂度

固定 `metriccanvas-ts-ast/1` / TypeScript 5.9.3 / selfCC，覆盖37份TS作者源及全部新辅助函数、闭包、回调；原始报告为 [修改前](complexity-before.json) 和 [修改后](complexity-after.json)。Svelte 两份 script 单独提取，新增菜单回调单独测量，见 [脚本报告](complexity-svelte-scripts.json)；模板控制流不冒充TS函数测量。

| 相关函数 | 前 | 后 |
| --- | --- | --- |
| createColumnCandidatesReader 内部回调 | 44 | 11 |
| 拆出的 candidateSource / ordinaryCandidates / localCandidates | 新增 | 12 / 10 / 15 |
| compilePagedJoin | 9 | 12 |
| executePagedJoin / exportPagedJoin | 13 / 12 | 14 / 14 |
| reusableInitialSnapshot | 12 | 13 |
| headerPredicates / shouldApplyTableHeaderFilter | 8 / 13 | 9 / 14 |
| scenarioEnvironment | 15 | 15 |
| previewDataGateway / 新 queryTableGateway | 15 / 新增 | 14 / 4 |
| 新为空按钮回调 | 新增 | 1 |
| 新 queryPagePlan / validateQueryPageSort | 新增 | 5 / 4 |
| 新 selectPage / executeQueryPagedJoin | 新增 | 11 / 8 |
| orchestrate/start | 26 | 26 |

全部新增函数selfCC≤15。存量 `orchestrate/start` 本次只接入分页提交策略，26未增长；跨生命周期拆分会扩大本批风险，保留为后续治理入口。同文件未改的 refetch=17、更新回调=22保持不变，不属于新增超限。匿名函数行号移动及重复名称不能直接按名字映射成新增/变化；报告中的version capability回调按源码逐项核对，不用同名覆盖产生的伪差值。
