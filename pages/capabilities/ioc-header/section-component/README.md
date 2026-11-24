# IOC Header 分区组件

使用静态合成候选与文字，无DQE服务要求。`pnpm dev:playground -- --host 127.0.0.1` 后访问：

- `/pages/ioc-header-filter-rows`：首行显示「显示审核筛选」，以下依次显示「记录范围」和「审核筛选」。选中「包含审核记录」后关闭「显示审核筛选」，审核行消失。再次开启，审核行恢复且选值保留。缩窄窗口时逐行换行。自动回归为 `pnpm --filter playground test:ioc ioc-header-layout.browser.ts`。使用静态合成筛选，无外部数据服务。
- `/pages/ioc-header-section-placement`：首section含Header和正文；团队选乙后关闭“显示首分区”，两者一起消失；再打开，动态标题仍为B且URL保留team=B。
- `/pages/ioc-header-section-groups`：点“明细”隐藏含页头的概览分区；页级导航仍在，可切回；筛选不重置。
- `/pages/ioc-header-flow-sticky`：仅标题与期间的普通页头，没有重点国代控件。标题后不保留固定列；向下滚动后固定在页面顶部。独立页头分区使用原生吸顶，连续往返滚动时页头始终位于顶部，正文照常滚动；修改期间后回顶仍保留选值。
- `/pages/ioc-header-section-sticky`：紧凑 Header 与正文混排；窄屏多控件自然换行，主体无横向或纵向滚动条。向下滚动后持续吸顶，筛选可用；回顶恢复原位，无第二份控件。嵌套滚动、ShadowRoot 与静态导出沿原组件验收入口覆盖。
- `/preview?prototype=ioc-header-component` 选择“公共页头与 Mount 滚动区域”：复用 `ioc-header-section-sticky` 完整合成页面，经 ShadowRoot 挂载到公共页头下方的滚动区域。向下滚动后 IOC 页头应停在 Mount 滚动区域顶部，公共页头保持可见；回滚后恢复原位。真实 `MetricCanvas.mount`、外层 ShadowRoot 及区域尺寸变化由 `packages/embed/tests/browser/ioc-header-mount.spec.ts` 回归。此场景验证既有嵌套滚动语义的边界识别修复，不新增页面声明，也不证明真实集成应用接线。

分区组件页头由 Schema 6.81 引入。新页不声明页头时不补默认工具栏。旧根级及旧工具栏回归由契约夹具和浏览器覆盖，兼容虚拟分区不写回原文。导出不含交互或吸顶；条件隐藏不导出，分组按既有展开策略。

自动验收：`PLAYGROUND_BASE_URL=http://127.0.0.1:5189 node apps/playground/tests/ioc-header-component-browser.mjs`。此证据只覆盖本地产品与合成输入，不证明真实DQE、来源返回上下文或部署版本。

布局与吸顶回归：`pnpm --filter playground test:ioc ioc-header-layout.browser.ts`。切换普通/紧凑、宽/窄屏，检查首行折叠展开、单实例吸顶、回顶状态和页头内部滚动条。正文使用合成文字，无需数据服务。

吸顶层级回归使用 `/pages/ioc-header-section-sticky`。集成应用层级为 4900 的模拟下拉应能覆盖吸顶页头并接收点击，IOC 筛选候选仍可弹出与选择。嵌套滚动使用 `/preview?prototype=ioc-header-component` 的「公共页头与 Mount 滚动区域」模式，滚动容器非等比缩放后页头仍贴齐滚动区域内边缘。

打开 `/pages/ioc-header-flow-sticky`，在季、月、年模式中分别选择 2025 年 Q3、2023 年 8 月、2024 年。切回任一模式，应恢复该模式已应用的完整期间。首次访问的模式从当前期间推导。尝试输入未来月份，确认出现校验提示，切换模式后返回月仍恢复 2023 年 8 月。刷新只恢复当前已应用期间。用 `pnpm --filter playground test:ioc ioc-period-memory.browser.ts` 运行浏览器回归。该场景使用本地合成数据。

标题跳转（6.115）：打开 `/pages/ioc-header-title-link?project=P002`，标题保持 24px/700 并链接到 `/pages/ioc-header-title-link-target?source=header&project=P002#details`；布尔筛选未选中时沿既有导航规则不写入 URL，目标默认 false；勾选“已审核”后目标携带 `reviewed=true`。用鼠标或 Tab/Enter 激活标题，目标显示项目号与审核值，页头返回可回到来源。取消“允许标题跳转”后标题不可点击；取消“显示标题链接”后仍显示普通标题文字。可复制链接或在新标签页打开；静态导出只显示文字。沿用本目录启动方式，无账号、网络数据或 DQE 要求；地址与内容均为本地合成验收，不证明真实业务集成。自动回归：`pnpm --filter playground test:ioc ioc-header-title-link.browser.ts`。
