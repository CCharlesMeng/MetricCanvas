# 饼图表格式图例验收（2026-10-26）

## 范围与输入

实施 checkout：`/Users/moon/.codex/worktrees/pie-table-legend/DataDashboard`，分支 `codex/pie-table-legend`，基线 `ea40f6641e41e974dd3f1801c4613c5a1a7fcd45`。原工作区并行改动未带入。没有依赖或锁文件变更；运行使用该基线锁定的依赖，通过工作区链接指向本 checkout 的 MetricCanvas 包。

已确认的原型捕获为本地分支 `codex/pie-table-legend-prototype`，提交 `f6fd243c`；正式分支不包含临时原型代码。裁决：默认图例稳定、不按数量重排；左右表格式图例、列头与无分割线、配置数据列、显式升降序/自定义顺序、窄卡片移至下方。没有实现图例隐藏或自定义交互通道。

## 能力对应

- 产品 Schema：`packages/page/src/schema/components/charts.ts`，`legend`、`sort`、`categoryOrder`；6.52 能力及低版本拒绝。
- 运行时：`pie-chart/presentation.ts` 为扇区、图例与点击提供同一行投影；内部复用 `CategoryBreakdown` 的真实无分割线表格。颜色与类别域共享，输入不变，缺失数值剔除、真实零保留，零合计的自动占比为缺失值。
- Playground：`pages/capabilities/chart/pie-table-legend.json`；启动 `pnpm dev:playground` 后访问 `/pages/pie-table-legend`。本次隔离服务命令 `pnpm --filter playground dev --port 5188`，实际入口 `http://localhost:5188/pages/pie-table-legend`，listener cwd 已核对为本 checkout。5188 避开原工作区已有的 Playground/Platform 服务。
- 协议文档：`PAGE-METADATA.md`、`docs/page-metadata/components/pieChart.md`、`reference-map.json`；运行说明在页面所在目录 README。
- 产品契约与 local-authoring：从真源重新生成 Schema、向量、完整样例、精确语义知识、独立校验器与哈希清单；没有手工修改派生产物。旧分发投影随统一导出器更新，但不追加旧 Skill 专项验收。

## 实测

实际浏览器检查了默认区间顺序、同色同序、返回占比/自动计算占比、左右位置、显式升降序、部分自定义类别顺序、缺失数量和零合计。前两个图在数量和输入顺序变化后类别与色点一致；表格单元格计算样式 border 为 0px。点击降序图首个大扇区，详情标题为 **25–50%**，客户数量为 **184**，证明排序未错行。

窄卡片实例使用 span=4，在实际组件宽 467px 时，plot 高 320px，legend.top 大于 plot.bottom，组件 scrollWidth=clientWidth=467；四条图例均存在。浏览器的 viewport override 没有改变此 tab 的 DOM 宽度，因此不将该调用当作整页手机尺寸的验收；窄卡片的实际容器重排已经通过，临时覆盖已恢复。

截图：[正式页面](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/pie-table-legend/desktop.jpg)、[排序后点击](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/pie-table-legend/sorted-click.jpg)、[窄卡片](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/pie-table-legend/narrow-card.jpg)。截图只作可视证据，断点与完整行数以上述实际 DOM 检查为准。

检查命令均从本 checkout 执行，pnpm 使用 `--config.verify-deps-before-run=false` 复用已安装依赖：

- `pnpm test packages/page/tests packages/engine/widgets/tests tests/local-authoring-skill.test.ts tests/page-reference.test.ts`：112 文件、1159 测试全部通过。
- `pnpm test tests/authoring-export-isolation.test.ts -t '无旧链时可运行|独立本地 Skill'`：8 项通过，15 项不在本次 Skill 验收范围内而跳过。
- `pnpm --filter @metriccanvas/page check`、`pnpm --filter @metriccanvas/engine check`、`pnpm --filter playground check`：通过，Svelte 0 errors / 0 warnings。
- `pnpm build:playground`：通过，静态站点输出成功。
- `pnpm authoring:contracts`、`pnpm authoring:contracts:check`：生成及一致性检查通过（1102 product、4 authoring、1 interface outputs）。
- `git diff --check`：通过。

首次广泛检查发现新增容器断点未登记响应式契约，补齐 `pie-table-legend-flow` 后定向及上述完整回归均通过。一次额外包含全部历史导出隔离场景的检查已停止，以仓库要求的 local-authoring 范围重新验收，不把被停止的检查记作通过。

## 复杂度

口径 `metriccanvas-ts-ast/1`、TypeScript 5.9.3；Svelte 脚本和模板函数分别提取后测量，不能将整个 Svelte 文件当 TypeScript 解析。修改函数与所有新增辅助函数/回调均已测量，完整记录见 [complexity.json](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/pie-table-legend/complexity.json)。

| 函数 | 前 | 后 |
| --- | ---: | ---: |
| pieOption | 9 | 9 |
| pieRows（移入共享投影） | 1 | 4 |
| categoryBreakdownView | 4 | 5 |
| checkPieChart | 1 | 9 |
| categoryOrderedRows | 新增 | 1 |
| pieCategoryDomain | 新增 | 2 |
| projectedDefinition | 新增 | 4 |
| projectColumn | 新增 | 3 |
| pieLegendData | 新增 | 3 |

新增回调均不超过 15。本批无新增/修改函数超限；同文件未修改的 `parsePage` 自身 CC 为 31→31，是已有债务；本次调整的是 `componentErrors` 内独立测量的 `checkPieChart`，未扩大为整体验证器重构。

## 边界与保留项

没有执行真实 DQE、Relay、权限服务或真实模型验收；没有追加 PDF/PNG 下载验收。图例保留在现有 DOM 导出路径，不因此宣称端到端导出已验证。

正式改动仍在独立实施 worktree，未合入 main、未 push、未运行远端 CI。正式 worktree 和原型分支保留用于实施审阅与恢复；均未合入 origin/main，不满足已合并清理条件，不做全仓分支清理。
