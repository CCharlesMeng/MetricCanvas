# dev-baseline — IOC 选择控件

基线源：用户确认的文字规格，见 story-delta-frontend-design.md。确认：2026-10-20，用户“ok，落地实施”；此前默认搜索、单行标签、官方风格、描边加减号与灰线已明确，树形单选已实际演示。无需重复请求相同批准。

## 执行起点（环境）

独立检出 /Users/moon/.codex/worktrees/ioc-selection/DataDashboard，base-ref=952b3a273f0f4f8be5820f5af1bb76c2f5afa513。正式实施文件均起点干净。主工作区并行改动不复制。框架 Svelte5，组件库 packages/ui；其余包是该公共构件的消费/声明接线，不另起 app。浏览器为现有 CUA IAB + 仓内 Playwright 测试。数据为本地合成 fixture。

## 工程依据

采用 PATTERN-STRUCT-1、PATTERN-COMP-1、PATTERN-STYLE-1、PATTERN-RUN-1、PATTERN-TEST-1。公开入口和单向受控状态；保持官方样式局部注入；不引入 Vue 运行依赖。

## 已知边界

不实施候选远程搜索/懒加载，不改变业务父级查询范围；旧路径契约与显式 parentValue 并存。线上候选、DQE/Relay/CloudIOC 及生产部署均不在本次本地验收声明内。6.32 是本检出实际可写版本，若之后交付与其他版本演进合并，按能力重新分配并重生成。

## 冻结 QA 基线

规格勘察与代码勘察均由独立只读角色完成；采用 PATTERN-DATA-1。用户已批准上文规格，无新增待决问题。

| 编号 | 判定对象 | 触发方式 | 期望表现 |
| --- | --- | --- | --- |
| F3-1 | 搜索 | 名称、编码、路径含首尾空白和大小写 | 只过滤候选，保留祖先/已选值；URL、查询不变；关闭搜索后无输入 |
| F3-2 | 多标签 | 横向滚动后删除一项 | 高度不变、单行可滚动、只移除对应稳定值 |
| F3-3 | 树规则 | 树单选、父级展开、independent/descendants/leaf | 单选替换并关闭；展开不提交；存量父选全部候选后代；显式策略不混用 |
| F3-4 | 边界 | 禁用、候选 loading/empty/unavailable/error、未知已选、非法父关系 | 不允许禁用写入，状态可区分；未知已选仍回显；层级错误不猜码 |
| F4-1 | 页面协议与状态入口 | 旧版本新字段、单选多值 default/initialParam/URL/write/detail | 版本门拒绝；初始拒绝；非法 URL 不覆盖初值；非法写入不提交 |
| F4-2 | 分发 | 从产品真源生成后复制 Skill 到仓外验证 | 生成无漂移，示例/知识/校验器闭合，不依赖仓库相对路径 |

官方风格的可判部分随 AT4 的组件浏览器测试验证；不把官网整页像素比对列为已完成声明。无人工代签项。新增页面/组件不存在于起点，免造环境型 RED；既有能力起点缺口经只读源码审查确认：Select无搜索，DimensionFilter树无搜索且固定多选。首次测试 RED 记录保留于 evidence/logs/，包括标签换行缺口与修复后的同一断言。

连带文件：packages/engine/runtime-ui/src/report-theme-properties.ts 由 report-pdf:build 从新增选择样式变量重生成，保障导出主题自洽；reference-map.json 增加字段/版本与合法示例说明，所有契约产物在隔离检出生成。
