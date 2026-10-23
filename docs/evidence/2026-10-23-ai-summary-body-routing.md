# AI Summary 正文优先验收（2026-10-23）

基线：`7249c2819f7d503629649ec69962315510fe0915`。实施 checkout：`/Users/moon/.codex/worktrees/summary-body-routing/DataDashboard`。锁文件未改；使用 `pnpm install --frozen-lockfile` 安装依赖。

## 交付行为

- `body` 去除首尾空白后非空：直接渲染原正文；摘要不激活关联查询、不要求 AI 配置、不调用 `generate`，时间切换保持正文。页面其他组件照常查询。
- `body` 缺失、空字符串或纯空白：使用 `promptTemplate` 与 `relatedDataSources` / `relatedSections` 执行原生成流程；保留节流、后台任务、去重、缓存与导出。
- 正文优先级统一用于语义校验、关联数据收集、组件渲染、生成输入与导出；非空正文下，生成相关配置不参与语义校验或查询引用计数，字段类型仍受 Schema 约束。
- 当前页面无需声明 `mode`、`initial`、`inputKey`；旧字段只保留读取兼容。首屏正文随时间再生成的独立需求暂不扩展参数。
- Schema 6.54 声明新正文路由能力；旧版有效声明仍可读取。Playground 示例和 local-authoring 独立分发同步生成。

## 验证

| 检查 | 结果 |
| --- | --- |
| 页面、数据执行、runtime、local-authoring 回归 | 191 文件，1541 测试通过 |
| `pnpm check` | 全量类型与 Svelte 检查通过 |
| `pnpm build:packages`、Embed build、`pnpm packages:check` | 通过，构建参数使用默认配置 |
| `pnpm authoring:contracts` 与 `:check` | 生成后自洽检查通过 |
| `pnpm validate pages` | 86 页面全部通过 |
| Embed AI Summary 浏览器 | 3 场景通过：正文/空白路由，时间/后台/缓存/导出，SDT 宽窄样式一致 |
| Playground 实际页面 | `/pages/report-ai-summary` 展示直接正文、结构文字容错、双区域 Mock 分析；展开 JSON 确认 6.54 且无 mode |

非空正文浏览器场景没有注入 AI 配置，切换时间后仍正常展示，关联查询计数与生成计数均为 0；清空为纯空白后查询并生成一次。输入测试覆盖正文覆盖历史生成快照，产品校验覆盖忽略无效生成引用及查询分页引用所有权。

最终仅调整示例描述用词后，再生成合同并复核自洽、单页目录校验及针对性回归。原始日志、浏览器截图、复杂度 JSON 保存在本机 `~/.codex/visualizations/2026/10/22/01a1637a-e058-7e73-8016-bf5d0b40d3c1/ai-summary-body-routing-2026-10-23/`。

以上为本地 Mock / DQE Sim 及构建证据，不构成真实云宝 SSE、鉴权或生产服务验收。按用户先前要求以 `[skip ci]` 交付，CI 跳过不代表 CI 通过。

## 复杂度

工具 `metriccanvas-ts-ast/1`，TypeScript 5.9.3，逐函数自身 `selfCC`；闭包/新增辅助函数单独实测。Svelte 提取实际 script 测量，模板未改。

| 相关函数 | 修改前 | 修改后 |
| --- | ---: | ---: |
| `hasAiSummaryBody` | — | 1 |
| `aiSummaryRelatedData` | 5 | 5 |
| `aiSummaryErrors` | 1 | 1 |
| `aiSummaryErrors` 逐组件回调 | 9 | 8 |
| `providedErrors` | 7 | 删除 |
| `checkAiSummary` | 4 | 5 |
| `addSummaryReferences` | 5 | 6 |
| `assembleGenerationInput` | 8 | 9 |
| `exportSummarySnapshot` | 5 | 5 |
| AiSummary 主 effect | 6 | 6 |
| 新能力版本检测回调 | — | 4 |

全部新增和修改函数均未超过 15（含测试回调）；扫描到的 `parsePage` 为未改存量 31→31，不属于本批重构范围。无本批复杂度未关闭项。
