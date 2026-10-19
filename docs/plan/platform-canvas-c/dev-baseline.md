# dev-baseline — Platform C

| 字段 | 值 |
| --- | --- |
| Story / repo | US20261019 / DataDashboard |
| 基线源 | 用户确认 C 的运行原型，冻结为渲染 HTML 与 screenshot |
| 冻结状态 | 已冻结 ✅；用户当前消息“可以，开始实施” |
| 确认时间 | 2026-10-19，Asia/Shanghai |
| 执行档位 | standard；还原 T1，共享边界，计划文件超过5 |
| app baseline | apps/platform/frontend-baselines；结构/组件/样式/测试 |
| 设计事实 | design-spec/design-facts.json |
| 声明状态 | 初始 UNVERIFIED，逐条状态由 alpha-tests.md 记录 |

## 执行起点（环境）

base-ref 为 7ec7bb855273d76e54034104a88585f2953a5420；本会话第一阶段 diff 已在同工作树生成、未与其他任务混合。当前回合实现前记录 tracked diff 的 SHA256，后续因果证据以该实际起点与冻结契约为准。原型及页面是静态演示，使用受控页面资产/保存端口；测试不会声明真实服务联调。

## 工程依据

采用 PATTERN-STRUCT-1、PATTERN-COMP-1、PATTERN-STYLE-1、PATTERN-TEST-1、PATTERN-DATA-1；详见代码侧只读勘察回传。

## QA 基线

### 已知缺口

冻结的是 Svelte 原型运行后的 HTML，而不是未执行的入口 shell；脚本抽取只消费冻结 HTML。用户批准覆盖静态结构和选框方向，正式实现额外验证跟随/裁切和无泄漏。机器可检事实与截图分别记录；不以受控端口替真实外部服务。

### 豁免表

无。

### 变更记录

2026-10-19：C 结构与蓝色微渐变边框经过用户确认后进入实施，不重新开放已决设计。

## 验证组合（初始）

执行档位：**standard**（还原 Task：T1；阻断触发器：shared-boundary；文件数：16/5）

| 风险触发器 | 来源 | 模块 | 独立检视与维度 | 依赖声明 |
| --- | --- | --- | --- | --- |
| async-state, interaction, shared-boundary, visual | visual: plan；interaction: plan；shared-boundary: plan；async-state: agent | causal, targeted-quality, render, regression, review-layout, review-convention, review-quality | review-layout: L1, L2, L5；review-convention: C5；review-quality: Q2, Q5 | AT-01(mock), AT-02(mock), AT-03(mock), AT-04(mock), AT-05(mock) |

### 抽取覆盖补齐

- at 规则：24。整块跳过；@media 内的响应式取值与 @layer / @container 内的声明全部不可见
- 行内 style 属性：9。行内声明不参与类 → 声明映射，这些元素的尺寸与间距不可见
- 非单类选择器：1320。伪类、后代与组合选择器只登记不解析，R4 状态样式取不到期望值

以上是工具覆盖缺口，不改变用户已批准的 C。当前确认语句授权实施该已显示原型；伪元素渐变/内联定位的期望由独立的已批准原型浏览器计算样式事实补齐，正式实现取证不能反向补期望。

## 起点变更指纹

0aef5a374b29b59ee941c58c687e9232eeed0b279502bae2c76f87c06818735d

## 规格侧与代码侧勘察结论

独立规格侧与代码侧均只读完成，无需重新决策。代码侧复核 STRUCT/COMP/STYLE/TEST/RUN；未新增请求/持久化规则，不强选 DATA。主要风险为 attachment 重跑清理、单个 RuntimeSurface 会话、滚动裁切和 capture 点击隔离；由 AT-03～05 覆盖。

### R1 — 结构

| 编号 | 判定对象 | 具体期望 | 取证方式 |
| --- | --- | --- | --- |
| R1-1 | 组件属性入口 | 返回清单与类型标识各一个；摘要卡、重复标题、技术ID和侧栏移动/删除各零；标题输入仍可编辑 | render，AT-01 |
| R1-2 | 画布就地操作条 | 当前选择一个操作条，标题一个，上移/下移/删除三个按钮 | render，AT-04 |
| R1-3 | 搭建边界 | 编辑单选边界一个，正式渲染/预览边界和操作条均零 | render，AT-02/05 |

### R2 — 文案

| 编号 | 判定对象 | 具体期望 | 取证方式 |
| --- | --- | --- | --- |
| R2-1 | 属性入口 | ‹ 全部组件、文本属性；组件配置/页面设置顺序不变 | render，AT-01 |
| R2-2 | 就地操作条 | ↑ 上移、↓ 下移、删除 | render，AT-04 |

### R4 — 状态样式

| 编号 | 判定对象 | 具体期望 | 取证方式 |
| --- | --- | --- | --- |
| R4-1 | 蓝色细框 | 元素圆角6px，描边层padding1.5px、pointer-events:none，蓝色118deg渐变、极淡底色及轻阴影精确取自源rendered-facts.json | render，AT-02 |

### F3 — 交互边界

| 编号 | 判定对象 | 具体期望 |
| --- | --- | --- |
| F3-1 | 排列 | 首/末禁用，不跨分区，上移/下移插槽正确 |
| F3-2 | 删除与保存 | 删除改变副本，撤销恢复，显式保存前无写；最后组件拒绝 |
| F3-3 | 输入 | 属性输入Delete不删除组件 |
| F3-4 | 定位 | 切换/尺寸/滚动时跟随，目标完全不可见或编辑停用则隐藏 |
| F3-5 | 渲染边界 | 预览/正式渲染不出现创作装饰 |
| F3-6 | 数据状态 | 不重建渲染会话、不新增查询、不重置分页 |
| F3-7 | 生命周期 | 卸载后无残留浮层或回调异常 |

## 起点质量

实施前 metric-canvas/platform 的 check 均通过，失败集合为空。真实浏览器 Chrome/Playwright 可打开批准原型、切换状态和采集截图。来源计算样式的补采已在改变产品前完成，facts 文件为后续规则唯一数值来源；规格侧原始 radius 指的是元素而非伪元素，adapter 对元素取样，不把伪元素的7px误判为元素6px。
