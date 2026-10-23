# AI Summary 数据源 ID 引用验收

基线：`f78dafe8f671f6cd4d3ebf432c632dcc1c6b4ce8`。本批在隔离工作区 `summary-data-source/DataDashboard` 修改，未改主工作区的并行内容。

## 声明与行为

Schema 6.52 新增 `relatedDataSource: ["comparison"]`，直接引用页面数据源 ID。数组非空、ID 已声明且不能重复；采用数据源全部非明细结果字段，复用标签、类型、单位、实际生效查询及当前快照。数据源顺序归一化，不影响生成输入和缓存。

显式数据源优先于 `relatedSections`；省略时继续按可见内容分区、活动 Tab 推导。仅被摘要引用的数据源仍参与取数，查询分页表格的独占检查也计算这些引用。旧 `relatedData` 保持读取及字段白名单语义，禁止与新字段同时声明。provided 模式不允许声明生成范围。

`generate(question, contextInfo): Promise<string>` 与独立云宝 Adapter 不变；Mock 仍是 Mock。直接引用/分区推导时 contextInfo 数据源 description 使用 ID，业务背景由 promptTemplate 提供。

## Playground 与文档对应

- 页面：`pages/capabilities/ai-summary/report-ai-summary.json`，入口 `/pages/report-ai-summary`。本批预览 `http://127.0.0.1:5177/pages/report-ai-summary`，使用独立 DQE Sim 18229。
- 对照区域用 `relatedDataSource: ["comparison"]`，用量区域保留 `relatedSections`；后端正文与结构降级继续展示。
- 实际浏览器检查页面 JSON 为 6.52、直接引用数组；期间从 2026-09 切到 2026-08—2026-09，再回到 2026-09，两区域分别显示各自范围与结果。
- 产品语义：`PAGE-METADATA.md`、`docs/page-metadata/components/aiSummary.md` 与主题结论；交接：`packages/engine/runtime-ui/src/ai-summary/README.md`。
- 产品契约、local-authoring 协议知识、独立校验器与数据分析脚本通过导出器再生；四个新非法向量覆盖未知 ID、重复 ID、空数组、版本不足。

## 验证

- 全仓类型/Svelte 检查 `pnpm check` 通过；最终调整另跑 `pnpm exec tsc --noEmit -p tests/tsconfig.json` 通过。
- 回归（排除单独执行的四个创作文件）：314 个文件通过，2695 项通过、4 项既有跳过。
- `pnpm authoring:check`：4 个文件、73 项通过；源码收尾后重跑 local-authoring tools、仓外安装和 reference 三个文件，50 项通过。仓外复制包括独立校验、协议向量和内容/哈希闭合。
- 最终定向回归：页面模式、分页独占、摘要输入、本地创作数据发现四个文件，45 项通过；包含明细字段排除、元信息保留、多源顺序归一化、输入不变性及无可见数据槽取数。
- `pnpm validate pages`：85 个页面全部通过。
- `pnpm authoring:contracts:check`：1098 product / 4 authoring / 1 interface 文件与真源一致。
- 包构建、`pnpm packages:check` 与 Embed 构建通过。
- 浏览器 `report-ai-summary.spec.ts` 两项通过：直接引用的上下文、时间切换、后台完成、缓存和导出；宽窄尺寸与 SDT 摘要样式完全一致。
- 以上是确定性实现、DQE Sim 与本地 Mock 的证据，不代表真实云宝、DQE/Relay 或内网鉴权验收。

## 复杂度

口径为 `metriccanvas-ts-ast/1`，TypeScript 5.9.3；函数自身 CC，闭包与回调逐个扫描。未修改 Svelte 脚本或模板。

| 修改函数 | 前 | 后 |
| --- | ---: | ---: |
| aiSummaryRelatedData | 4 | 5 |
| aiSummaryErrors 的组件遍历回调 | 8 | 9 |
| providedErrors | 6 | 7 |
| assembleGenerationInput | 7 | 8 |
| queryPaginationErrors 的组件遍历回调 | 14 | 12 |
| visitSchema | 26 | 13 |
| scanPageData | 13 | 13 |

新增 relatedSources=1、sourceErrors=6、addSummaryReferences=5、visitReference=7、visitProperties=10、relatedSourceFields=3；新增辅助回调与测试回调均不超过 15。其余修改仅为 Schema/版本登记、声明和测试期望；相关回调已扫描。本批无未关闭的新增或修改函数超限；扫描到的未修改存量函数不作为本批改动。

详细命令日志、前后 AST 测量与浏览器截图保存在本任务的本地证据目录。交付按用户要求使用 `[skip ci]`；CI 跳过不代表通过，以上本地验收结果单独成立。
