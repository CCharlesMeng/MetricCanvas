# Chart filter button group · Frontend Design Delta

## 目标与 AC 引用

依据用户本轮直接指令，将既有下拉替换为类似OpenTiny ButtonGroup的直接可见选项组，并改为黑色圆角按钮风格。沿用每张图独立作用范围及创作时自定义label/value/default。

## 对接模式

只改ChartFilter表现层。value、onchange、筛选状态、查询绑定和静态导出接口均复用既有实现。

## 文字规格

参考页Small档实测高28px、字体14px、水平padding24px、圆角6px。选中项按用户要求改为#191919黑底白字，未选项浅灰底深字；所有选项直接可见。窄容器按内容自然换行，不新增断点。原生button支持Enter和Space。

## 当前代码事实

ChartFilter目前是select，父组件持有value并在onchange时写入单图筛选状态。既有真实浏览器验收直接消费pages/chart-local-filter-page.json。

## 风险与依赖

不引入Vue组件库。保留Svelte组件及既有数据执行路径。长标签的换行与范围隔离由浏览器直接验证。
