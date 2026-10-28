# 显式数字颜色与图表标签：实施与验收

2026-10-12。本仓实现和本地验收已完成，当前声明版本为 6.16。现行规则见 [ADR-0101](../../adr/0101-explicit-value-colors-and-chart-labels.md) 和[字段绑定与格式协议](../../page-metadata/field-bindings-and-formats.md)；过程计划见[批次结论](../../archive/2026-10-12-explicit-presentation/README.md)。

## 完成项目

1. 表格数字列、指标卡变化项共用 `colorRule`，仅允许 `red` / `green`。`fixed` 固定颜色，`sign` 显式声明正负颜色；展示位置独立执行，不推断业务方向。sign 零不染色，fixed 零染色，缺失不染色。新规则下箭头按原始数值方向独立显示；主题红绿值在两类消费者一致。
2. TypeScript 与 Python 校验同步拒绝非数字字段及旧 signed/tone/dangerValues 冲突声明。新能力只能在 6.16 使用；保留既有支持版本及旧规则。Schema、公共类型、参考示例、能力登记、生成契约和 authoring bundle 同步。
3. 图表公共布局按绘图容器计算图例换行、轴名称及标签所需空间；图例与绘图区分开，窗口变化和静态导出复用相同策略。
4. 柱状图、折线图及混合图可声明 `categoryLabels: {mode: "all", rotate: 45}`，显示完整类别集合，关闭抽样隐藏及默认前20项窗口。本页代表处60项实际采用90°，其他图采用45°。
5. `showValueLabels: true` 逐有效数据项常驻显示对应字段格式化数值，混合图柱与线均显示；零显示，缺失不伪造。密集图采用交替位置，标签保持关联于实际节点，重复 resize 后位置稳定。新开关与旧标签开关不能重复启用。
6. [商务 SDT 页](../../../pages/business-sdt-report.json) 的时长变化显式正红负绿；最快榜主时长固定绿，最慢榜固定红；次数变化保留原映射并显式声明。项目榜只调整主决策时长，阶段时长和名称等列不继承。5个图全部启用类别及数值标签。

目标页面相对实施前快照共28个声明路径变化，[差分记录](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/2026-10-12-explicit-presentation/metadata-diff.json) 证明 `dataSources` 与 `filters` 未变。本轮不修改查询口径，不需要 Relay/DQE 的业务协议改动。

## 验收证据

| 验证 | 结果及边界 |
|---|---|
| TypeScript 全量 | 197文件、1746测试通过，见日志（本地附件，不随仓交付：`.scratch/evidence-runtime-attachments-20261028/2026-10-12-explicit-presentation/typescript-tests-final.log`） |
| 作者侧规则及交付 | 450测试通过，见日志（本地附件，不随仓交付：`.scratch/evidence-runtime-attachments-20261028/2026-10-12-explicit-presentation/authoring-tests-final.log`）；scripted-no-model，不代表真实模型验收 |
| 变更聚焦回归 | 最后颜色样式统一后，页面与组件17测试通过；含有效零、负值、缺失、冲突、旧规则、三条图表路径及真实 ECharts SVG 重复 resize |
| 类型检查 | engine 和 Playground 均0错误、0警告，见engine（本地附件，不随仓交付：`.scratch/evidence-runtime-attachments-20261028/2026-10-12-explicit-presentation/engine-check-final.log`）、Playground（本地附件，不随仓交付：`.scratch/evidence-runtime-attachments-20261028/2026-10-12-explicit-presentation/playground-check.log`）；page 包检查也通过 |
| 页面校验 | `pnpm validate`，15/15页面通过 |
| 生成物 | `authoring:contracts`、`authoring:contracts:check` 和 `check_bundle.py` 通过；570产品契约、4创作契约、1接口契约，bundle 0.3.1 的1829个摘要一致 |
| 页面实际绘图 | [可重跑脚本](render-chart-evidence.ts) 使用 parsePage 后的初始行，调用实际 option 与 ECharts SVG 渲染；[汇总](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/2026-10-12-explicit-presentation/svg-summary.json) 中无缺失类别，所有有效数据项数值均被绘制，无需 hover |
| 浏览器颜色 | [实际页面](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/2026-10-12-explicit-presentation/browser-colors.json) 与[边界样例](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/2026-10-12-explicit-presentation/browser-edge-values.json)；表格和卡片红色一致，正红向上、负绿向下、sign零普通、fixed零绿色、缺失普通 |
| 空数据/失败状态 | [空数据](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/2026-10-12-explicit-presentation/browser-empty.json) 未伪造数值，[查询失败](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/2026-10-12-explicit-presentation/browser-error.json) 正确显示5项查询错误，无图表成功假象 |
| 静态导出视图 | RuntimeView.withExportView 使用[初始快照的 inline 回放](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/2026-10-12-explicit-presentation/report-inline-export.json)，[冻结结果](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/2026-10-12-explicit-presentation/browser-export.json) 为5个 ready 静态图、0 canvas；[截图](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/2026-10-12-explicit-presentation/export-chart.png) 保留类别与数值。该回放仅为验收输入，正式页面数据源仍为 query |

实际页面的三条月份趋势分别为6类/6数值；代表处为60类/120数值；地区部为12类/22有效数值，缺失项不生成0。命令 `pnpm exec tsx docs/evidence/2026-10-12-explicit-presentation/render-chart-evidence.ts` 可重跑计数证据。

[历史截图：桌面真实呈现](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/2026-10-12-explicit-presentation/desktop-chart.png)

[历史截图：390px窄屏真实呈现](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/2026-10-12-explicit-presentation/narrow-chart.png)

## 可见限制与未执行项

60类及120数值在桌面已全部呈现，但部分数值仍拥挤；390px视口中254px绘图区明显过密。按用户要求保留完整标签，未以隐藏或缩减数据改善密度。页面其他内容在窄屏仍有横向溢出，此次图表修改不构成整页移动端适配验收。

原 query 页面 `withExportView` 的重查被本地模拟器报 `DQE_SIM_UNSUPPORTED_QUERY`，因此整页原查询导出未通过。以上静态导出结果来自初始快照回放；真实 DQE/Relay/Java、真实模型创作、生产 PDF 编码、CI、发布与部署均未执行，不由本地证据推断。

工作区已有其他批次改动，实施前备份位于 `/tmp/metriccanvas-colors-labels-before-20261012/`，未提交或推送。回归维护仅同步当前版本、公共类型快照，并修正一处已有测试对迁移后历史夹具的旧路径；临时验收路由已移除。旧失败日志归档保留，最终结果以本页及最终日志为准。
