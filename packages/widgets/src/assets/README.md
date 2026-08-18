# 图片资源清单

生产代码使用的图片统一存放在本目录。批量替换时保持文件名和格式不变，构建系统会自动更新产物中的哈希文件名。

| 文件 | 原始尺寸 | 界面位置 | 主要消费方 |
| --- | --- | --- | --- |
| `ai-summary-icon.svg` | 256 × 256 | AI 总结内联文本前缀图标 | `TextBlock.svelte` |
| `header-flow-background.svg` | 1774 × 887 | 流水分析报告页头背景 | `ReportHeader.svelte` |
| `report-badge-background.svg` | 208 × 50 | 流水分析报告代表处标签背景 | `ReportHeader.svelte` |
| `ranking-decline.svg` | 25 × 25 | 排名详情卡下降趋势图标 | `RankingDetailCard.svelte` |
| `ranking-growth.svg` | 25 × 25 | 排名详情卡上升趋势图标 | `RankingDetailCard.svelte` |
| `report-assistant-icon.svg` | 28 × 28 | 报告页头“AI 助手生成”图标 | `ReportHeader.svelte` |
| `risk-warning.svg` | 20 × 20 | 风险提示文本图标 | `TextBlock.svelte` |
| `section-gradient-panel.svg` | 1200 × 640 | 内容分区面板及报告摘要背景 | `RuntimeView.svelte` |
| `section-title-left.svg` | 20 × 20 | 内容分区标题左侧装饰 | `RuntimeSection.svelte`、`ReportHeader.svelte`、`TextBlock.svelte` |
| `section-title-right.svg` | 20 × 20 | 内容分区标题右侧装饰 | `RuntimeSection.svelte`、`ReportHeader.svelte`、`TextBlock.svelte` |

## 替换约束

- 保持上述文件名与扩展名不变，可直接批量覆盖。
- SVG 应保留 `viewBox`；分区背景会以 `cover` 铺满容器，边缘可能裁切，重要图形应放在画布中心安全区。
- 不要直接修改 `apps/*/build` 或 `.svelte-kit` 下的图片，它们会在构建时重新生成。
