# 报告日期筛选实施验收

2026-10-11：已完成批准范围内的 Schema 6.13、C 工具带、四种日期形态、参数提取确认联动、期间文字、AI/人工创作入口，以及 Svelte/HTML 实例 `withExportView`。独立布局、规范、质量及功能检视已收口，聚合结果无阻断项、建议或待决项。工作区中的其它在途修改保留；本轮未提交、推送或部署。

## 结果与证据

| 范围 | 结果 | 证据 |
| --- | --- | --- |
| TypeScript 回归 | 119 文件 / 982 项通过 | [日志](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/report-date-filters/evidence/logs/ts-regression.txt) |
| 创作 Python / MCP 回归 | 522 项通过；真实模型调用 0 | [日志](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/report-date-filters/evidence/logs/authoring-regression.txt) |
| page / engine / platform / playground 类型检查 | 通过；Svelte 0 错误、0 警告 | [engine](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/report-date-filters/evidence/logs/engine-check.txt)、[platform](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/report-date-filters/evidence/logs/platform-check.txt)、[playground](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/report-date-filters/evidence/logs/playground-check.txt) |
| embed 构建 | ES module / global / 类型声明通过 | [日志](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/report-date-filters/evidence/logs/embed-build.txt) |
| 源驱动契约 | 546 产品 / 4 创作 / 1 接口文件当前 | [日志](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/report-date-filters/evidence/logs/contract-check.txt) |
| Bundle | 1767 摘要校验通过 | [日志](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/report-date-filters/evidence/logs/bundle-check.txt) |
| 宽窄布局 | 1440 工具带右对齐；390/320 换行，无封面覆盖和页面溢出 | [宽屏](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/report-date-filters/evidence/implemented-C-wide.jpg)、[390](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/report-date-filters/evidence/implemented-C-mobile.jpg)、[320](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/report-date-filters/evidence/implemented-C-320.jpg) |
| 日期与提取 | 四形态、非法/半范围保持旧期间；初创/候选无日期框，确认才生成；既有身份复用 | BE-2/3/6；[测试映射](alpha-tests.md) |
| 完整导出 | 全部分区组和 Tabs，159 表格行、1 静态图表、0 日期输入 | [截图](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/report-date-filters/evidence/export-complete.jpg) |
| HTML 公共方法 | 53 行、连接 DOM、并发拒绝、编码失败、准备和消费取消、超限、60 秒超时，结束后临时节点 0 | BE-5；[超时](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/report-date-filters/evidence/embed-timeout.jpg)、[宽分区](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/report-date-filters/evidence/embed-wide.jpg) |
| 冻结作用域 | 阅读期改为07..09，导出保持捕获的01..06 | BE-5 |
| 人工创作 | platform 正式属性面板增改删、窗口选择、非法范围原子回滚 | BE-7；[截图](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/report-date-filters/evidence/manual-editor.jpg) |
| 独立检视 | 4 角色、16 维度通过；发现的重复谓词和跨 app 验收引用已修正 | [聚合报告](review-acceptance.md)、[机器结果](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/report-date-filters/evidence/review-results.json) |

实际操作序列、几何事实、依赖摘要与命令记录在 [共享证据](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/report-date-filters/evidence/review-evidence.json)。日期草稿与已应用值分别持有；期间读取已应用值。无分页查询需要 totalCount 或显式完整结果契约；分页总数缺失、变化、提前结束及超限均明确失败。

## 交付入口

- 报告示例：`http://127.0.0.1:5186/preview?prototype=report-date&variant=C`，已保留原地址。
- 人工配置验收宿主：`apps/platform/tests/browser/report-date-editor.html`；从仓根运行 `pnpm exec vite dev --config apps/platform/tests/browser/report-date.vite.config.ts`，打开 `http://127.0.0.1:5187/tests/browser/report-date-editor.html`。
- HTML 集成应用示例：`packages/embed/examples/report-export.html`。
- [公共方法和完整性边界](../../report-export.md)、[ADR-0097](../../adr/0097-report-date-filter-and-instance-export-view.md)。

## 验证边界

后续补验：本地集成应用已补齐真实 PDF 编码、浏览器下载与实际文件预览，见 [本地 PDF 端到端补验](pdf-e2e-acceptance.md)。以下生产及真实服务边界仍适用。

浏览器使用正式组件和引擎、合成数据网关；创作流程使用本地 MCP、HTTP 和确定性模型替身。原轮次结论覆盖引擎静态 DOM、正式属性面板组件与编辑函数的本地整链；PDF 补验另列。不等同于完整平台保存流程、真人签字、真实 Relay/Java/DQE/DS、生产部署或生产集成应用 PDF 编码器验收。

PDF 编码、A4 多页、横向缩放与保存由集成应用执行；引擎提供连接 DOM、静态资源、横向分区提示和生命周期。每结果10,000行、准备60秒固定限额；回调编码时间排除。冻结查询作用域不承诺数据库事务快照。
