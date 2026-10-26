# 饼图表格式图例交互原型

临时代码，用于审核「左右表格式图例是否清楚、排序是否自然」。复用现有 EChart 宿主、ECharts 饼图/图例和 `@metriccanvas/ui` 控件，颜色沿用看板类别色板。不修改正式页面 Schema、现有饼图或 local-authoring 产物。

运行：仓库根目录执行 `pnpm dev:playground`。入口：

- `/prototypes/pie-table-legend?variant=A`：默认右侧环形图。
- `/prototypes/pie-table-legend?variant=B`：左侧饼图。
- `/prototypes/pie-table-legend?variant=C`：窄卡片，图例移至下方。

底部箭头或键盘左右键切换方案，URL 保留方案；表单与按钮获得焦点时不拦截按键。所有状态只在内存中保存。入口仅开发环境可用，正式环境返回 404。相应路由遵循 Playground 现有 `/prototypes/` 约定。

## 演示范围

标题使用业务实例「框架执行率分布区间的客户数及占比」。四个区间和 400 户数据均为合成演示；真实区间边界由业务数据提供。

- 客户数量决定扇区大小；默认固定为区间配置顺序，客户数量变化不重排。降序、升序仅作为显式选项，也可通过上下箭头自定义顺序。
- 图例、扇区同序，从十二点方向顺时针排列，类别颜色不随排序变化。
- 图例有列头、无分割线。可交换客户数量/占比的列序，也可只显示客户数量。
- 占比可使用返回字段或按客户数合计计算；本例两种口径数值相同。
- 可以左右切换、切饼图/环形图；绘图区不足 620 CSS px 时完整图例移到下方。
- 使用 ECharts 原生 legend rich text 渲染行、graphic text 渲染独立列头，避免把列头伪装成可操作的类别。
- 关闭图例点击隐藏。安装版本 ECharts 6.1.0 在 `selectedMode: false` 时同时关闭图例悬停命中，因此按已确认的「不强行实现交互」边界，不增加模拟联动；扇区仍有原生高亮和 tooltip。

## 本地验证（2026-10-26）

- `pnpm --config.verify-deps-before-run=false --filter playground check`：0 errors，0 warnings。
- 实际浏览器确认默认区间配置顺序；显式切换降序/升序时，扇区与图例同步；手动上移切换自定义并更新图形；左右布局、窄卡片、交换列头与数值同步。
- 窄屏检查：实际 `window.innerWidth=390`，`documentElement.scrollWidth=390`，绘图区宽 338，未产生横向溢出。临时浏览器尺寸覆盖已恢复。
- 截图：[默认右侧](evidence/default.png)、[窄屏](evidence/narrow.png)。
- 复杂度使用 `metriccanvas-ts-ast/1`、TypeScript 5.9.3。初版均为新增函数；本次修正默认顺序时 `orderedBands` 3→4；`moveBand` 3、`legendColumns` 3、`makeOption` 10、路由 `load` 2 均未修改。Svelte 脚本及模板中的所有函数单独提取后同口径测量，最高为 switcher 的 `keyboard`：5。其余回调 1–3，均 ≤15，未关闭项为 0。完整结果见 [complexity.json](evidence/complexity.json)，`extracted:` 指临时提取文件，不是对整个 Svelte 文件进行 TypeScript 解析。

尚待用户审核视觉效果。本原型不代表正式协议能力交付，也未验收真实 DQE、导出或现有页面迁移。方案确认后再将决定实施到正式代码，并依 prototype skill 将原型捕获到临时分支；当前未提交、未推送。
