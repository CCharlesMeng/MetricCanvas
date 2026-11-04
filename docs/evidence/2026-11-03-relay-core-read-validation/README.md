# S04a/b：只读、校验、升级与参数程序切片

日期：2026-11-03。会话：`01a1a118-3a20-7351-b0c4-1d45be448d49`。

## 来源与所有权

隔离工作树：`/Users/moon/.codex/worktrees/relay-read-validation/DataDashboard`，启动 fetch 后基线为 `485faa0a0f81f0e882e2ff23f1de5ec672884f88`，当前协议 6.82。主目录及首批来源工作树均未写入。源码未提交；未提交、push、CI 或部署。逐文件 allowlist 与摘要见 `source-manifest.json`；摘要用于交接源码快照，不替代发行清单。

I05a 仅定向复用首批的 `packages/page/src/authoring/data-scan.ts`、`data-scope.ts`、三个 local-authoring-data wrapper、测试及冻结向量。与最新基线相关旧源码对比无重叠产品变更；未整体携带旧生成包。只读投影 `inspectPageSchema` 定向提取自现有 `mc-content-page.ts/inspectSchema`，C 负责将原入口接回此唯一实现。

A2 的扩展范围由主控明确批准：`temporal-evaluation.ts`、`filter.ts`、`time-filter-boundary.ts`、`validate.ts`、`resolve-page-params.ts`、`extract-page-params.ts`、`apply-param-candidates.ts`、`parameter-program.ts`、`upgrade-document.ts` 及本线 authoring/资源传输模块。没有新增 PageDocument 字段。

## 可供 C 接入的真实程序

构建真源 `tools/scripts/build-authoring-page-program.ts` 导出 `authoringPageProgramOutputs(root)`，复用现有 `localValidatorOutputs` 的稳定模块 ID、依赖闭合和实际许可证收集。输出：

- `scripts/authoring-page-program.mjs`、`scripts/AUTHORING-PAGE-LICENSES.md`
- `operations.json`、`self-tests.json`、`program-info.json`、`evaluation-schema.json`

运行期只需 Node.js 22+；不需要仓库、pnpm、tsx、node_modules、构建或联网。构建期使用仓库锁定的 esbuild/TypeScript 等依赖。stdin 一份 `{operation,input}`，stdout 一份 `{status,data,diagnostics}`；ok/partial 退出 0，产品拒绝 2，环境/无法解析请求退出 3（stderr）。程序私有 `internal.evaluation.validate` 接受 `{evaluation}`，返回同一计算结果格式，直接复用 `temporalEvaluationIssue`，不进入公开 operations.json；用于非页面操作的统一语义检查；缺 evaluation 也返回 EVALUATION_CONTEXT_REQUIRED，显式 null 或非法字段返回 INVALID_EVALUATION_CONTEXT。完整正负调用见 `call-examples.json`。全局 format/requestId 信封由 C 的 facade 处理，不能从本程序输出推断 DQE/保存/发布成功。

| 操作 | 输入 | 实际产品计算/支持范围 |
|---|---|---|
| page.project | document、可选 evaluation | 原有只读 Schema/升级/组件/字段/覆盖投影，不返回查询体或行 |
| page.scan | document、可选 componentIds | 同源静态产品 Schema 扫描；完整全局诊断保留；局部范围仅为阅读闭包，不缩小校验/报告覆盖 |
| page.validate | document、可选 fileName/expectedLayout/evaluation | 实际 TS 页面校验和文件名/布局检查，保留有序原诊断 |
| page.upgrade | document、可选 target/evaluation | 同源升级算法返回完整候选；默认目标严格为构建源码 versionPolicy.current，与 C 的 defaultPageSchema 必须相等 |
| page.parameters | action=extract/prepare/resolve、document、其原有显式完整上下文、可选 evaluation | 同源参数提取、选取与实例化；保留原值，未查询、未保存、未证明授权 |

`OPERATIONS` 与 `EVALUATION_SCHEMA` 的唯一作者源为 `packages/page/src/authoring/product-contract.ts`。outputSchema 约束 ok/partial 的 data，参数三种成功结果用 oneOf 描述；error 以完整业务诊断为准，不套成功结果 Schema。核心 `scanPageData(document,schema)` 仍接收显式 Schema；公开 page.scan 不允许模型替换产品协议。

Python 资源接缝：

```python
NodeValidationResources(program: Path, sha256: str, schema_version: str,
                        evaluation: dict[str, str] | None = None)
validate_page_document(value, *, schema=None, node_resources=None)
normalize_page_document(value, *, schema=None, node_resources=None)
prepare_parameter_request(document, context, selected_ids=None,
                          text_replacements=None, *, schema=None, node_resources=None)
accept_parameter_result(document, context, result, selected_ids=None,
                        *, schema=None, node_resources=None)
```

path/hash/schemaVersion 仅由程序从校验后的本地发行资源注入。提供 node_resources 时统一调用实际预构建 Node 产品规则，避免依赖旧 Python 特征表；未提供时保留旧调用路径。Python 导入不再提前定位 Bundle。参数异步旧包装保留，纯请求准备/结果核对不触发它的 program Port。C 单一维护 runtime_assets/发行注册/全局生成，本线未修改。

## A2：显式评估时间与业务时区

`input.evaluation={instant,timeZone}` 不进入 PageDocument；Relay 程序按一轮冻结并供给，不让模型覆盖，也不以 asOf/筛选期间替代。instant 接受有明确 Z/偏移的有效 ISO 日历时间（秒精度，可选 1–3 位毫秒）；timeZone 为可用 IANA 命名区。纯偏移 zone、非法日期/时间、无偏移 instant、未知字段均拒绝。格式 Schema 为单点真源，实际合法性由 `temporalEvaluationIssue` 判定。

产品 validate/project/upgrade 遇到开启未来禁止且有默认值的 timePoint 时需要 evaluation；parameters prepare/resolve 遇到未来禁止未显式关闭的时间筛选时需要 evaluation（保守完整上下文要求）。extract 中实际受当前时钟约束的 timePoint 同样要求。缺上下文为 `EVALUATION_CONTEXT_REQUIRED`，非法为 `INVALID_EVALUATION_CONTEXT`。非时间请求无需新增必填；scan 无时钟求值。

`evaluationTimeValue` 用显式 IANA 时区的 Gregorian `Intl.DateTimeFormat` calendar parts；向 parse/invariant/rowExpansion/filter、normalize/upgrade/inspect、extract/apply/resolve/materialize 透传。显式上下文路径不读取机器当前时间或默认时区。旧渲染调用省略 evaluation 时保留已有 now/Date 行为；没有替换全局 Date 或 TZ。

## 实际检查

- 新切片 Vitest：`tests/authoring-data-core.test.ts`、`tests/authoring-page-product.test.ts`、`tests/authoring-temporal-evaluation.test.ts`。共 30 项（I05a 8 项与产品程序 22 项）；冻结 I05a 8 向量；仓外 stdin 程序与直接核心全量结果对比、完整有序诊断、原值/输入不变、Node 禁网钩子、输出 Schema、双次字节一致、参数完整共享向量。
- A2 17 项测试：在 UTC、Pacific/Honolulu、Asia/Tokyo 三个独立进程 TZ 下比较完整输出，覆盖同 instant 不同业务区、跨日/月/年、闰日/DST、未来禁止/允许、extract/prepare/resolve、upgrade/project、缺失/非法上下文。一个多次启动进程的测试初次超过 Vitest 默认 5 秒，明确设置该项 20 秒后通过；未改业务断言。
- 旧受影响回归：time-point-no-future、time-point-min、resolve-page-params、extract-page-params、tokens-parameter-roundtrip、period-filter、relative-time、local-authoring-upgrade，8 文件 164 项全部通过。
- 锁定 Python：新增 `test_authoring_explicit_resources.py` 7 项通过；旧 `test_parameter_preparation.py` 5 项通过。新资源测试覆盖显式 Schema/Node 路径不查 Bundle、仓外 cwd、资源摘要/版本拒绝、有序诊断/输入不变和专用评估错误。
- `tsc --noEmit -p packages/page` 通过。`tsc --noEmit -p tests/tsconfig.json` 未通过：644 行输出，存在其他工作区依赖/构建缺失（例如 @metriccanvas/engine、@vitejs/plugin-basic-ssl）；无本线新增测试/authoring 源码命中。不得当作全仓类型检查通过。
- `check-authoring-complexity.py` 固定 Radon 6.0.1 门禁 372 函数、最大 15、无超限。

扩大执行旧 `test_page_validation.py`：14 项测试，75 个失败子项、18 个错误，未计为通过。用 `git show 485faa0:.../page_validation.py` 独立临时模块对照三类代表，完整结果相同：pagedUnion 合法页被旧 Python 拒绝、query-modes 页 KeyError('body')、layout 向量期望 6.80 而基线与当前均规范化 6.82，见 `legacy-baseline-comparison.json`。没有宣称逐个复现全部 93 项，也没有扩大修复这些旧预检语义。显式资源新路径使用真实 Node，在对应 pagedUnion 反证向量中与产品完全一致。

## 复杂度

TypeScript：`metriccanvas-ts-ast/1`，TypeScript 5.9.3，自身 CC（包含闭包/回调独立测量）。Python：Radon 6.0.1，记录方法一致。原始 before/after JSON 同目录，最终范围以 complexity-final-ts.json / complexity-final-python.json 为准。

| 修改函数 | 前 → 后 |
|---|---:|
| validateTimePointValue | 14 → 13 |
| currentTimeValue | 3 → 5 |
| timeFilterBoundaryError | 25 → 12 |
| materializePageParams | 27 → 11 |
| parsePage | 23 → 23 |
| resolvePageParams | 35 → 35 |
| invariantErrors / filterDeclarationErrors | 15 → 15 / 5 → 5 |
| normalizePageDocument / extractPageParams / applyPageParamSelection | 5 → 5 / 3 → 3 / 1 → 1 |
| applyParameterCandidates / runPageParameterProgram / upgradePageDocument | 10 → 10 / 8 → 8 / 13 → 13 |
| Python prepare_page_parameters | 20 → 1 |
| Python validate_with_node | 13 → 11 |

新 TS/Python 辅助函数及测试回调均 ≤15；`futureRangeError=14`、`initializeTimeFilters=9`、`initializeTimeFilter=9`。parsePage/resolvePageParams 本次仅透传可选上下文，分支不增加，避免顺手扩大结构/参数原子应用改写，保留为后续职责重构入口。未改的 parseCalendarValue=22、changedParamSourceIds=16、旧 checkAnalysis 回调=19 属存量，不宣称关闭。

## 集成与未验层级

本线提供可审阅代码、源清单、构建入口和行为证据；A2 非时间与时间的源码关口均有定向测试。C 的四项导出/发行矩阵及主控最终引擎对账、统一生成、local 独立安装、Playground 浏览器、功能文档/Skill 同源同步、完整兼容回放仍由集成阶段完成，不能从本线静态/源码测试推断通过。建议复用真实页面 `time-point-no-future`、`period-filter-parameter-page`、参数 extraction 完整向量及 local-authoring scoped-data 示例验收相关链路。未修改当前主目录和正式生成锁，未执行真实 Relay/Java/DQE、真实模型、CI、部署。本线未发行 embed；最终 runtime/embed 构建与分发体积/浏览器门禁仍待主控集成。

完整产品首版不因此自动关闭：更广报告关联/数据侧/compose/edit 由对应线及主控协调；本线5操作不承诺未知在线能力或授权/保存语义。首次环境准备和普通四项替换的仓外整体证明由 C 汇总。
