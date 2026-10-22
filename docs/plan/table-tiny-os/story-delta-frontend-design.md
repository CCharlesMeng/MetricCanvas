# 引擎表格 TinyVue OS 还原设计

## 目标与 AC 引用

见 tasks.md AT-01 至 AT-05。用户 2026-10-20 确认：只改引擎；reportCompact 不管，forecastMatrix 与 embedded 一并纳入。

## 对接模式

复用 Table、TableToolbar、TableControlIcon、表头 popover；不迁移到 Vue，不修改平台 UI Grid。

## 文字规格

普通、forecastMatrix、embedded 使用 OS Grid 的网格皮肤。各自容器高度、矩阵对齐、列顺序和显式业务颜色保留；reportCompact 的样式和字符图标保留。共享分页与搜索原有接近 OS 的参数保持，修复已证实差异。

## 当前代码事实

完整差异来源见 ../2026-10-20-table-tiny-os-style-audit.md。官方文档所加载版本路径 tiny-vue-web-doc/3.32.0；参考基础 Grid、排序、筛选、分页的对应样式，不混用不同配置为默认。

## 状态、交互、接口与数据映射

TableSession/运行时继续持有排序、筛选、搜索、分页和导出；Table 只显示和发事件。增加的几何/滚动信息只用于布局。

## 风险与依赖

必须验证 reportCompact 未被共享样式污染；长表头的 sticky 偏移按实际行高；fit 列宽下固定列偏移不能沿用声明像素宽度。需要同环境截图与逐项值对比，未执行的交互或截图声明保持未验证。
