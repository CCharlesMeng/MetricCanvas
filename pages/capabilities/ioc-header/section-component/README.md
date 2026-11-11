# IOC Header 分区组件

使用静态合成候选与文字，无DQE服务要求。`pnpm dev:playground -- --host 127.0.0.1` 后访问：

- `/pages/ioc-header-section-placement`：首section含Header和正文；团队选乙后关闭“显示首分区”，两者一起消失；再打开，动态标题仍为B且URL保留team=B。
- `/pages/ioc-header-section-groups`：点“明细”隐藏含页头的概览分区；页级导航仍在，可切回；筛选不重置。
- `/pages/ioc-header-flow-sticky`：仅标题与期间的普通页头，没有重点国代控件。标题后不保留固定列；向下滚动后固定在页面顶部。吸顶后连续小幅往返滚动，页头应始终位于顶部，不等待滚动停止才回正；修改期间后回顶仍保留选值。
- `/pages/ioc-header-section-sticky`：紧凑 Header 与正文混排；窄屏多控件自然换行，主体无横向或纵向滚动条。向下滚动后持续吸顶，筛选可用；回顶恢复原位，无第二份控件。嵌套滚动、ShadowRoot 与静态导出沿原组件验收入口覆盖。
- `/preview?prototype=ioc-header-component` 选择“公共页头与 Mount 滚动区域”：复用 `ioc-header-section-sticky` 完整合成页面，经 ShadowRoot 挂载到公共页头下方的滚动区域。向下滚动后 IOC 页头应停在 Mount 滚动区域顶部，公共页头保持可见；回滚后恢复原位。真实 `MetricCanvas.mount`、外层 ShadowRoot 及区域尺寸变化由 `packages/embed/tests/browser/ioc-header-mount.spec.ts` 回归。此场景验证既有嵌套滚动语义的边界识别修复，不新增页面声明，也不证明真实集成应用接线。

新协议为6.81，不支持旧引擎。新页不声明页头时不补默认工具栏。旧根级及旧工具栏回归由契约夹具和浏览器覆盖，兼容虚拟分区不写回原文。导出不含交互或吸顶；条件隐藏不导出，分组按既有展开策略。

自动验收：`PLAYGROUND_BASE_URL=http://127.0.0.1:5189 node apps/playground/tests/ioc-header-component-browser.mjs`。此证据只覆盖本地产品与合成输入，不证明真实DQE、来源返回上下文或部署版本。

布局与吸顶回归：`pnpm --filter playground test:ioc ioc-header-layout.browser.ts`。切换普通/紧凑、宽/窄屏，检查首行折叠展开、单实例吸顶、回顶状态和页头内部滚动条。正文使用合成文字，无需数据服务。
