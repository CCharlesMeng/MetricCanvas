# DQE 表头候选完整查询接入

后续已补充懒加载、空闲预加载与主查询优先，最新行为与检查见[后续验收](../dqe-column-candidates-preload-20261029/result.md)。

2026-10-29。基线 origin/main `537333eafbbaa1f98b5448355b8154aba9a0d6fa`，独立工作树 `/Users/moon/.codex/worktrees/dqe-full-query-candidates/DataDashboard`。本批为本地未提交实现，未合入 main、未推送；主目录的并行改动不在本批范围。

用户确认 DQE 当前只能整体查询后由前端去重，且 output_metrics 必须非空。平台与 Playground 的共用 createInjectedDqeGateway 已注册 `columnCandidates: {mode:'fullQuery'}`，默认原始结果批量500行；独立 createDqeGateway 可配置相同方式。专用 encodeColumnCandidates 优先保留。

## 参数与行为

保持原查询的模型定位字段、全部 output_dims/output_metrics、业务粒度、固定条件、页面筛选、权限身份、结果绑定及其他列表头条件；排除目标列自身的表头条件。同字段的固定/页面条件仍保留。沿用既有时间和排序编码，候选关键词不混入主查询。只覆写当前读取窗口为 offset=0、500、1000…及 limit=500；业务 TopN保持上界，不扩大上游窗口。

读取后只保留目标字段去重集合，候选搜索、稳定排序、分页和候选 totalCount在前端计算。原始 total_count必须准确且跨批一致；截断、缺总数或任何一批失败不展示部分候选。取消和迟到回执被丢弃。未套用导出10000行限制。

未命中候选页缓存时，搜索和加载更多会重新完整读取；成本按原表匹配行数增长。不承诺 DQE未提供的跨批事务快照，总数不变不能证明数据未变化。

实际合成请求见本目录 `synthetic-dqe-requests.json`，完整80项结果见 `synthetic-candidates.json`。这些 JSON、仓外安装回执、复杂度报告和截图为本地检查附件，沿用仓库忽略策略，不是生产数据或线上回执。

## 功能、文档与 Skill 对应

| 项目 | 真源 / 入口 | 验收 |
|---|---|---|
| 完整读取与去重 | packages/data-execution/src/dqe/full-query-candidates.ts | 跨批、业务TopN、10001行、空值/零、缺失/变化总数、截断、后续失败、取消/迟到 |
| 默认注册 | packages/application-runtime/src/runtime-config.ts | 原生合成HTTP信封、非空指标、全部输出维度、身份注入沿用既有网关 |
| Playground | /pages/table-column-candidates-query；pages/capabilities/table/table-column-candidates-query.json | 620原始行、80个代表处，自身筛选不缩小候选，区域筛选缩为20项；?state=truncated显示失败与重试 |
| 模拟数据 | apps/playground/fixtures/full-query-candidates.ts | 部分候选只在600行后出现，真实服务未调用 |
| 页面协议说明 | PAGE-METADATA.md、docs/page-metadata/components/table.md | 页面声明与Schema版本保持；补充调用方式、限制及演示入口 |
| DQE参数 | docs/host-contract.md、docs/plan/table-column-candidates/dqe-handoff.md | 完整请求示例、原始/去重总数区分、非空指标与批次范围 |
| local-authoring | Skill 1.11.2，官方导出生成知识和清单 | 仓外完整目录复制、无外部符号链接、新演示页校验通过，见standalone-skill.json |

## 检查结果

- 相关查询/数据网关/候选回归：45文件、374项通过。
- Playground实际Chrome浏览器：2项通过；已查看正常截图。正常及截断截图为本目录 browser-ready.png、browser-truncated.png。
- pages/capabilities/table：30个页面全部通过；独立Skill对新页输出ok=true。
- data-execution、application-runtime、Playground及根tests类型检查通过；svelte-check为0错误0警告；data-execution包构建通过。
- `pnpm authoring:contracts` 生成成功；`pnpm mc:content:check` 通过，含33项MC检查及生成一致性。使用已安装依赖的authoring Python环境。
- `pnpm authoring:check`：6文件、224项全部通过，含独立安装、迁移与契约导出隔离回归（933秒）。
- 此基线没有 `pnpm skills:check` 脚本，因此执行已有authoring检查与仓外安装验证。额外尝试repair诊断工具时，发现既有inspect-page-metadata.ts引用未导出的fileNameErrors；工具及page/index均未改，不并入本批修复。新页面另经产品CLI与独立Skill校验通过。
- 真实DQE、Relay、真实模型、远端CI：未执行。没有真实端点凭据/回执证据，不从合成或本地成功推断。

## 复杂度

口径：仓内metriccanvas-ts-ast/1、TypeScript5.9.3、selfCC逐函数计量，嵌套函数逐个计量；Svelte只提取script后对比同一函数。原始数据见complexity.json。

| 函数 | 前 | 后 |
|---|---:|---:|
| createDqeGateway/fetchColumnCandidates | 7 | 8 |
| createDqeGateway与createInjectedDqeGateway自身 | 1 | 1 |
| pageExternalInputs | 15 | 8 |
| scenarioEnvironment | 12 | 13 |
| previewDataGateway（Svelte script） | 11 | 13 |
| 新完整读取辅助函数（全部6个） | 新增 | 1—7 |
| 新合成网关函数/回调（全部10个） | 新增 | 1—7 |
| 新测试回调/辅助函数 | 新增 | 1—3 |

全部新增及修改函数≤15；未改的gatewayNormalizationError为16→16，属于既有行归一化逻辑，本批未涉及。没有本批新增超限项。
