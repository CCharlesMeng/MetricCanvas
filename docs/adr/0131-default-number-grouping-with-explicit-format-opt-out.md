---
status: accepted
date: 2026-11-17
note: 用户确认旧页面随引擎采用默认千分位；6.123新增ungrouped格式；限定修订0051既有语义兼容原则
---

# ADR-0131：普通数值默认千分位，format 显式关闭

## 背景

用户确认项目普通 number 默认千分位，只有显式声明时关闭，并要求直接在 format 表达，避免新增独立 grouping 开关。此前 number 与 number-0～5 不分组，number-grouped 则额外采用最多三位小数，不能直接替换而改变精度。

## 决策

普通数值展示默认分组，包括未配置格式的真实数字、number、number-0～5 和已有带符号格式；原精度、去尾零、舍入零、正负号、方向颜色保持。number 原始小数与科学计数表达不截断，number-grouped 及其带符号版本保持最多三位小数。

复用 format/defaultFormat 增加 number-ungrouped、number-0～5-ungrouped，以及 number-ungrouped-signed、number-1～5-ungrouped-signed；signed 仍在结尾，无 number-0-ungrouped-signed。新预设从6.123引入，旧页面不需要升级版本就采用新的默认分组。组件显式格式和字段默认的既有优先级保持，适用位置包括绑定、组件常量、数字参数和筛选文本引用。

这是对 ADR-0051 既有字段语义兼容原则的一次经用户明确确认的限定例外：旧页面随引擎使用新默认，不按版本分流；不构成其他语义变更的通用许可。变更前仓内已存在 number 精度格式，不能援用零使用例外。新格式以增量枚举表示可选差异，避免新主版本和整页结构迁移。

普通文本、显式 text、百分比/百分点、日期/期间及金额/数量自适应格式继续各自规则，不能仅按 JavaScript number 类型覆盖其显式格式。年份和数字编号若需要原样展示应显式 ungrouped。只修改展示文本，原值、查询、计算、排序、筛选、权限和导航传参不变。

共享格式解析同时服务屏幕与 XLSX。导出保留原始数值和数字类型，不能预先拼逗号字符串写回数据。复用既有精度条件格式去除整数小数点和舍入零符号，未限定精度的小于1e-6数值沿用科学计数以免精度截断。

## 验收

合成场景 `/pages/number-default-grouping` 覆盖默认、精度、显式关闭、符号、字段默认、组件常量、数字参数、图表与导出。存量 `/pages/number-precision-five`、`/pages/chart-number-format` 原 JSON 回放，并核对仓内页面校验与代表业务页面；静态、合成浏览器、XLSX 回读与真实 DQE/Relay 分层报告。
