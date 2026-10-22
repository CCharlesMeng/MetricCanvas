# pages/capabilities/navigation

页面由 JSON 自动发现。本文件仅记录使用说明，不参与渲染或注册。

## 内容导航与局部状态保留

入口：`/pages/ioc-content-navigation`；[页面 JSON](ioc-content-navigation.json)。

启动：`pnpm dev:playground`。

切换内容分区，再返回原分区，检查明细的局部状态仍然保留。

合成演示

可直接体验

1. 进入分区 A，操作明细表的分页。
2. 切到分区 B 再返回 A，查看原局部状态。

匿名合成行集用于演示内容导航；不作为 IOC 业务页面或真实数据验收。

关键声明：`sectionGroups`, `sectionAnchors`。

关联：[ioc-opportunity-analysis](../../business/dashboard/ioc/opportunity/ioc-opportunity-analysis.json)。

## 指定目标页签的跨页导航｜来源页

入口：`/pages/tab-url-source`；[页面 JSON](tab-url-source.json)。

启动：`pnpm dev:playground`。

通过固定值、页面参数或当前行字段生成链接，进入目标页指定的独立页签。

合成演示

可直接体验

1. 点击固定打开明细与已关闭工单，观察目标页两个 Tab 容器的选中项。
2. 返回后用页面参数或表格行入口再次跳转，对照目标 URL。

跨页参数只携带显式绑定内容；无效、空值或重复值按目标页默认规则回退。

关键声明：`params`, `sections[].components[].props.links`。

关联：[tab-url-initialization](tab-url-initialization.json)。

关联：[demo](../layout/demo.json)。

## URL 初始化独立 Tab 容器｜目标页

入口：`/pages/tab-url-initialization`；[页面 JSON](tab-url-initialization.json)。

启动：`pnpm dev:playground`。

从 URL 初始化两个独立 Tab 容器；手动切换互不影响，刷新后重新应用 URL 初值。

合成演示

可直接体验

1. 建议先从关联来源页进入，核对销售明细和已关闭工单分别选中。
2. 手动切换销售页签，检查工单页签不变、地址不变；刷新重新应用 URL。

URL 仅提供初始化输入；未声明参数不生效，无效或重复值回退默认页签。

关键声明：`sections[].components[].props.initialTabUrlParam`。

关联：[tab-url-source](tab-url-source.json)。
