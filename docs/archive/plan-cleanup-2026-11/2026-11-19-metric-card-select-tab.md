# 指标值切换同页 Tab

Schema 6.126 支持在指标行上绑定单个点击动作。鼠标和键盘都可触发，切换保留已应用筛选和页面实例。

## 已确认声明

在 `metricCard.props.rows[]` 或 `metricCard.props.secondaryRows[]` 上声明 `action`。首版唯一动作是 `on: "click"` 和 `selectTab`。目标引用同页的 `tabContainer.id` 及其 `props.tabs[].id`。

```json
{
  "label": "商务闭环率",
  "valueField": { "data": "main", "field": "businessClosureRate" },
  "action": {
    "on": "click",
    "selectTab": { "componentId": "detail-tabs", "tabId": "business" }
  }
}
```

每个指标值可分别指定页签。多行也可以显式指向同一目标。指标值为零时可操作，缺失值显示占位。

## 卡片级与指标级动作

现有 `link: true` 是指标行对卡片级 `props.actions` 的显式引用，继续支持导航和详情。行级 `action` 自带点击入口，卡片可同时包含使用行级动作的指标和复用卡片级动作的其他指标。同一行同时声明 `action` 与 `link: true` 时，在该行的 `link` 报错。移除该行的 `link: true` 即可使用行级动作。切换页签通过指标行声明。

也可以用卡片级 `actions` 配上额外行标识做映射，但会增加交叉引用与校验。采用行级 `action` 后，跳转或表格筛选可以作为后续显式确认的动作分支。现有 URL 导航配合 `initialTabUrlParam` 仍可用于打开页面时指定初始页签。

## 运行与验收

行级动作复用手动切换页签的状态更新、数据激活和缓存。当前已经选中目标，或目标因条件与分区选择不可见时，保留当前状态。页内切换由引擎完成。

活动页签属于运行时状态。`params` 与 `initialTabUrlParam` 在初始化时读取。支持地址同步的容器沿用 `tab.<组件id>` 和 `tab-change`。Embed 默认回写地址，RuntimeView 可以接入 `replaceSearch`。旧纯表格容器继续沿用原规则。

`/pages/metric-card-select-tab` 演示同卡主、次指标绑定不同页签，以及同卡保留一个旧详情入口。`/pages/rep-office-execution-efficiency-tab-demo` 演示 IOC 原布局下的指标行级联动。两页均使用合成数据。
