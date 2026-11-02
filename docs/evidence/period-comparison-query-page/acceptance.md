# 同比环比按当前页补查：本地验收

日期：2026-10-30。实施基线 `e6a7cc8d5`（刷新origin/main后快进，含零总数兼容修复），工作树 `codex/period-comparison`。Schema **6.78**、local-authoring **1.15.0**。当时尚未提交、推送或运行远端CI；后续 main 交付复验见 [交付记录](delivery.md)。真实DQE、Relay与DS模型未验。

## 结果和入口

已实现：主查询后端选页，按本页业务键补查上期和去年同期，再由统一受控计算阶段生成增长率和百分点。主查询持有行域、顺序和totalCount；补查保留业务条件、仅按本页键约束，不接收当期表头销售额阈值或上游offset。复用pagedJoin、SourceProgram、QueryRunner与导出路径，无新网关协议、端点或组件查询器。

- 演示：[按页补查](http://127.0.0.1:5197/pages/period-comparison-query-page)。`?state=large` 为十万对象，`?state=error|retry|duplicate|truncated` 为异常场景。
- 页面真源：`pages/capabilities/data/period-comparison/period-comparison-query-page.json`；完整操作步骤在同目录README。
- 合成数据和请求记录：`apps/playground/fixtures/query-comparison-gateway.ts`。2023-10至2026-10每月28日的合成观测；可信统计截止2026-10-28。
- 浏览器脚本：`apps/playground/tests/period-comparison-query-page-browser.mjs`，直接读取同一页面并通过专属网关事件记录请求。
- 旧完整集合示例 `/pages/period-comparison-demo` 保留并已浏览器回归，可继续展示历史对象并集、计算列全局排序筛选。

## 协议与架构追溯

| 需求 | Schema / 产品文档 | 实施位置与验收 |
|---|---|---|
| 当前页对象补查比较期 | `periodComparison`开放到无records的查询分页组合，三期同筛选同fact、当期选页；queries-and-bindings与data-sources正文 | SourceProgram冻结事实上下文，plan/member-query/candidates消费；十万总数仅3次本页请求 |
| 关联后逐行计算 | pagedJoin数据源同层compute，仅delta/ratio；compute正文、ADR-0127 | 投影输入与最终计算分别校验，统一applyComputation，只执行一次且保留总数/顺序 |
| 缺记录与空值 | projection.onMissing:"null"|"zero"，省略取空，仅数值度量可补零 | rows按记录是否存在选择补值；明确null、0/0、负基期、空率、失败及截断测试 |
| 翻页、取消、刷新 | 查询分页与可信统计事实沿用现有契约 | 迟到旧页不覆盖新页，事实变化重查，完整导出冻结事实；无证明的比较initial不复用或采集 |
| 合法表格操作与完整导出 | 当前原始列后端操作，计算列只展示；table正文 | 非法计算列排序/筛选/候选预检拒绝；逐页导出23对象、Excel数值和P格式核对 |
| 作者可使用 | PAGE-METADATA、reference-map、Skill工作流与官方生成投影 | 知识、示例、独立校验器、版本/哈希与MC同步；仓外独立安装验证 |

## 检查结果

| 层级 | 实际执行与结果 |
|---|---|
| 核心协议/执行/运行时/UI回归 | `pnpm test packages/page/tests packages/data-execution/tests packages/engine/runtime/tests packages/engine/runtime-ui/tests tests/public-api.test.ts`：247个核心文件通过，2052项核心测试通过；首次唯一失败为新增内部导出未更新公共面快照，按正式流程更新后公共面8项通过 |
| 新增业务范围与候选读取 | `pnpm exec vitest run packages/data-execution/tests/period-comparison-query-page.test.ts`最终13项通过，覆盖额外增加的固定产品/销售区域谓词保留与可信截止事实下的候选查询；与核心组有重叠，不直接累加 |
| 迟到与取消 | runtime专项3项通过；早期断言误将10行窗口当成1行数组匹配已修正，最后完整核心组也通过 |
| 类型 | page、data-execution、engine、playground及tests/tsconfig检查通过；两组Svelte均0错误0警告。测试中只读事实赋值改为替换整个periods快照后data-execution类型复测通过 |
| 页面静态 | `pnpm validate pages/capabilities/data/period-comparison`：2页面通过、0失败 |
| 浏览器 | 新脚本通过：3次有界首屏请求、本页键补查、第二/末页、当期数值筛选范围、四种期间、完整导出、十万总数、失败和重试；无pageerror。旧脚本全项通过 |
| 视觉 | 实际检查1500px与960px截图；960px下document.scrollWidth=clientWidth=960，无整页横向溢出。正常与持续失败告警均已查看 |
| 公共面 | `UPDATE_PUBLIC_API=1 pnpm exec vitest run tests/public-api.test.ts`：8项通过，新增跨包使用的内部辅助仅projectionFields/hasComparison，未暴露页面专属校验辅助 |
| 官方生成与MC | `pnpm authoring:contracts`导出1319个产品、4个创作、1个接口文件；最终`pnpm mc:content:check`通过：契约一致、源覆盖、33项Python及诊断夹具。首次检查与重新生成并发造成临时文件缺失，固定产物后全链路复测通过 |
| 独立Skill | `standalone-validation.json`：完整实体复制到仓外，Node独立校验新页/旧页均无错误，6.77声明新能力被拒绝，知识主题10054字节且读取成功 |
| 作者工具全组 | `pnpm authoring:check`运行1554.39秒结束：其余5个文件全部通过，整组227项通过、1项失败。唯一失败为修复前知识主题26286字节超出16384预算；已聚焦新增compute/projection根节点并移除自动合并基础主题，完整语义保留，现为10054字节。修复后`tests/local-authoring-tools.test.ts`全部32项通过；未放宽预算。原全组命令退出1不记作整组绿，其他分发/导出隔离用例均已完成，无剩余失败项 |
| 差异检查 | `git diff --check`通过；全部检查日志在checks/，未把本地通过作为真实服务或CI结果 |

## 可观察数值与范围

默认23对象、每页10条，第三页3条；C000023当期560、上期320、去年同期256，增长率75%/118.75%，百分点+10/+20。按客户升序后C000001为120/100/80，增长率20%/50%。C000004缺历史记录补0，C000005已返回null保持空，C000006负基期按原公式计算；完整导出24行含表头，共23对象，单元格仍为数值并带百分比/百分点格式。

十万对象首屏仍为1次主查询和2次本页键补查。pageSize10/batchSize3时主查询仍只读一页，补查分4批/期，不扫描下一业务页。空主窗口不发补查，补查缺记录、失败、重复键、截断分别验证；执行失败不会进入完整恢复扫描。

截图：[首屏](first-page.png)、[第二页](second-page.png)、[十万对象](large-domain.png)、[失败](error.png)、[960px](narrow.png)。Excel与额外运行产物在 `/tmp/period-comparison-query-page-browser/`。

## 复杂度

测量工具 `metriccanvas-ts-ast/1`、TypeScript5.9.3；同一工具比较基线HEAD与当前全部26个手写新增/修改TS、JS、MJS及Svelte脚本文件，逐个包含嵌套回调。Svelte模板不计入TS测量，由svelte-check和浏览器验收。

| 函数 | 前→后 selfCC |
|---|---|
| periodComparisonErrors | 12→12 |
| validateBinding | 14→14（同文件存量，逻辑未改） |
| projectionErrors | 15→15 |
| compilePagedJoin | 12→12 |
| projectRows | 2→2 |
| runPageQuery | 7→7 |
| evaluateRows | 9→9 |
| SourceProgram/read/captureJoinedResult | 10→12 |
| createTableController/computedFailureBinding | 2→4 |

全部新增辅助及回调selfCC≤15，扫描未发现本批文件中的超限函数；完整前后函数记录见 [complexity.json](complexity.json)。无本批未关闭复杂度项，不据此宣称全仓复杂度已清零。

## 边界

本模式的行域、顺序和总数属于主查询；历史独有对象不会由补查自动扩域。计算列不提供全局排序筛选或候选；需要时显式选择原完整模式，或接入能按计算结果选页的后端查询。首版沿用单个非空string/number稳定业务键、每键一行，无records或复合键扩展。

浏览只读当前页及其补列，每次比较查询60秒超时；每页/补查批次沿用最大1000。完整导出逐页完成，沿用10000行/60秒总预算；错误、总数变化、重复或不完整窗口不给部分文件。可信统计截止事实统一比较范围，不意味着后端多次请求有事务快照。

真实服务仍须验证业务指标名、时间聚合、同一业务粒度、键谓词、权限、稳定排序和准确总数。此记录的请求与数据均为合成/本地，不代表真实DQE、Relay或DS模型验收。
