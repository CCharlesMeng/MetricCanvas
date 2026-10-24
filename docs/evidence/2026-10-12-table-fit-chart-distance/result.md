# 表格正常尺寸适配与图表数值间距修正

2026-10-12。本轮按用户补充要求完成：正常桌面尺寸优先在一屏横向展示全部列，窄屏允许表格内部横向滚动；数字贴近自己的柱端或折线节点。此记录更新 [ADR-0101](../../adr/0101-explicit-value-colors-and-chart-labels.md) 对应实现的后续呈现结论，之前的验收截图是当时的基线。

## 原因与修改

桌面1280px视口中，项目榜两表采用 `fit: content`、像素列宽及单行文本，内容分别撑出容器约131px、300px，见[实施前测量](tables-before.json)。本报告六张表现在均显式声明 `fit: container`，按列宽比例分配空间，完整表头及正文允许换行。通用组件为比例列保留文字和短数字所需的最小宽度；较窄时由表格自己的滚动层承接溢出，不把页面撑宽。未修改其他页面的默认 fit，也不改查询口径。

图表原实现为密集标签设置3条交错行：逐项上移0、18、36px，折线额外上移12px；全局 shiftY 避让也可能进一步移动文字。真实 ECharts SVG 回归在第2类柱值测到28px间距，超过本次16px的标签中心到节点距离上限。现已取消远距离交错与全局垂直移动，密集图直接锚定对应柱端/节点，保留全部类别及有效数值。顶部标签空间从64px收紧为24px，继续独立预留图例与轴名称空间。代表处图高度从466px变为426px。

范围：`pages/business-sdt-report.json` 的6项 fit；Table 的容器适配和最小宽度；表头换行判断；共享图表标签及空间计算；回归测试；正式格式协议和作者侧生成参考。声明形状、版本、颜色规则与数据值均沿用已批准方案。

## 最终验收

| 项目 | 结果 |
|---|---|
| 1280px正常尺寸 | [六表测量](standard-complete.json)：容器宽1076、1036、492px，均 scrollWidth=clientWidth、单元格无裁切、页面无横向溢出 |
| 390px窄屏 | [测量](narrow-complete.json)：项目两表约823px宽，由214px滚动层承接；其他表无需横向滚动，页面仍390px宽，单元格无裁切 |
| 最后一组列可达 | [真实滚动操作](narrow-scroll.json)：scrollLeft=609=maxScroll，能到达华为云计算SDT列组，页面不随表格撑宽 |
| 标签位置与完整性 | 实际 ECharts SVG 测试覆盖普通柱、折线、混合图，正负值/零值的标签中心距对应节点不超过16px；保留重复resize位置稳定回归。代表处60类别/120数值均绘制，见[汇总](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/2026-10-12-table-fit-chart-distance/svg-summary.json) |
| 组件及运行时回归 | 47文件、350测试通过，见[日志](widget-runtime-tests-complete.log) |
| 本地项目数据链路 | 3项级联/导出测试通过；[HTTP模拟记录](project-simulation.json)为本地合成阶段值，不能作为生产数据证明 |
| 类型检查 | engine 0错误0警告，见[日志](engine-check-complete.log)；Playground 检查见[日志](playground-check.log) |
| 页面与分发 | 15/15页面校验通过；570产品、4创作、1接口生成契约一致；bundle 0.3.1 的1829摘要一致，见[页面](page-validation-complete.log)、[契约](contracts-check.log)、[bundle](bundle-check.log) |
| 静态导出 | 正式 RuntimeView.withExportView 对[快照和项目模拟回放](export-replay.json)生成5张ready静态图、0 canvas；项目榜各5行。宽项目分区被标记为landscape并展开至适配宽度，表格无裁切，见[结果](export-complete.json) |

[历史截图：代表处数字贴近节点](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/2026-10-12-table-fit-chart-distance/chart-desktop.png)

[历史截图：正常尺寸下项目表格全部列](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/2026-10-12-table-fit-chart-distance/tables-desktop.png)

窄屏效果见[起始列截图](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/2026-10-12-table-fit-chart-distance/tables-narrow-accepted.png)及[滚动到最后列](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/2026-10-12-table-fit-chart-distance/tables-narrow-right.png)。60类与120数值仍很密，全部保留可能局部重叠；本次处理距离问题，不以隐藏标签改善密度。

静态导出回放是本地验收输入，原query整页导出重查、真实DQE/Relay/Java、生产PDF编码、CI及部署未在本轮验证。临时验收路由已移除，浏览器返回实际报告。未提交或推送。[批次结论](../../archive/2026-10-12-table-fit-chart-distance/README.md)保存过程中被用户补充要求替代的窄屏方案及中间检查日志。
