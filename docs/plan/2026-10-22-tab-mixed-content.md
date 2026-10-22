# Tab 混合内容实施与验收

基线：`952b3a27`，独立分支 `codex/tab-mixed-content`。原工作区并行修改不纳入本批。用户完成 Q1–Q14 并授权落盘实施。

## 已确认规则

- Tab 接受全部普通内容组件和组合卡，不接受 reportHeader、Tab 嵌套；组合卡内部仍遵守自身白名单。纯容器不绑定数据。子内容禁止分区铺底。
- `props.contentLayout: "grid"` 显式启用已有 12 列布局；缺省保持旧纵向全宽布局，旧页面不迁移。新能力下限 6.32。
- 公共筛选作用相关查询；组件局部筛选独立保留，不新增 Tab 筛选栏。继续使用显式 filterId/绑定及现有独立查询源校验，不推断同名筛选、不同 Tab 不隐式共享局部条件。
- 绑定到同一字段的公共/局部条件取交集；不相交得到空结果，不得被 DQE 后写覆盖。规则集中在查询执行 Module，不在 Tab/图表各实现一遍。
- 数据首次进入按需查询，包含上游依赖；已访问面板保留挂载、图例、滚动和 AI 总结会话。切换本身不中断生成。
- 公共条件改变后当前内容立即更新，隐藏内容失效但延后读取。旧响应失效；AI 输入失效即中止旧流，重新激活并取得新数据后再生成。
- URL 使用 `tab.<componentId>=<tabId>` 保存活动页签；沿用已有筛选 URL。调用 navigation.replaceSearch，不刷新、不增加历史记录。多个容器互不覆盖，未知页签回退 defaultTab/首项，无关 URL 参数保留。URL 不保存数据、滚动、图例、总结。
- Report 导出全部 Tab，按捕获的条件补齐普通数据，只捕获已有 AI 文本，未生成则空态；Dashboard 不新增整页导出。嵌套文本链接、图表交互、AI 捕获随统一分发传递。

## 原型与 API 审核

- 一次性状态原型保存在分支 `codex/tab-mixed-content-prototype` 提交 `83409a8a` 的 `packages/engine/widgets/prototypes/tab-mixed-content.html`。进入 B→A→改年份→B 的演练确认：隐藏 B 标记过期、不立即请求，重新进入后只补查一次且区域保留。原型壳不进入产品分支。
- 现有 TabContainer 的 Snippet 内容槽可以扩展为受控选择与已访问面板保活，无需另造页签控件；复用 RuntimeSection 的栅格及直接布局盒，保留现有 Tab 外观。没有提出新的视觉样式。
- 图表局部筛选仍复用 ChartFilter，表格状态仍归 TableController/TableSession，AI 会话仍归已挂载 Host。SourceProgram 继续唯一执行查询、依赖与缓存。

## 实施阶段

1. 协议、能力版本、类型、合法/非法夹具及统一树遍历。
2. 活动页签状态/URL、依赖闭包按需读取、隐藏失效、查询交集。
3. 混合内容统一渲染、保活、栅格及导出。
4. Dashboard Playground、浏览器与行为测试、产品文档和仓外 local-authoring 校验。

## 验收记录

本地实施与验收完成，见[逐项验收与截图](../evidence/tab-mixed-content/acceptance.md)。

- Dashboard：`/pages/tab-mixed-content`；Report：`/pages/tab-mixed-content-report`。两页已注册目录。
- 产品协议与分发已更新至6.32；文档、15类内容正例、4类边界反例及local-authoring闭合。
- 核心回归、11项浏览器场景、仓外Skill、类型检查、31页校验、包与Playground生产构建通过。
- 内容栅格复用RuntimeSection的contentOnly模式，不创建内容分区身份、不叠加分区外壳；旧面板保留既有布局。
- 仅本地/仿真验证，不等同真实DQE、Relay、模型、内网和生产验收。保留独立worktree供审核；本批未请求commit/push，未运行远端CI。
