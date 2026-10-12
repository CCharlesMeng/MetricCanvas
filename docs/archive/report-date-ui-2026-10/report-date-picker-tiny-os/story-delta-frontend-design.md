# DatePicker · Frontend Design Delta

## 目标与 AC
直接执行用户指定 handoff：../report-date-picker-tiny-os-handoff.md 第 3、5、6 节。用户本轮要求样式 100% 还原并集中验证，沿用已批准官方主题，不重复请求已明确的基线授权。

## 对接模式
在引擎 Svelte 表现层共享组件；单值和范围适配器继续写入统一运行时筛选状态。面板草稿与应用值分离。不引入 Vue。datetime 保持原路径。

## 文字规格
单值一个输入，范围一个整体外框两个输入，分隔符 -，右侧 SVG 日历/清除图标。四形态月/日单选与范围。星期从周日开始；12 个月四列三行；默认、选中、连续范围、hover/focus/disabled 取官方。
输入 32px、6px、#c2c2c2、14px；单面板 360px、范围 558px，月面板 245px、日面板 307px。面板白底、6px、0 4px 16px rgba(0,0,0,.08)。宽 360px 已核实是 demo 显式设置，不作为最小宽度。

## 当前代码与数据映射
TimePointFilter/TimeRangeFilter 原生输入，FilterBar 只读另有原生控件。回调只提交完整合法值；required 禁止清除。值用 YYYY-MM / YYYY-MM-DD，不用 UTC 序列化。报告期间与查询语义不变。

## 风险
ShadowRoot 内样式、浮层溢出/边缘碰撞、监听清理、PDF 控件隐藏、窄屏双面板。官方与本地窄屏取证后落实碰撞策略，不缩放单元格。

## 来源
../../evidence/report-date-picker-tiny-os-2026-10-11/ 原截图与事实；官方当日已观察 DOM 和部署 CSS。基本用法 .demo-date-picker-wrap 显式 width:360px。
