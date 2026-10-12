# dev-baseline — IOC 内容切换与锚点

基线源：主计划 C3/F4、B2 及本 Story 文字规格。业务行为已由用户确认，2026-09-29授权实施并继续；本次不增加像素还原承诺。工程勘察、QA映射与UI实现已执行；下方历史验证记录按时间保留，最新证据见alpha-tests与evidence。

## 执行起点（环境）
base-ref: 6954c77d。已有修改归属本会话的C1/C2/C5及前轮表格修复，禁止将另一会话提交归为本Story。浏览器目标为apps/playground，普通页面实例，匿名inline行集。协议/engine最近独立范围通过797项，生成契约的两个测试文件待最后同步；后续新增计算/混合图另有定向验证。

## 工程依据
勘察基准 main@6954c77d；app baseline: apps/playground/frontend-baselines。

| 责任 | 选定规范 | 已核实落点 |
|---|---|---|
| 框架无关协议 | PATTERN-STRUCT-1 | page/schema/page、validate、version |
| 既有渲染树和局部状态 | PATTERN-COMP-2、PATTERN-DATA-2 | RuntimeSurface tableViews，不因切组调用 run |
| 隐藏表筛选重置 | PATTERN-DATA-4 | table-state 遍历全部组件 |
| 页面内定位 | PATTERN-ROUTE-1 | 不使用跨页导航端口 |
| 样例路由 | PATTERN-ROUTE-2 | playground glob pages/*.json |
| 按钮与焦点 | PATTERN-STYLE-1、PATTERN-STYLE-2、PATTERN-STYLE-5 | 使用既有 token，无外部像素规格 |
| 测试 | PATTERN-TEST-1、PATTERN-TEST-2、PATTERN-TEST-4、PATTERN-RUN-1 | Vitest纯逻辑、embed Playwright浏览器 |

组合接缝：sectionsContent 必须接收所选组可见 sections；默认分区保持挂载并用 hidden 控制。锚点仅在当前页面根内定位。
基线路径漂移：PATTERN-DATA-3 的 runtime/package.json 应为 packages/engine/package.json；RUN-16 的 test 前置实际为 playground sync。

## QA 基线

来源指纹：story-delta-frontend-design.md SHA-256 `31de8fd25a3fee820c9699aa5a9fcda685a4eda3b03d6e5b2c1165878360c389`。只读规格勘察返回行为映射，沿用用户已确认授权；匿名标签不是业务文案。区块名称为内容组选择区、章节锚点区、内容分区区。没有外部视觉数值，不增加像素还原承诺。

| 编号 | 判定对象 | 具体期望 | 取证方式 |
|---|---|---|---|
| R1-1 | 内容组选择区 | 每个声明组一个有名称的按钮，名称取组label | 浏览器fixture |
| R1-2 | 内容分区区 | 只显示所选组；未归组一直显示；顺序按文档 | 浏览器fixture |
| R1-3 | 章节锚点区 | 每个声明锚点一个有名称的入口，名称取label | 浏览器fixture |
| R1-4 | 无导航声明对照 | 不出现导航控制，既有分区全部显示 | 对照fixture |
| R6-1 | 导航控制窄屏 | 不横向溢出、不重叠、不截断；标签允许换行；不定义产品断点 | 375px浏览器fixture |
| F3-1 | 引用校验 | 不存在、重复归组、无效默认组、无效锚点均拒绝 | AT-01 |
| F3-2 | 初始选择 | 显式默认或第一组，公共分区始终显示 | 单元测试 |
| F3-3 | 切组回切 | 页码、排序、局部筛选保留且组间隔离 | AT-02 |
| F3-4 | 全页筛选 | 可见与隐藏组受影响表回第一页，排序/局部筛选保留 | AT-03 |
| F3-5 | 隐藏锚点 | 先显示目标组再定位 | AT-04 |
| F3-6 | 键盘 | 按钮可键盘激活，定位后焦点在章节 | 浏览器fixture |
| F3-7 | 副作用 | 切组/定位不增加查询、URL或history条目 | AT-04 |
| F3-8 | 实例隔离 | 新页面实例不继承前实例选择 | 浏览器fixture |
| F3-9 | 大列表 | 后续页行集执行上述状态验证 | 25行fixture |

豁免：无。已知缺口：可选requirement-frontend-design.md不存在；文字规格已给出行为，不追加业务问题。区块名称只用于验收定位，不增加UI。

2026-09-29：实现前纯逻辑测试通过；浏览器首次运行通过切组页码/排序、隐藏组搜索重置、第21行、键盘锚点焦点、无POST/URL/history变化及375px导航容器无横向溢出。局部筛选、实例隔离、重叠/截断仍待补充；不能将一次浏览器通过等同于全部QA声明完成。

2026-09-29 12:30：补充两个query-backed实例、局部列筛选、入口组参数、375px长标签换行/边界/不重叠/不截断、无导航对照。详见浏览器场景和原始几何工件。入口参数消费者遗漏曾触发页面校验错误，修复后同一场景转绿。

2026-09-29 复核补记：上述来源指纹保留为初始规格历史。追加入口组参数后的当前规格 SHA-256 `d1707888da73f0ee44f2009ef33e19eb279b5f872bb0eaccdc3edba8e3c99487`；沿用交接已确认的入口参数语义。浏览器实际设施为embed fixture server。补采 selected/focus 计算样式与截图见BE-2，产品代码指纹不变。
