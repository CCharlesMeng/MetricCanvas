# 交互与导航

受控action支持写筛选与导航。writeFilter目标须存在且类型匹配；表格selection只把受控字段/固定值映射到允许目标。URL导航使用目标页面公开参数名，保留标准anchor能力，宿主可选择接管。

表格列selection与link同时存在时selection优先。行导航只在声明的入口列触发。当前页字段、目标页面参数和筛选器id不能靠同名猜映射。文本链接与普通URL不开放脚本执行。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](README.md)。

## 当前内容工具边界

#137只开放add/update/remove_dimension_filter、set/remove_table_link五项原子操作。筛选声明和完整绑定集合一起修改；仅现有DQE dimension queryField，不改原查询body/order/initial，也不借此创建params、initialParam、paramBindings或层级筛选。悬空级联、参数或导航引用阻止删除。

表格链接可定位Tab子树/分组列；必须显式给出安全href及非空row/param/filter映射。selection抢占、多navigate歧义或共享目标不一致会拒绝；删除最后链接时清导航并保留其它动作。它不是通用actions或表头筛选编辑器。

`t11-evidence.md`记录两形态真实Chrome→createDqeGateway→本地HTTP，选择/清空raw_region、未绑定表格保留，以及真实anchor跳转携row/param/filter/fixed/hash。实际外部DQE、权限及目标业务页仍待独立联调。源码定位：`metriccanvas-authoring/tool/metriccanvas_authoring/pages/editing/interaction_editing.py`、`page_editing.py`，公开回归`test_content_interactions.py`。

<a id="链接传参与目标页签"></a>

## 链接传参与目标页签

现有 URL 导航允许在 `href` 中配置固定查询参数，并用 `query` 显式绑定动态来源。文本组件的 `props.links[]`、表格列的 `navigate` 和组件动作中的 `navigate` 使用同一目标结构；行字段来源只在有当前行的入口适用。

```json
{
  "label": "查看销售明细",
  "href": "/pages/tab-url-initialization?sales-tab=detail#tabs"
}
```

上例为文本组件的一项链接；目标容器配置 `initialTabUrlParam: "sales-tab"`，且声明 `id: "detail"` 的 Tab。该初值接收能力自 6.33 起支持，来源侧链接传参为既有能力。

动态链接的 `query` 键是**目标页面公开的 URL 参数名**，绑定内容指向**当前来源页**的页面参数、筛选器或行字段。以下为一项文本链接（来源页须声明 `preferred-tab` 参数）：

```json
{
  "label": "按参数打开页签",
  "href": "/pages/tab-url-initialization",
  "query": { "sales-tab": { "source": "param", "id": "preferred-tab" } }
}
```

| 取值来源 | `query` 单项配置示例 | 适用条件 |
|---|---|---|
| 固定值 | 写入 `href`，例如 `?sales-tab=detail` | 固定入口；`query` 不提供 literal 分支 |
| 页面参数 | `{"source":"param","id":"preferred-tab"}` | 来源页已声明该参数 |
| 筛选状态 | `{"source":"filter","id":"tab-choice"}` | 来源页已声明筛选器；范围使用 `part: "from" / "to"`，层级可用 `part: "level"` |
| 当前行字段 | `{"source":"row","field":"tab-id"}` | 表格链接等有当前行数据的入口；字段须为可传参的标量 |

运行时只携带显式配置的值，保留 `href` 中其他静态参数和 `#` 锚点。有有效动态值时覆盖同名静态参数，并按普通 URL 编码；数组写成重复键，缺值时保留原静态值。Tab 初值仅接受单个合法 id，因此多选筛选器输出多个同名值时会回退默认页签。

参数位于 URL 的标准查询部分；`/#/detail?sales-tab=detail` 的 hash 内参数不会被引擎自动解析。集成应用负责将目标 URL 的查询部分作为 `initialSearch` 传给渲染引擎，并保持普通 anchor 的打开新标签页等能力。

目标页签的优先级、异常回退、命名互斥和初始化边界由 [Tab 容器](components/tabContainer.md#url-初始化页签633)维护。完整可运行的双页配置见 `tab-url-source` 与 `tab-url-initialization`，完整示例由本模块索引分发；目标部署路径由集成应用提供，不由本仓页面 id 推断。

6.34新增的就地条件与层级状态语义见[条件显隐与动作资格](conditions.md)，旧页面原有行为保持。
