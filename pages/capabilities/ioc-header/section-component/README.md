# IOC Header 分区组件

使用静态合成候选与文字，无DQE服务要求。`pnpm dev:playground -- --host 127.0.0.1` 后访问：

- `/pages/ioc-header-section-placement`：首section含Header和正文；团队选乙后关闭“显示首分区”，两者一起消失；再打开，动态标题仍为B且URL保留team=B。
- `/pages/ioc-header-section-groups`：点“明细”隐藏含页头的概览分区；页级导航仍在，可切回；筛选不重置。
- `/pages/ioc-header-section-sticky`：紧凑Header与正文混排；向下滚动后页头持续吸顶，筛选可用；回顶恢复原位，无第二份控件。窄屏与嵌套滚动、ShadowRoot由浏览器测试覆盖。

新协议为6.81，不支持旧引擎。新页不声明页头时不补默认工具栏。旧根级及旧工具栏回归由契约夹具和浏览器覆盖，兼容虚拟分区不写回原文。导出不含交互或吸顶；条件隐藏不导出，分组按既有展开策略。

自动验收：`PLAYGROUND_BASE_URL=http://127.0.0.1:5189 node apps/playground/tests/ioc-header-component-browser.mjs`。此证据只覆盖本地产品与合成输入，不证明真实DQE、来源返回上下文或部署版本。
