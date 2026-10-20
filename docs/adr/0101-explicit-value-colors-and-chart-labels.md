---
status: accepted
revised-by: [0110]
date: 2026-10-12
note: 用户批准红绿规则就地声明、全部类别标签与常驻数值标签；6.16 增量
---

# 数字颜色由展示位置声明，图表标签策略显式可控

原有表格 signed 和指标卡 auto 按正绿负红显示，不能表达决策时长增加为红、减少为绿，或最快/最慢榜的固定颜色。用户明确要求业务方向不能隐藏在统一运行时，且只有 red/green 两种可选业务色。颜色因此不按字段名称、页面 id 或 Top/Bottom 排名推断，也不放在数据源字段默认值中；同一字段在不同展示位置可以合法地使用不同规则。

6.16 为表格数字列和指标卡变化项增加可选 `colorRule`：fixed 声明 color，sign 分别声明 positive/negative；颜色闭集只有 red/green。正负判断使用原始有限数值，sign 的零及所有模式的缺失值不染色，fixed 的有效零仍染色。只支持 number/money，不与旧 signed、tone、dangerValues 或语义 HTML 语气混用。冲突校验拒绝，不由 CSS 优先级选择业务规则。共享解析模块执行声明，主题只决定红绿的具体色值。新规则的箭头独立按原始正负显示，旧声明保留兼容行为。

同一增量为柱状图、折线图、柱线混合图增加 `categoryLabels: {mode: all|auto, rotate?}` 与 `showValueLabels`。all 展示整个类别集合和完整名称，不抽样隐藏或默认缩放到前20个。showValueLabels 逐有效数据项常驻展示字段绑定格式化数值，零显示、缺失不伪造节点，不能与旧标签开关重复开启。堆叠柱显示各段值，混合图逐系列显示；静态导出保留相同策略。

图例换行、轴名称、旋转文字和数值标签所需的几何空间归统一运行时，使用 ECharts 的标签与文字测量能力，按直接绘图容器计算，不向页面开放 grid 像素位置。全部标签可使图表高度增加；密集场景先保留完整内容并交付真实截图，不默默减少数据或隐藏标签。

此决定延续 [0013](0013-format-belongs-to-component-field-binding.md) 的呈现位置所有权、[0018](0018-keep-page-metadata-locally-explicit.md) 的局部显式及 [0051](0051-additive-minor-versions-for-page-schema.md) 的增量版本策略。6.15 与此前已支持版本继续读取，新声明只能用于6.16；原有颜色与标签开关仍有效。不要求 Relay/DQE 或 Java 资产接口改动，外部校验器须更新生成契约。

本地测试、浏览器和静态导出证据见[实施结果](../evidence/2026-10-12-explicit-presentation/result.md)；这些证据不替代真实模型创作或生产联调。

后续[表格适配与数值间距修正](../evidence/2026-10-12-table-fit-chart-distance/result.md)取消远距离交错标签，数字保持接近自身节点；用户明确正常尺寸展示全列、窄屏允许表格内部横向滚动。商务SDT六表就地使用既有fit容器模式，不改变其他页面默认值。
