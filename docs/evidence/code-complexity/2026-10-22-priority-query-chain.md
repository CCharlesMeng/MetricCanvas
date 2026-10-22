# 高优先级查询链路：复杂度续修

日期：2026-10-22。用户要求从剩余清单挑选高优先级项实施。本批固定修改 4 个源码文件、6 个超限函数；从当前工作区保存源码及行为基线后实施；已核对这 4 个源码文件的本批前内容均与 HEAD `952b3a273f0f4f8be5820f5af1bb76c2f5afa513` 相同，依赖沿用当前工作区。口径为 `metriccanvas-ts-ast/1`、TypeScript 5.9.3，每个闭包与辅助函数单独测量。

## 选择理由与完成范围

这些函数是页面声明进入查询执行、分页组合及导出的边界。错误会影响下游条件、结果完整性及导出内容，因此本批优先于开发工具、文档生成器及 DQE Sim 的高分函数。纯内部职责拆分，公开接口、Schema、业务语义保持，没有新建协议或视觉方案。

| 函数 | 本批前自身 CC | 本批后自身 CC |
|---|---:|---:|
| [queryResultBindingErrors](../../../packages/page/src/validate-query-results.ts#L11) | 38 | 9 |
| [resolveQueryResultInputs](../../../packages/data-execution/src/query-result-inputs.ts#L18) | 33 | 11 |
| [reusableInitialSnapshot](../../../packages/data-execution/src/source-program/range-policy.ts#L12) | 16 | 13 |
| [checkOrdinaryRange](../../../packages/data-execution/src/source-program/range-policy.ts#L22) | 17 | 13 |
| [fetchComplete](../../../packages/data-execution/src/source-program/range-policy.ts#L54) | 37 | 13 |
| [memberRows](../../../packages/data-execution/src/paged-join/rows.ts#L7) | 26 | 10 |

| 涉及源码文件 | 全部函数的当前最大自身 CC |
|---|---:|
| [packages/page/src/validate-query-results.ts](../../../packages/page/src/validate-query-results.ts) | 12 |
| [packages/data-execution/src/query-result-inputs.ts](../../../packages/data-execution/src/query-result-inputs.ts) | 11 |
| [packages/data-execution/src/source-program/range-policy.ts](../../../packages/data-execution/src/source-program/range-policy.ts) | 13 |
| [packages/data-execution/src/paged-join/rows.ts](../../../packages/data-execution/src/paged-join/rows.ts) | 13 |

测试文件中的全部函数及回调最大自身 CC 为 4。当前原清单的 146 个现存文件中，超限函数由 88 降为 82，分布于 66 个文件。原 259 条当前为：62 条自身超限、17 条仅内部函数超限、136 条当前范围达标、44 条无法定位。达标包括原本达标项；漂移项仍待核，完整对照见[全清单](2026-10-22-original-list-follow-up.md)。

## 拆分与行为保持

- 结果绑定校验：分离已有维度目标收集、上游原始字段与结果范围校验；依赖环遍历仍由原入口维护，保留原始字段错误、范围错误、有限结果计算错误、where 错误、重复目标错误及环错误的顺序。
- 查询结果输入：按绑定选择行、检查原始字段值、去重与稳定排序；入口仍遍历全部绑定并聚合状态，最后一个错误优先于空结果，空结果优先于等待。即使行值也不合法，集合上限错误仍按原逻辑覆盖行值错误。未提前返回整个查询，未修改上游快照。
- 范围与快照：将视图变化判定及总数不一致判定具名，保留 totalCount 非法与请求超限的错误分类；普通查询的合法但不一致总数继续只告警并保留返回行。
- 完整导出：分离冻结请求窗口、总数契约、分页块契约及完整性要求；循环继续持有累计行、offset 和 expected。两个取消检查与 runner.run 的 await 位置保持；无新增异步包装。保留先探测再分页、后续失败时可选部分导出、超报总数时告警并停止继续取数、10000 行限制及诊断字段。
- 分页组合成员行：将完整/窗口范围校验及行键契约具名；先检查范围，再检查字段契约，最后检查键类型、重复键和未请求键，保留错误路径的先后及 Map 顺序。

## 行为证据

固定重构前后版本进行差分，比较返回值/异常的名称、代码及消息，并验证输入不变性；导出还比较请求序列、诊断参数、scope、signal 传递、告警全文、来源描述调用和微任务事件顺序：

| 范围 | 比较组数 |
|---|---:|
| 结果绑定完整有序错误列表 | 512 |
| 查询结果输入与多绑定状态优先级 | 2514 |
| 普通查询范围、告警与原快照返回 | 720 |
| 初始快照复用与视图差异 | 168 |
| 分页组合成员行、键及窗口 | 2592 |
| 完整导出、部分失败及取消 | 2304 |
| 合计 | 8810 |

永久回归新增 9 项：[有序错误列表](../../../packages/page/tests/query-result-binding-parity.test.ts) 固定重构前的 9 条同时违规诊断与输入不变性；[输入与导出边界](../../../packages/data-execution/tests/query-input-boundaries.test.ts) 覆盖错误/空/等待优先级、后项错误覆盖、集合上限与无效行冲突、允许/拒绝部分导出及响应后取消。错误夹具由重构前固定版本生成。

## 检查结果

- `pnpm check` 通过：全仓类型检查及 Svelte 检查无错误或警告。
- `pnpm test`：258 个测试文件通过；2,267 项通过、1 项跳过，共 2,268 项。跳过项是已有 `apps/platform/tests/data-gateway-online.test.ts` 的本地 `127.0.0.1:18228` DQE Sim 健康探测；测试在探测不可达时明确调用 skip，没有把该项算作通过。新增 9 项全部通过。
- `pnpm build` 通过：五个核心包、Embed 和 Platform 构建完成；Platform 仍有已有的大 chunk 提示。
- `pnpm authoring:contracts:check` 通过；隔离快照中从产品真源正式生成并回填 11 个派生文件，包含独立校验器、参考源码摘要、知识清单及分发锁；作者维护的 Skill 正文与既有文档保持。`check_bundle.py` 通过 2,718 个摘要检查。全量测试包含 local-authoring 仓外安装/校验及导出隔离检查。
- Chrome 浏览器：`MC_EMBED_EXAMPLE_PORT=4198 pnpm --filter @metriccanvas/embed exec playwright test paged-join.spec.ts query-result-where.spec.ts`，3 项全部通过。独立测试服务在 `/examples/inline.html` 挂载现有完整页面夹具和本地数据网关，覆盖上游全量行保持、下游独立过滤、全局排序、跨源范围筛选、分页、固定业务排名与显示序号、搜索及完整 Excel 下载。
- 浏览器分别使用现有 `pages/capabilities/table/multi-query-table.json` 与 `packages/page/fixtures/contract-valid/query-result-where-page.json` 的配置；截图位于 `packages/embed/test-results/` 下的 `paged-join-global-sort.png`、`paged-join-fixed-rank.png` 和 `query-result-where.png`。没有新增协议能力或修改页面呈现，因此没有虚构新 Playground 能力示例。
- 最后复测 4 个源码文件及 2 个测试文件的所有函数：源码最大自身 CC 13，测试最大 4；修改文件 `git diff --check` 通过。

未提交或 push，未运行远端 CI 或外部 CodeCheck 复扫；浏览器使用本地数据网关夹具，不代表真实 DQE、Relay、Java 或生产验收。
