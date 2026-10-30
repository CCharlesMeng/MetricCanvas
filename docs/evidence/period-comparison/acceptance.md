# 表格同比环比本地验收

日期：2026-10-29。基线：origin/main `d24a41721`。本批在独立工作树 `period-comparison/DataDashboard` 实施，未提交、未推送、未运行远端 CI。初始Schema 6.76，local-authoring 1.13.0。交付时基于最新main升级为Schema 6.77、local-authoring 1.14.0，见 [交付验证](delivery.md)。

## 能力与入口

| 能力 | 实现与对应验收 |
|---|---|
| 月、季度、年、近一年自动查询比较期 | `query.filterBindings.*.periodComparison`；可信 `periodFact` 截止时间裁剪当前期，再按日历进度平移。月环比移1月、季度移3月、年/近一年移12月，同比移12月 |
| 全部对象参与计算 | 三期完整读取、业务键并集、按指标声明缺记录为 null/zero；显式空单元格保持空，重复键拒绝 |
| 增长率与百分点 | delta + ratio，原带符号分母，零分母为 null；`points-1-signed` 展示百分点差值 |
| 全局筛选、排序、分页与导出 | 完整集合计算后进行表格操作；8个对象、页面5行、导出8条，原第二页最大增长率对象可排到首行 |
| 失败、重试及新旧请求隔离 | 任一期失败则比较表失败；持续可见错误与重试按钮；截止事实变化重新查询；取消与迟到回执由运行时集成测试验证 |
| 作者可独立使用 | 产品 Schema/版本门禁、参考文档与示例经官方导出器生成至 local-authoring，仓外安装验证 |

浏览器入口：`http://127.0.0.1:5197/pages/period-comparison-demo`。启动命令 `pnpm --filter playground dev --host 127.0.0.1 --port 5197`。

- 页面：`pages/capabilities/data/period-comparison/period-comparison-demo.json`。
- 操作说明：同目录 `README.md`。
- 合成数据与网关：`apps/playground/fixtures/period-comparison.ts`。固定统计截止日2026-10-28，测试时钟2026-10-29。
- 产品文档：`docs/page-metadata/queries-and-bindings.md`、`compute.md`、`filters.md`、`field-bindings-and-formats.md`；总入口 `PAGE-METADATA.md`。
- Skill：`metriccanvas-authoring/skill/metriccanvas-local-authoring/`，包括生成的页面示例、协议知识与独立校验器。

## 验证结果

- Page、Data Execution 全部测试与相关 Runtime、格式化、公共 API 回归：143文件、1506测试通过。
- Runtime UI 与相关运行时、格式化回归：47文件、313测试通过；与上一组有重叠，不合并计数。
- page、data-execution、engine、playground 类型检查通过；两组 Svelte 检查均0错误、0警告。
- 独立 local-authoring 与升级回归：2文件、144测试通过，包括仓外安装、链接闭合、合法页面校验和升级示例。
- 最终 `pnpm mc:content:check` 全链路通过：契约一致性、MC源覆盖、33项Python测试、诊断与可见夹具；作者工具TypeScript检查通过。
- `pnpm validate pages/capabilities/data/period-comparison`：1个页面通过、0失败。
- 浏览器：`node apps/playground/tests/period-comparison-browser.mjs` 通过。实际验证四种模式、跨页全局排序、数值筛选、8行完整导出、Excel数值和百分点格式、失败告警及点击重试恢复；无 pageerror。
- 最终 `pnpm authoring:contracts:check` 通过，1309个产品、4个创作及1个接口派生文件一致；`python3 tools/scripts/mc-content-fixtures.py --check` 通过。
- 最后补充版本检测损坏输入容错，期间与版本测试2文件27项通过，page类型检查通过；最终独立复制新Skill校验本示例，错误列表为空（`standalone-validation.json`）。
- `pnpm authoring:check` 全组完成：6文件226项，225项首次通过，唯一失败是升级示例仍声明旧版本；该示例已对齐6.77，包含该项的 `local-authoring-upgrade` 与 `local-authoring-skill` 两组144项复测全部通过。其余5文件（含导出隔离组）首次通过。此处记录首次失败与定向复测，不将原命令退出码1改写为0；无未关闭失败。

浏览器截图：[全局排序](month-sorted.png)、[失败告警](query-error.png)。自动化运行产物在 `/tmp/period-comparison-browser/`，包含各时间模式截图及 `comparison.xlsx`。

## 复杂度

同一工具 `metriccanvas-ts-ast/1`、TypeScript5.9.3，以基线HEAD和当前文件的 `selfCC` 比较；扫描全部31个新增/修改的手写TS/JS及Svelte脚本，包括匿名回调与嵌套函数。Svelte模板分支由svelte-check与浏览器覆盖，不冒充TS复杂度测量。

- `joinAggregate`：14→8；抽取的 `aggregateValue` 为7。
- `formatValue`：30→9；拆分数字格式化职责的辅助函数为5/11/7。
- `orchestrate` 筛选订阅回调：22→14；`invalidateChangedFacts` 为10。
- `scenarioEnvironment`：15→15；抽取预览网关选择函数为3。
- 新增期间解析、校验、查询执行及重试函数均≤15；完整前后记录见 [complexity.json](complexity.json)。

存量超限未增长：`orchestrate/start`26→26（外层启动与生命周期职责，本次只拆分其内部事实失效处理，避免扩张异步重构范围）；`start/refetch`17、`matchesParamDeclaration`19、`parsePage`31均未修改其函数逻辑。后续入口为 `docs/plan/2026-10-22-code-complexity.md`，本批不将同文件存量声明为已解决。

## 边界

每查询最多10000行，完整读取/导出60秒；超限明确失败，不缩为只计算当前页。当前方案使用完整集合，对超过预算的数据需另设计服务端比较与分页。

此记录证明本仓协议、执行、显示与独立搭页工具可用。数据为合成网关，不代表真实DQE、Relay、业务指标口径、权限或真实DS模型验收。真实接入须提供可信截止事实及按请求日期范围正确聚合的指标，特别是比率的分子/分母聚合，不能用月度百分比简单相加。
