# 组合表格异常兼容：本地实施与验收

2026-10-29。基线 `d24a417210041a3c057e06dd0012e07d0bcc6c76`，独立工作树 `table-result-tolerance`。用户确认页面与导出均允许缺项，并明确标注 warning。主工作区的并行修改保持不变。实施证据记录初始基线；下方补充 main 集成验证，线上部署未运行。

## 行为与边界

正常 `pagedUnion`、`pagedJoin` 和 records 继续使用已有执行路径。可恢复的字段/行形状、身份、窗口、总数与排序异常触发有界完整整理：补空单元格、无效身份跳行、同一来源重复身份留首条、补充范围外编码忽略。records 的多条不同记录不因关联键相同而被合并；跨来源同内容不去重。原始窗口长度推进 offset，然后才整理；全局过滤、排序、计数及分页在整理后执行。

权限、配置、网络、取消、超时与资源拒绝保持失败；不创建假的业务键或零值。行数、字节、扫描与完整文件预算保持有界。警告结果不采集为可信组合 initial；刷新后的正常数据恢复快速路径及正常 initial。

表格显示可展开的来源 warning；Excel 数据表包含全部可用匹配行，并附“数据异常说明”工作表，说明缺项及处理方式。正常文件不添加说明表。主子表导出合并子数据时保留警告。诊断只含来源、分类、处理文字及次数，不回显业务值。

本轮不增加页面元数据字段，Schema 保持6.73；内部生效查询 resultPolicy 不发送到 DQE。页面声明、inline 与持久化 initial 结构仍严格。此裁决局部修订 ADR-0108/0121 的结果异常整轮失败约定及 ADR-0120 的组合内部结构失配边界；当前专题已显式说明。

## 功能对应

| 能力 | 真源与可观察入口 | 同步内容 |
|---|---|---|
| 查询结果兼容、跨源合并及关联 | `packages/data-execution/src/table-recovery/`；`packages/page/src/display-query-rows.ts` | 数据源文档的“组合表格异常兼容” |
| 页面 warning 与 Excel 说明 | `TableWarnings.svelte`、`table/warnings.ts`、`table/export/workbook.ts` | Table 文档的“组合源数据异常提示与导出” |
| 合成完整页面 | `pages/capabilities/table/table-data-recovery.json`；`/pages/table-data-recovery` | pages 表格 README 与协议概览 |
| 可独立查阅的创作知识 | local-authoring 1.10.0；`data.recovery`、`table.export` | 官方生成的契约、MC、知识、校验器及锁文件 |

合成数据在 `apps/playground/fixtures/table-recovery.ts`，基础种子来自 `decision-opinion/model.ts` 与 `rejection-details/gateway.ts`。启动 `pnpm --filter playground dev --host 127.0.0.1 --port 5198 --strictPort`；入口 `http://127.0.0.1:5198/pages/table-data-recovery`。`?recoveryState=ready` 模拟数据准备好后刷新。

## 实际验证

- 最小回归先运行6项全部失败，出现用户描述的“整表报错”；改动后通过，并增加跨200行批次去重、页/导出一致、刷新及取消用例。
- `pnpm exec vitest run packages/data-execution/tests packages/page/tests packages/engine/runtime/tests packages/engine/runtime-ui/tests packages/engine/widgets/tests`：261个文件、2196项通过。
- `pnpm exec tsc --noEmit -p tests/tsconfig.json`、引擎及Playground check：通过；两个Svelte检查均0错误、0警告。
- 新完整页面独立 validate-page：通过；公开面8项门禁通过，仅增加内部 DataWarning 类型及 normalizeDisplayQueryRows。
- `node apps/playground/tests/table-data-recovery-browser.mjs`：通过；合并表6条、记录关联8条，可用分页正常；实际两份Excel下载回读均附异常说明；ready状态恢复8/8并清除warning；390px窄屏页面与表格可见，无未捕获页面错误。
- 既有 `paged-join-diagnostics.browser.ts`：5项通过；null/重复/截断可恢复，资源预算仍失败。组合键与UUID两个浏览器脚本也通过，正常交互/完整Excel/异常处理保持可观察。
- 浏览器截图、下载文件与机器结果在本目录 `browser/`、`composite-browser/`、`uuid-browser/`。截图已实际检查；这些是合成/本地证据，不代表真实DQE、Relay或真实模型验收。
- `authoring:contracts:check`：1293 product、4 authoring、1 interface 输出一致；MC source coverage、33项MC测试与可见诊断夹具检查全部通过。
- local-authoring 定向5个文件、193项通过，覆盖知识预算、链接/哈希闭合、独立安装、页面契约向量、升级及参考手册。另在仓外完整复制Skill，只用Node验证版本、新页面、data.recovery主题和非法页面拒绝，回执为 standalone.json；全局安装未变动。
- 初次聚合authoring检查曾触发主题预算失败；修复后按仓库默认验收范围收口local-authoring。包含历史Bundle场景的宽泛隔离回归未作为本轮完成条件，未运行真实DS。

生成校验首次发现新语义标题需登记，以及16384字节主题预算超限；已登记标题并将完整容错规则独立为 `data.recovery`，未放宽预算或截断语义。MC主题数变化的可见诊断夹具由官方 mc-content-fixtures.py 重生成。

## 复杂度实测

使用仓内 `metriccanvas-ts-ast/1`、TypeScript5.9.3，自身CC逐函数计数、排除嵌套函数；闭包/回调单独扫描。Svelte只抽取script测量，新增提示模板的条件和列表单独核对，未将模板当TS解析。全量前后数据在 [complexity.json](complexity.json)。

| 函数或范围 | 前 | 后 |
|---|---:|---:|
| 页面路由 loadPage | 13 | 5 |
| 新 previewDataGateway | — | 11 |
| executeQuery | 6 | 8 |
| normalizeRows | 4 | 5 |
| 新 resultTotal | — | 5 |
| captureUnionInitial / captureJoinedResult | 6 / 9 | 7 / 10 |
| writeTableSheet | 6 | 7 |
| 新 writeWarningSheet | — | 3 |
| collectChildren | 5 | 5 |
| 新规范化、整理、提示、测试及辅助函数 | — | 均≤13 |
| computedSnapshots 内 visit | 27 | 27 |

未关闭项：修改的存量visit只携带warnings，不增加分支；重构整个递归计算图会扩大本次行为风险，保留27→27，后续入口为 `packages/data-execution/src/compute/snapshots.ts`。同文件扫描的 gatewayNormalizationError 为16→16，本轮未修改。其余新增和修改函数均未超过15；没有以外层工厂分数代替回调测量。

## main 交付集成验证

交付前远端 main 前进至 `60c2a93558d064f34e433162fea1ee37f854bf1e`，包含组织并集 `unionKeys`、Schema6.74 和 local-authoring1.10.0。重放本批代码时保留该计算完整性与 Playground 入口，warning 传播合入上游拆分后的 evaluateRows，未回退上游重构。新示例使用当前 Schema6.74；local-authoring 本批升至1.11.0，所有派生物从合并后的真源重生成。上述6.73/1.10.0与visit27→27为初始实施时间点，非最终交付状态。

合并后产品回归264文件、2224项通过。引擎、Playground及测试类型检查通过；Svelte两项均0错误0警告。真实浏览器重放恢复、分页、两份含警告的Excel、健康刷新及窄屏全部通过（复测输出位于临时目录，原始合成证据仍随本目录保存）。

同工具/口径对比最新main：pageExternalInputs14→15，scenarioEnvironment11→12，loadPage14→6、新previewDataGateway11；computedSnapshots.visit5→5、evaluateRows9→9。全部回调与辅助函数实测见 delivery-complexity.json，本次冲突整合没有新增超限项；原visit存量超限已由上游重构关闭。

合并后local-authoring五项定向测试与公开面共6文件、202项通过；契约1295 product/4 authoring/1 interface输出、MC覆盖、33项MC测试及可见诊断夹具检查通过。最终远端SHA与CI结论由交付回执报告，初始checks.json中的未提交/CI未运行只描述实施验收时间点。
