# #142 / T16 S1 属性白名单回执

前置#139已验收；实施消费#141正式`a27d646bf8c4f9f9dd7c1f48c69b01fdcc226fa4`，最终合入#144正式共同SHA `3286efc91b0535e0ef839838b0985e338c3f5623`（四包rc.4 / Schema6.2）。已读#142完整正文/评论（无新增评论）、#126白名单、已验收T08精确字段及对应组件Schema；读取T18执行/精确预览契约并保留完整性门禁。

## 精确白名单

| 组件 | 本票属性控件 |
|---|---|
| reportHeader | props.subtitle / badge / tags |
| metricCard | props.showTrendArrows；已有rows/secondaryRows中的label / context / unit |
| barChart | props.horizontal / stacked / rounded / showSegmentLabels / showStackTotalLabels；已有series[].label |
| lineChart | props.smooth / areaGradient / showPointLabels / hideYAxis；已有series[].label |
| pieChart | props.ring（Schema仅0–99百分比字符串）/ labelLine |
| table | props.subtitle / fit；已有递归叶子列title / width / fixed / align |

通用组件标题与宽度仍用既有editComponent，拖拽布局仍用既有移动操作。没有开放lineChart.stacked、dualAxis、绑定/动作、列排序/筛选/分页、任意props或原始JSON路径。表列只能按现有columns/children数字位置找到叶子列，不增加/删除列、不编辑分组结构；系列与指标行只编辑现有索引，不构造新条目。

`property-edit.ts`在当前选中组件上执行封闭PropertyTarget，复制canvasDocument，只修改指定字段后经既有projectCanvasDraft整体校验。source/query、字段格式、forecast角色、stackOrder、actions、分页和其他组件均保持。空创作分区不因属性修改丢失。当前检查器支持的选中组件接入新控件，未扩展容器子树选择机制。

布尔控件为默认/开启/关闭；选择默认删除可选属性，不把未声明当成false。表格适配为content/container，列固定/对齐为left/right（无center）；列宽正整数。标签每行一项。含参数引用的文字/标签控件显示说明，明确编辑该项会替换为固定文字，未触及引用不变；不将执行参数或渲染副本写回文档。

每次onchange完成操作走既有coordinator.replaceDraft→唯一有序队列→本地保护→保存；输入中间态不提交，净无变化不保存，非法值整体拒绝。撤销复用#141单步反向操作，不在属性面板另建历史/保存机制。

## 验收

- `property-edit.test.ts` 12项：六类型属性、系列角色/字段格式/指标changes/actions保留、递归表格叶子列保留、白名单外/非法目标/非法值回滚、默认恢复为缺省、无变化、空分区保留。
- Chromium实际完成27次属性操作：页头副标题/徽标/标签，指标主行说明/上下文/单位/次行说明/趋势箭头，柱状与折线系列标签及全部白名单开关，饼图环形/引导线，表格副标题/适配/叶子列标题/宽度/固定/对齐。
- 输入未离焦时零save；重复值和非法宽度0均零save；修正非法输入为原有效值不额外保存。所有动作走现有强保存外部替身，检查串行base。
- UI渲染新列标题/环形/页头，精确修订预览读取最后保存修订，读回document等于最后提交文档。全部dataSources、actions、绑定格式和未触及设置保留。
- 最后一次属性操作可经“撤销上一步”追加新修订，表列对齐回到此前缺省；不是删除原操作。
- 元数据仍只读，没有手工添加或JSON编辑按钮。
- 截图已检查：`/private/tmp/metriccanvas-s1-evidence/t16-table-properties.png`显示新金额列、宽度180/右固定、行值及服务端新R28；脚本可重建。

浏览器首次暴露Svelte响应式代理不能structuredClone，已改用项目现有JSON文档复制方式；标签换行也已修正。最终pageerror为0。不是只靠纯对象单测宣称界面通过。

## 最终组合验证

- `pnpm test`：140文件1057项通过 / 5项既有skip。
- Platform svelte-check：0 errors / 0 warnings；测试tsc与vite build通过；diff检查通过。
- T16属性、T15历史、T14恢复、T13同步、T01/T02对话工作台浏览器均通过。
- #144精确预览执行浏览器另行复验，保留trusted read→独立文档副本→执行目标/完整文档一致性边界。

## 所有权、未覆盖与回退

新增：workbench/property-edit.ts、ComponentProperties.svelte；tests/workbench/property-edit.test.ts、property-edit-browser.mjs、property-fixture.ts；本文件。修改：Inspector.svelte、PageAuthoringWorkbench.svelte；document-edit.ts仅导出既有验证投影入口。不修改页面Schema、运行时属性实现、内容MCP或#144预览实现。

浏览器为六种代表性组件与inline数据，未逐个枚举所有variant/数据形状/参数引用组合，未新增容器子树选择或构造UI。最终页面Schema仍裁决不合法组合。真实Java强保存及外部回执仍未确认，本票使用明确外部替身，不宣称真实部署/联调通过。

回退revert本票即可恢复原检查器，不迁移/删除页面或IndexedDB。#145/#146仍等待#138，前置齐备后#146优先；本票等待S0正式验收，不宣布M1。
