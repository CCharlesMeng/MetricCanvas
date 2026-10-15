# 查询数值度量容错验收

日期：2026-10-15。当前工作树存在并行任务，本批只调整查询数值容错及其直接消费者；不提交或推送并行工作。

## 实现与行为

共享查询归一化把 number / money 度量转为有限数字或 null。十进制/科学计数法字符串转数字，真实零和负数保留；占位符、空串、布尔、对象、数组、NaN/Infinity 转缺失，保留全部数据行。非空度量的实际缺失仅告警。数值维度、映射缺失、非对象行、明细结构及项数上限仍严格；inline 仍按原契约校验。

动态 DQE、初始行和一层嵌套明细共用归一化。查询初始行的原始单元格结构允许到达归一化接缝，再按真实字段契约裁决。组合表的成员、投影与保存初始行复验允许缺失度量，行键不放宽。

告警以字段和原因聚合计数，不记录原值或数据行。可空字段的正常 null 不告警；1000 个同字段异常只生成一项计数。表格/卡片显示 missingText，折线/柱图留缺口，饼图略过缺失值，指标卡进度环不把缺失显示为 0%。真实零仍显示 0%。

计算遵守各算子原有缺失值规则。允许忽略缺失的合计不代表完整统计；此改动不重新执行上游已经完成的聚合、排序或分页。

## 功能、场景与分发映射

| 项目 | 真源 / 验收入口 |
|---|---|
| 数值归一化及查询结果契约 | [query-rows.ts](../../../packages/page/src/query-rows.ts)、[result-field-contract.ts](../../../packages/page/src/result-field-contract.ts) |
| DQE 响应与脱值告警 | [dqe.ts](../../../packages/data-execution/src/dqe/dqe.ts) |
| 组合表复验 | [rows.ts](../../../packages/data-execution/src/paged-join/rows.ts)、[validate-paged-join.ts](../../../packages/page/src/validate-paged-join.ts) |
| 八行完整页面 | [query-numeric-tolerance.json](../../../pages/query-numeric-tolerance.json)，已注册试验场目录及 pages/README |
| 同页行为验收 | [numeric-tolerance.test.ts](../../../packages/data-execution/tests/numeric-tolerance.test.ts)，读取上述完整页面 |
| 独立校验器 | [local-authoring-skill.test.ts](../../../tests/local-authoring-skill.test.ts)，复制 Skill 到仓外，接受异常数值并拒绝维度/映射错误 |
| 元数据文档 | [PAGE-METADATA.md](../../../PAGE-METADATA.md)、[字段](../../page-metadata/fields.md#查询数值度量的容错)、[数据源](../../page-metadata/data-sources.md) |
| 本地创作 Skill | 从独立临时检出的产品真源生成 references、完整示例、validate-page.mjs、知识及 Bundle 摘要；只同步生成差异 |

旧创作验收向量中“null 非空数值失败”和“数字字符串失败”已在当前导出中明确投影为成功用例，冻结历史向量保持原文。Python 预检对齐当前查询数值规则；未修改真实 DQE 执行适配器。

## 实际验证

- 产品回归：95 个测试文件、874 项测试通过，含页面契约、数值容错、真实网关适配器、共享执行与全部 widgets。见 [vitest.txt](vitest.txt)。
- Python 完整分类回归：543 项通过，使用 requirements.lock 的 Python 3.12 隔离环境。系统 Python 的首次缺依赖失败不算产品结果；补齐依赖后完整重跑。见 [python-full.txt](python-full.txt)。
- 补充进度环场景后，Python 契约与创作回归 40 项通过，见 [python-targeted.txt](python-targeted.txt)。
- 类型：页面包、共享执行包、仓库 tests TypeScript 检查通过；engine svelte-check 为 0 errors / 0 warnings。
- 页面：22 个页面文档校验通过。
- 构建：五个发布包构建成功；补充组件改动后重新构建，见 [build.txt](build.txt)。

浏览器初始行使用原有 5173 服务；动态取数使用本批隔离启动的 5183 / 18229 服务，预览编辑器仅省略同一页面的 initial，不改交互或组件配置。八行均渲染，数值为 10.0、—、—、12.5、0.0、-4.0、—、—，派生完成率一致。排序升序时有效值 -4、0、10、12.5 在前，缺失值在后，八行保留；图表 canvas 有非零尺寸。进度环明确显示“缺失值进度 —”与“真实零进度 0%”。

证据：[首屏截图](browser-initial.png)、[首屏 DOM](browser-initial.json)、[排序截图](browser-sort.png)、[动态截图](browser-dynamic.png)、[动态 DOM](browser-dynamic.json)。动态截图采集早于追加进度环，动态数值、初始行/动态一致性及进度环分别由行为测试和最终首屏补证。

## 证据边界

本地静态、单元/集成、Node 构建、仓外 Skill 和浏览器 + DQE Sim 是本批证据。真实 DQE、Relay、Java、DS 模型、部署与 CI 未执行；脚本化模型测试的 modelCalls=0，不作为真实模型证明。页面与 Sim 行均为显式合成数据。

## 最终核对

- `pnpm validate`：22/22。
- 页面、共享执行、tests TypeScript 检查通过；engine svelte-check：0 errors / 0 warnings。
- `pnpm build:packages`：UI、page、data-execution、engine、metric-canvas 五个包通过。
- `pnpm authoring:contracts:check`：651 product / 4 authoring / 1 interface files 一致。
- `python3 metriccanvas-authoring/scripts/check_bundle.py`：2412 项摘要核验通过。
- `tests/local-authoring-skill.test.ts`、`tests/page-reference.test.ts`、`tests/authoring-export-isolation.test.ts`：3 个测试文件、31 项通过，见 [distribution.txt](distribution.txt)。独立 CLI 的仓外复制、无仓库依赖、数值容错/严格边界及生成隔离均通过。
- 本批临时 5183 / 18229 服务已停止；原有 5173 / 18228 服务保留。
- 本批独立导出检出已清理；未执行 Git 提交、推送或部署。
