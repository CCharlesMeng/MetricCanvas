# DQE 排序编码修复与验收（2026-10-27）

## 结论与边界

修复位于独立工作树 `/Users/moon/.codex/worktrees/dqe-sort-contract/DataDashboard`，基线为 `c0ebb8bc47dd676e9f83e6d21fb2b371402d839d`。主工作区并行修改保留。以下为提交前的实施验收记录，交付提交及 CI 以 Git 历史和交付回执为准；真实 DQE 未复验，本地环境没有可用的 CloudIOC CFTK 配置。

用户请求中的 `order.by` 由运行时自动产生。ADR-0086 将 GraphQL 字段指令 `@order(type, priority)` 推成对象 DSL 数组，没有服务协议证据；数据网关照此编码，分页合并又自动追加姓名/行键次序，合并检查进一步把等值行要求成行键升序；Sim 和嵌入测试端点重复实现该结构，使本地测试无法发现错误。

新请求统一为：

```json
{"order":{"offset":0,"limit":200,"order_by_field":"商审审批人决策次数","type":"desc"}}
```

合同决策意见明细对应字段为用户新样本的 `审批人决策次数(合同)`，不能混用之前申请规范率案例中的 `销售合同评审决策任务数量`。KPI、商务、合同仍为独立查询，网关批量信封不变。

## 修改范围

- `packages/data-execution/src/dqe/dqe.ts`：默认与交互排序使用单字段服务格式，交互原子替换默认排序；多字段、保存的 by 数组和 orderByField 错误拼写在 HTTP 前以 DQE_CONFIG_ERROR 拒绝，不修改页面模板。
- `packages/data-execution/src/dqe/object-query.ts` 与 `packages/page/src/dqe-object.ts`：共享默认单字段解析，错误配置保留结构化诊断；对象显式多字段仍要求可信 encodeObjectSort，不假定服务格式。
- `paged-union/plan.ts`、`paged-union/execute.ts`：不追加来源行键升序，不按未请求的行键次序拒绝等值行；来源 ID 决定跨来源等值次序，来源内保留返回次序。保留主排序单调性、null-last、重复/空键、计数、完整窗口、扫描预算及取消检查。
- `paged-join/member-query.ts`、`packages/page/src/table/expansion.ts`：关联选页和子表格不追加第二排序键；子表格没有默认或用户排序时才以行键升序查询。有界完整本地关联的稳定键排序保留。
- DQE Sim、嵌入测试端点和决策意见预览：使用单字段格式，拒绝虚构数组；共享 Sim 排序保留同值行顺序，null 升降序均在末尾，分页前排序。
- 源页面与契约夹具：迁移查询结果窗口、决策意见示例的 by；顺带发现并修正两张流水报表与对应 Sim 夹具的 orderByField。生成镜像由导出器重建。
- PAGE-METADATA、查询/数据源/表格正文、ADR-0086及其主题页同步；重新生成契约、MC 和 local-authoring 的知识/示例/独立校验器。

## 验证

修复前新增 dqe-sort-contract.test.ts 的四项核心断言全部失败，直接捕获虚构编码、错误默认解析、多字段未拒绝和自动追加次序。修复后还覆盖别名与对象诊断，以及实际网关批量编码路径的跨批次等值流。

跨批次用例：每个来源209行，主指标均为10，行键逆序；通过正式网关发送单字段请求，读取offset=0和200，两来源合并得到完整418行，等值次序不受姓名/行键约束。该测试不声称真实服务已保证稳定offset。

浏览器（本工作树的 Playground，DQE Sim 端口18238）：

| 入口 | 操作与观察 | 证据 |
| --- | --- | --- |
| `http://127.0.0.1:5183/pages/query-result-where-page` | 初始金额降序；执行周期升序首行为P-056/5天；第二页首行为P-072/13天；下游大/小额在建项目随当前窗口更新。Shift追加第二列后控制台报告DQE_CONFIG_ERROR，三张依赖表不展示半份结果；普通单列可恢复。 | query-sort.jpg |
| `http://127.0.0.1:5183/pages/table-row-expansion-query` | 展开第二张表北辰科技，默认订单C01-001开始；点击产品列后实施服务组从C01-002开始，查询成功，无第二行键请求要求。 | child-sort.jpg |
| `http://127.0.0.1:5183/pages/multi-source-table` | 初始商务130/合同120；占比升降序与整体翻页成功，第二页序号21—40，256行总数不变。 | union-sort.jpg、union-page2.jpg |

用户指定的原JSON经本批生成的独立校验器检查通过。但当前磁盘决策意见明细是一份统一query，与用户网络样本的两份查询不同，实际部署页面/构建版本仍需核对；本批不虚构业务输出字段或修改原JSON。

真实DQE、真实Relay、完整业务模型及部署尚未验收。原业务附件中的重复审批人键、合同字段为null属于另外的数据契约缺口，仍会由行身份检查报告；不能删除检查、伪造非空键或把未知次数改为0来声称页面可用。

## 复杂度

口径：TypeScript5.9.3，仓库metriccanvas-ts-ast/1，逐函数selfCC，回调独立计数。完整修改文件及新增辅助函数见complexity-before.json与complexity-after.json。

| 函数 | 前 | 后 |
| --- | ---: | ---: |
| encodedMetricItem | 13 | 11 |
| metricOrder | 新增 | 7 |
| dqeDefaultSort | 8 | 10 |
| encodeObjectQuery / defaultSort | 11 / 新增 | 11 / 2 |
| compileMember / validateRowOrder | 4 / 5 | 3 / 5 |
| compareMemberOrder | 4 | 删除 |
| memberQuery / stableRowQuery | 7 / 6 | 5 / 6 |
| childDefaultSortErrors | 10 | 2 |
| sortDqeRows / compare / scalar | 新增 | 12 / 12 / 3 |
| executeDqeItem | 9 | 13 |
| executeMultiQueryTable | 49 | 47 |
| executeQueryResultWhere | 51 | 42 |
| executeRowExpansion | 25 | 24 |
| executeTableSearchOptions | 27 | 25 |
| executeIocOpportunityList | 18 | 18 |

全部新增函数及测试回调selfCC不超过15（新增网关回归用例回调最高6）。上表仍超限的存量Sim函数保留既有字段认领/筛选/窗口校验职责，只提取本批排序；扩大重构这些合成场景会增加行为风险，本批自身CC下降或不增长。其余扫描超限函数如gatewayNormalizationError16、rowExpansionErrors21及其存量65分回调、Sim其他场景、嵌入端点listResult27/candidatesResult16未修改，列为存量，非本批新增。正文、JSON及派生产物不伪造函数测量。

## 独立检查项

ADR索引检查被基线已有的 `docs/adr/topics/page-document-structure.md` 中两条不存在的ADR-0122链接阻止；`git show c0ebb8bc:docs/adr/topics/page-document-structure.md` 可复核。不以此宣称ADR索引通过；未扩展本批修复到其他并行ADR。

最终命令、结果和分发检查回执附在本文件后续段落。截图与复杂度JSON按仓库忽略规则仅本地保留，交付清理前另存至本地证据归档，实际路径见交付回执。

## 最终检查回执

- `pnpm test packages/data-execution/tests/ packages/engine/runtime/tests/ packages/engine/data-gateway/tests/ packages/page/tests/ tools/dqe-sim/tests/ apps/playground/tests/decision-opinion-preview.test.ts tests/local-authoring-skill.test.ts tests/local-authoring-row-expansion.test.ts tests/local-authoring-tools.test.ts tests/local-authoring-upgrade.test.ts tests/page-reference.test.ts`：202文件、1846测试通过（包含最终排序别名和对象错误分类）。
- `METRICCANVAS_PYTHON=<已有venv>/bin/python pnpm authoring:check`：6文件、215测试通过，含完整仓外安装/导出隔离与漂移检查；其中5文件也在最终202文件检查中使用最后生成产物复测通过，不将重叠测试相加。
- `pnpm authoring:contracts`：1251产品、4创作、1接口产物生成；最终 `pnpm authoring:contracts:check` 通过。Python使用主工作区已有依赖环境，未把缺少fastmcp的系统Python错误当成产品失败。
- `pnpm --filter @metriccanvas/page --filter @metriccanvas/data-execution --filter @metriccanvas/dqe-sim check`：通过；`pnpm --filter playground check`：0错误、0警告；`pnpm exec tsc --noEmit -p tests/tsconfig.json`：通过。
- `pnpm build:playground`：最后源码构建通过；日志暂存 `/tmp/metriccanvas-dqe-sort-build.log`。
- 独立 `validate-page.mjs` 校验用户原JSON：ok=true，无错误。
- 原始全仓测试扩大检查发现流水报表旧拼写后已中止该过期运行，修正三处源夹具并完成最终202文件回归；不声称全仓所有测试均已通过。
- `git diff --check` 通过；源pages、合法协议夹具和Sim JSON无保存的by数组或orderByField。ADR索引的基线缺失链接仍未关闭；真实服务、CI与部署未运行。
- 实施验收时未创建提交或远端分支。用户随后授权提交和推送；交付完成后归档本任务工作树并停止其5183/18238服务，其他任务保持原状。

## 交付 CI 派生回执补齐

首次提交 cf87633ab3fa96bae2ce66883e97e41000a8ecf0 的 CI 已通过 local-authoring，MC 内容包测试30项及覆盖对账6项也通过，但 mc-content-fixtures.py --check 报 diagnostics.json 漂移。原因是本批重新生成 MC 后，三份已跟踪的诊断回执仍保留旧 contentSha256 / productManifestSha256。已用原生成器重建 diagnostics、business-report、usage-report 三份回执；页面内容与可执行代码无变化，无新函数或复杂度变化。原失败命令复测通过，并完成 MC 独立归档打包。后续 CI 结论以最终提交为准。

## 交付浏览器兼容修复

首次CI的兼容性回放有498/506通过：6项失败来自两份现有SDT页面的3个默认DESC排序在网关被误拒（每浏览器3项），另外2项来自子表格回归仍期待被移除的行键第二排序。已兼容ASC/DESC与asc/desc，发送归一为小写，未放宽非法by或多字段；子表格断言按单字段需求更新。新增4种方向回归及两份实际SDT页面的共享执行器回归（全部根查询分别15/14项，浏览器可见查询仍为14）。dqeDefaultSort按同口径8→10，新增测试回调最高6；浏览器测试仅改期望字面量，函数自身复杂度不变。文档、生成产物与MC诊断回执随本轮重建，最终远端CI单列报告。

方向大小写兼容修正后，本地最终202文件1852项回归通过；page/data-execution/embed类型检查通过（Svelte0错误0警告）；authoring:contracts:check及MC诊断回执检查通过。没有用减少查询数或放宽非法多字段来修正浏览器用例。
