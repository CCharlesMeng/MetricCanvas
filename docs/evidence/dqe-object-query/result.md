# DQE object 查询实施与本地验收

2026-10-23。本仓实现与本地验收完成，真实 DQE/Relay 接入未验收；以下为初始基线上的本地验收记录；用户随后已授权提交并 push main，合并基线后的验证见交付记录。实现位于独立工作树 `/Users/moon/.codex/worktrees/dqe-object-query/DataDashboard`，分支 `codex/dqe-object-query`，基线 `ea40f664`。主工作区并行改动未纳入。

## 实现范围

页面协议 6.55（合并 main 后顺延；初始本地验收使用6.52）：`query_type:object`、`object_type/output_fields/filter.fields`；显式字段契约，既有 `language:dqe`、页面数据源单项查询及网关内部批量传输不变。对象与指标查询共用执行状态、窗口/完整范围、参数、模式查询、搜索/表头条件、结果绑定、计算、关联及组件。对象类型的协议差异留在公共查询解析和网关编码。

显式绑定接管字段默认条件，清空可选筛选不恢复原默认；其他固定条件保持。对象日期声明字段和格式，支持月份边界、窗口、固定参数和旧绑定显式迁移。保留重复业务编号记录；集合绑定才去重。完整结果中的失败、变化总数或超出总数不降级成部分对象结果；组合查询含对象成员时同样阻止部分完整导出。普通指标查询的兼容规则不收紧。

单字段排序使用已提供的 `order_by_field/type`；多字段排序经可信 `encodeObjectSort` 接入。文本包含搜索和列候选继续使用已有可信网关接缝，未配置明确失败，不从当前页造候选。没有真实记录标识时，不从相同投影行推断重复分页或删除重复行。

## 场景、文档、分发映射

| 能力 | 页面/测试 | 文档与分发 |
|---|---|---|
| 对象字段、日期、金额、分页排序、搜索 | `/pages/dqe-object-query-demo`，page/data-execution 的 `dqe-object-query.test.ts` | `queries-and-bindings.md` 的6.55章节、PAGE-METADATA、PAGE-PARAMETERS；独立 validator/知识生成 |
| 完整导出、保留重复编号、差额和指标关联 | 同页完整表；`export.json`、`complete-export.xlsx` | 同章节完整范围和容量边界；local-authoring 示例 `object-query-page` |
| 窗口对象→指标、指标→完整对象 | 同页后两表；共享执行测试 | 现有查询结果绑定规则，1000个去重值上限 |
| 组合源、固定键交集、截断成员补取 | `dqe-object-join.test.ts` | 既有 pagedJoin 语义；对象成员复用共享完整范围读取 |
| 子表排序、参数/迁移/模式一致性 | 对象行为测试及原子表/参数/模式回归 | 对象时间目标、受控引用、可信多字段排序接缝 |

完整页面和README位于 `pages/capabilities/query/`；协议夹具为 `packages/page/fixtures/contract-valid/object-query-page.json`。知识、独立校验器、Schema、反例、示例、哈希及清单由 `pnpm authoring:contracts` 生成，未手改分发副本。

## 已执行验收

- `pnpm exec vitest run packages/page/tests packages/data-execution/tests packages/engine/runtime/tests tools/dqe-sim/tests apps/playground/tests`：184文件、1471项通过，见 `regression.log`。
- `pnpm authoring:check`：4文件、73项通过，含仓外复制、独立校验和生成隔离，见 `local-authoring.log`。
- `pnpm check`：通过；UI、engine、platform、playground 的 Svelte 检查均0错误0警告，见 `typecheck.log`。
- `pnpm build:packages`、`pnpm build:playground`：通过，见对应构建日志。
- `pnpm packages:check`：六个交付物通过，见 `package-check.log`。
- `pnpm authoring:contracts:check`：1104个产品、4个authoring、1个interface产物一致，见 `contracts-check.log`。
- `tests/public-api.test.ts`：新增内部查询辅助导出同步快照后8项通过，见 `public-api.log`。
- `git diff --check`：通过。

实际浏览器为 Codex IAB，服务来自本工作树：Playground `127.0.0.1:5175`，DQE Sim `18329`。通过HTTP执行仿真查询，未拦截网络伪造页面结果。步骤记录在 `browser.json`，图片 `initial.png`、`filtered.png`：翻页R006–R010；金额降序R024开头；等值B003得到R005/R006；未知编号空态；日期改为二月得到R025–R028；商务回写及URL恢复B013得到两行；二月金额下限2700得到R027/R028。

完整Excel实下载后用ExcelJS独立读取：24条记录、12个商务编号、金额合计30000、差额合计7500。见 `export.json`。页面所有数据均为合成数据，隐藏商务筛选显式列举14个合成编号作为可信候选，不能据此声称真实对象候选接口已连通。

## 复杂度

口径：仓内 `metriccanvas-ts-ast/1`，TypeScript 5.9.3，逐函数 `selfCC`，闭包、回调独立计量，不以工厂累计分代替自身。基线在 `complexity-before*.json`，全量修改文件及新增函数在 `complexity-after.json`。所有新增函数/回调均≤15。

| 修改职责/函数 | 前 | 后 |
|---|---:|---:|
| encodedDqeItem 分派 | 13 | 2 |
| extracted encodedMetricItem | 新拆出 | 13 |
| composeEffectiveQuery | 10 | 10 |
| restrictKeys | 12 | 9 |
| stableRowQuery | 17 | 6 |
| queryContractErrors | 9 | 10 |
| queryParamReferenceErrors | 30 | 25 |
| migrateParamBindings | 43 | 41 |
| 子表检查回调（rowExpansionErrors 内） | 72 | 65 |
| rowExpansionErrors 外层 | 21 | 21 |
| checkOrdinaryRange | 13 | 14 |
| fetchComplete | 13 | 13 |
| executePagedJoin | 16 | 16 |
| exportPagedJoin | 21 | 21 |

未关闭：参数引用外层25、迁移外层41、子表外层21/原回调65、组合执行16/导出21仍超限。本批拆出了对象与默认排序/窗口职责并保持其余调度、错误顺序和兼容行为；不扩大到整套存量编排重构。后续入口为 `docs/plan/2026-10-22-code-complexity.md`。扫描还列出未修改职责的 parsePage31、gatewayNormalizationError16及旧Sim分支，这些不作为本批修改函数冒充已治理。

## 尚未验收的真实接入

用户回执只证明当前响应形状兼容：请求1000行但返回10行、内部limit10/offset-1、total_count1393的原因未核实。本轮未调用真实 DQE/Relay；真实分页、稳定排序/记录标识、操作符、多值列表语义、计数、日期精度/时区、文本搜索及候选查询均需真实环境复验。缺少可信多字段排序编码时，子表稳定补排序或组合选页涉及多字段排序会明确失败；不能将本地注入的合成适配当作真实支持。
