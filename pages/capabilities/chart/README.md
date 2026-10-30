# pages/capabilities/chart

页面由 JSON 自动发现。本文件仅记录使用说明，不参与渲染或注册。

## 地图着色、散点与层级筛选

入口：`/pages/region-map`；[页面 JSON](region-map.json)。

启动：`pnpm dev:playground` 与 `pnpm sim:dqe`，或 `pnpm dev:dqe`。

结合地图着色与散点展示区域指标，体验层级维度筛选和带参链接。

合成演示

初始行可预览；动态交互需仿真

1. 查看中国地图的区域颜色与散点叠加。
2. 启动本地 DQE Sim 后体验层级筛选，并查看说明文字中的带参链接。

地图展示与筛选取数分别由组件和查询绑定声明；示例不代表真实地理业务数据。

关键声明：`filters`, `sections[].components[].props.actions`, `sections[].components[].props.links`。

关联：[ioc-project-overview](../../business/dashboard/ioc/project/ioc-project-overview.json)。

关联：[demo](../layout/demo.json)。

## 独立筛选组件：四类图表与 URL 恢复

入口：`/pages/chart-local-filter-page`；[页面 JSON](chart-local-filter-page.json)。

启动：`pnpm dev:playground` 与 `pnpm sim:dqe`，或 `pnpm dev:dqe`。

四类图表均迁移为 filterGroup 组件；每组只刷新绑定的查询，保留原筛选值与独立作用范围。

合成演示

交互取数需本地仿真

1. 启动本地 DQE Sim，将订单切到海外，观察其他图和全区域对照不变。
2. 渠道切到欧洲查看空结果，再切回亚太；复制当前 URL 重新打开。

每张图使用独立筛选及查询；导出状态投影由行为测试覆盖，本页没有下载按钮。

关键声明：`filters`, `sections[].components[].props.components`, `dataSources.*.source.query.filterBindings`。

关联：[dashboard-period-filter](../filters/dashboard-period-filter.json)。

关联：[report-png-export](../export/report-png-export.json)。

## 图表高级呈现配置｜柱、线、饼图

入口：`/pages/chart-echarts-option-page`；[页面 JSON](chart-echarts-option-page.json)。

启动：`pnpm dev:playground`。

调整柱、线、饼图的高级呈现选项，对照声明顺序、标签模板和 PDF／PNG 导出。

合成演示

可直接体验

1. 查看三种图表的高级呈现配置，比较颜色、线形和半径。
2. 调整容器宽度，再体验 PDF／PNG 导出。

内联合成数据；数据与交互仍由正式属性负责，高级选项只扩展受控的呈现能力。

关键声明：`sections[].components[].props.echartsOption`。

关联：[report-png-export](../export/report-png-export.json)。

## 柱状图统一默认16px

入口：`/pages/bar-width-defaults`；[页面 JSON](bar-width-defaults.json)。

启动：`pnpm dev:playground`。

对照普通、分组、堆叠、横向、预测和混合柱系列的16px默认宽度，保留显式宽度覆盖。

内联合成数据

无需DQE或其他服务

1. 查看普通、分组、堆叠及横向图的柱宽，默认均为16px。
2. 报告预测与柱线混合图的柱系列同样为16px。
3. 最后一张显式配置32px，作为覆盖默认值的对照；缩窄窗口后默认柱宽保持16px。

只验证公共图表呈现默认值，数据为合成样例。

关键声明：`sections[].components[].props`。

关联：[ioc-header-demo](../ioc-header/business/ioc-header-demo.json)。

关联：[chart-echarts-option-page](chart-echarts-option-page.json)。

## 图表配置项常量取值

入口：[chart-constant-values-page](chart-constant-values-page.json)，路由 `/pages/chart-constant-values-page`。从仓库根运行 `pnpm dev:playground`；也可给 Vite 显式指定端口。全部为合成 inline 数据，纯常量仪表没有页面数据源依赖，不访问真实 DQE。

观察：折线和柱线混合的“基线”恒为2，横向柱同值；堆叠合计包括常量段。饼/环图三个已有类别均取2；地图仅北京、上海、广东记录取2，显式 nameMap 匹配底图。地图 tooltip 和地域摘要同时显示常量目标与实际字段值。无数据源仪表显示2，mini显示0；空数据源默认仪表显示横杠，showConstants 仪表显示2。空横轴折线不补造类别。

移动到折线绘图区查看轴提示，点击图例隐藏/恢复基线。浏览器自动验收：`CHART_VALUES_BASE_URL=http://127.0.0.1:5173 node apps/playground/tests/chart-constant-values-browser.mjs /tmp/chart-values-evidence`。关键错误态和预测边界由运行态/协议测试覆盖；浏览器、导出、真实服务验收边界见主计划的实施结果。
## 饼图表格式图例

完整页面 `pie-table-legend`，入口 `/pages/pie-table-legend`。执行 `pnpm dev:playground` 后访问，无需额外服务或 URL 参数。显式使用 Dashboard、复用统一页头；全部为内联合成数据，非真实客户数据。实际业务区间边界由查询结果提供。

1. 首图标题为「框架执行率分布区间的客户数及占比」。右侧图例有客户数量/占比列头，无分割线；区间依次 0–25%、25–50%、50–75%、75–125%，数量 96、184、72、48，默认不按数量排序。
2. 数量变化图的输入行序反向、数量改为 210、20、90、80，`categoryOrder` 仍保持上述区间顺序和颜色；后续有左侧普通饼图、显式降序和升序、自定义部分区间顺序。
3. 悬停扇区查看数据；点击“显式数量降序”图的首个大扇区，详情标题应为 25–50%，客户数量 184，不能因排序而打开原输入首行 0–25%。图例只读，不隐藏类别。
4. 缩窄浏览器或组件容器至绘图区不足 620px，图例移至图下，列头、数值仍对齐。所有区间保持完整，不自动合并“其他”。
5. 缺失数量示例只显示“真实零”“有效”，零合计示例保留“零客户”，自动占比显示“—”。首图绑定返回占比，其他图自动计算占比。
6. 在试验场修改 JSON：把图例列字段改成类别字段 `band`，或同时声明 `sort` 与 `categoryOrder`，应收到字段角色/互斥错误，恢复后可正常渲染。不能将表格式图例与 `compactRing` 或高级原生 `legend` 混用。

关键协议：`props.legend`、`props.sort`、`props.categoryOrder`、`props.labelLine`；正式能力从 6.64 引入。真实 DQE、权限、Relay 不在本组合成验收范围。可复现数据/交互均保存在页面 JSON 中；校验、浏览器与创作包证据见 `docs/evidence/pie-table-legend/acceptance.md`。

### 图例列单位与对齐

同一 `/pages/pie-table-legend` 首图将客户数量列声明为 `unit: "家"`，未声明 align，显示 `96 家` 并保持右对齐。紧接的「列呈现」图将客户数量列居中、占比列左对齐；数量变化图则将客户数量列左对齐、占比列显式右对齐。列头和数据应同步对齐。「左侧图例」示例省略 unit/align，保持原有无单位、数值列右对齐；缺省不会自动把字段元数据里的单位附到数值后。零及缺失单位的细节由行为测试补充，未执行真实查询。

## 双轴刻度对齐与单套网格线

入口：`/pages/dual-axis-alignment`；[页面 JSON](dual-axis-alignment.json)。

启动：`pnpm dev:playground`。无需 URL 参数，无需 DQE 或其他服务；数据为内联合成样例。

1. 查看双轴柱图、双轴折线图与柱线混合图：左侧数量与右侧完成率的刻度位于相同高度，只显示主轴的一套水平网格线；百分号和混合图两侧单位保留。
2. 与单轴图比较，确认原有单轴行为保留。
3. 缩窄窗口，确认刻度仍对齐，轴标签不被裁切。

自动对齐可能扩展副轴范围；显式高级范围/间隔配置仍优先，边界和覆盖由真实 ECharts SVG 渲染测试验证。页面不代表真实业务取数。相关测试还覆盖正负值、全零、空数据、数据更新和尺寸变化。

验收记录：[双轴刻度对齐](../../../docs/evidence/dual-axis-alignment-20261027/README.md)。

## 柱线图数值格式

入口：`/pages/chart-number-format`；[页面 JSON](chart-number-format.json)。启动：`pnpm dev:playground`，无需 URL 参数或 DQE。

全部为内联合成数据。依次查看普通柱图、折线图、旧分段/合计标签、旧节点标签、预测柱图及混合图；鼠标悬浮在“正值”“零”“负值”上检查提示框。

- 默认场景的标签和悬浮提示分别显示 `12345.68`、`0.00`、`-2345.68`，数值轴默认两位小数，不带隐式万单位。
- 继承场景显示 `1.2万`，显式 `number` 覆盖场景保留原值 `12345.6789`，轴刻度和提示框使用对应格式。
- “缺失”不绘制数值节点；图例中的 `2026` 保持名称文本。缺失提示文案、混合格式同轴回退及原始值不变由行为测试补充。
- 缩窄窗口后确认页面可读；检查显示不代表真实 DQE 或 Relay 验收。

旧页面依赖隐式万单位时需显式声明 `compact-wan-0`；既有显式格式不变。

### 饼图外围百分比标签

同一 `/pages/chart-number-format` 页面追加四张内联合成饼图，保留原柱线图对照；无需 URL 参数或其他服务。

1. 比较外围标签与表格式图例：甲显示 `1.2%`、乙显示 `98.8%`、有效零显示 `0.0%`，缺失不生成扇区。
2. 查看零合计饼图，外围显示“—”，与图例缺失语义一致；均分饼图的三个类别各显示 `33.3%`，不人为凑齐 100%。
3. 调整宽度，检查外围标签与图例仍可阅读；浏览器验收保留实际画布标签文字和宽窄屏截图。

外围派生占比固定使用 `percent-1`；图例列的显式格式仍只作用于该列，原数值格式不用于派生占比。高级显式标签覆盖和紧凑环图隐藏规则保持。
