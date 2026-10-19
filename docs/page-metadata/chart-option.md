# 图表高级 ECharts 呈现扩展

自 6.32 起，`barChart`、`lineChart`、`pieChart` 可声明隐含 `props.echartsOption`。它是正式协议中的高级入口，属性面板不展示、AI 默认不主动生成；只在用户明确要求 ECharts 定制，或现有属性不足且用户已接受时使用。普通编辑保留已有配置；切换图表类型时清除并向 console 说明，撤销恢复。

## 声明与合并

根必须是 JSON 对象，值只允许普通 JSON，嵌套不超过64层。允许字符串模板，不执行函数、函数字符串或表达式。该子树不参与 MetricCanvas 的 param/filter/parts 文本解析。

```json
{"echartsOption":{"animation":false,"series":[{},{"lineStyle":{"width":3}}]}}
```

同一允许路径透传优先；对象递归合并，颜色、半径等普通数组整体替换。null 是显式值，不是删除操作。`series` 仅接受对象数组，按页面 `props.series` 的声明序补充；柱图 stackOrder 改变绘制序时对应关系保持。空数组无补丁、空对象保留该项，不增删系列；饼图只有一项。xAxis/yAxis 对象补充第0轴，数组按既有轴索引补充，不能创建轴。删除配置后恢复基础呈现。

保留 ECharts 原生属性层级：series.itemStyle 不自动压过每个数据项更具体的 itemStyle；引擎不为此重写受保护数据。模板可替换当前显示格式，原始数值和组件字段绑定保持。

## 允许入口与保护

允许 color、backgroundColor、textStyle、grid、legend、tooltip、xAxis、yAxis、series，以及 animation、animationDuration/Update、animationDelay/Update、animationEasing/Update、stateAnimation。grid/legend/tooltip 为单个对象；饼图没有 grid 或轴。grid 边距参与布局，必要的防裁切空间由引擎修正。静态导出关闭动画、去掉缩放控件、展示完整结果。

系列数据、类别轴 data、dataset/encode/dimensions、系列 id/name/type、stack、轴/坐标系归属、事件接管和关闭既有点击行为均拒绝。baseOption/options/media/timeline、visualMap/geo/graphic/toolbox/dataZoom、markPoint/markLine/markArea 不属于本批开放面。链接、外部图片、额外下载、原始 HTML/CSS、回调位置及原型修改相关键同样拒绝。formatter 仅在 tooltip、axisLabel、label 中接受字符串模板；valueFormatter 等函数专用位置不开放。tooltip 模板只允许纯文本（无尖括号 HTML 标记），换行可配合 richText 模式；呈现值不接受 CSS 声明片段（非 formatter 字符串中的分号）、url/image-set/expression 或可执行 URL。

产品校验检查 JSON、上述保护与集合边界，错误返回精确 JSON Pointer；不复制完整 ECharts Schema。部分未知属性可能被 ECharts 忽略或警告，校验通过不保证每个属性都有效，也不保证会触发回退。

## 失败、降级和诊断

非法 JSON、受保护路径、越界等校验错误直接拒绝，不降级绕过。通过校验后，扩展构造、合并、布局或绘制抛错时，销毁失败实例，干净基础配置回退一次；基础配置自身失败则保留标题和容器、绘图区留空。原页面配置保留。resize 不重新启用已失败的扩展，有效数据或配置变化后重新尝试。

本能力诊断只写 console，包含组件 id/type、stage、path 和原始 cause。页面、toast、tooltip 和导出按钮不展示错误文字；CLI/工具/独立校验器仍返回结构化错误。无法定位叶子时使用选项入口路径，不虚构位置。导出视图发生降级或基础绘制失败就终止 PDF/PNG，无下载，原因只 console；其他既有错误处理保持。

完整场景 `chart-echarts-option-page` 由本模块的示例路由提供，全部为内联演示数据。数据/结构拒绝由契约反例验证；绘制恢复与导出终止由浏览器故障注入验证，不依赖某个 ECharts 属性恰好报错。地图和其他组件不支持本入口。
