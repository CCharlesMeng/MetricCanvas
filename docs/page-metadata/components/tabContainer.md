# Tab 容器 tabContainer

在同一卡位切换多张表格,不占用额外栅格行。适用于概览 / TOP / 丢单这类互斥表格需要共用一块区域。数据形状：不绑定页面数据源；每个 Tab 内的表格自己声明数据槽。

活动面板只呈现声明Tab，子组件类型受限；切换不生成另一份页面文档。嵌套边界由Schema分支限定，不能递归塞任意容器。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](../README.md)。

<a id="url-初始化页签633"></a>

## URL 初始化页签（6.33）

每个容器可用 `props.initialTabUrlParam` 声明自己的公开 URL 参数名。参数值必须精确匹配 `props.tabs[].id`，不使用标签或数组下标。以下片段属于容器的 `props`，需与 `tabs` 一起配置：

```json
{ "defaultTab": "overview", "initialTabUrlParam": "sales-tab" }
```

打开 `?sales-tab=detail` 时初始选中 `id: "detail"`。优先级为单个合法 URL 值 → `defaultTab` → 第一个 Tab。参数缺失、空字符串、重复键（即使值相同）、未知 id 均回退；不修剪值、不忽略大小写。URL 按普通查询参数解码一次；未声明接收参数的容器保持原行为。

同页多个容器使用不同参数名，例如 `?sales-tab=detail&support-tab=closed`。参数名不得与本页页面参数 id、筛选器实际 URL 参数名（包含别名、范围与层级分量）或其他容器的 `initialTabUrlParam` 重复，冲突在页面校验时拒绝。

该配置是页面实例的初始呈现输入，由统一运行时消费集成应用传入的 `initialSearch`。纯呈现组件不读取浏览器地址。初始化后用户可自由切换，切换不回写 URL；筛选更新与数据刷新不重新应用初值。新建页面实例或显式改变 `initialSearch` 时重新初始化。不新增页面参数声明，不改变查询执行和报告导出的既有全 Tab 展开行为，也不负责自动滚动到容器。

来源页面必须使用目标容器公开的参数名和 Tab id。固定值写在 `href` 中，动态值使用既有 `query` 的 row / param / filter 显式绑定；配置方法见[链接传参与目标页签](../actions-and-navigation.md#链接传参与目标页签)。普通导航不加载目标页面校验其配置；目标 Tab 改名或删除后，旧链接按上述规则回退，应同步更新引用它的来源页面。

创作工具的 `add_tab_container` 可直接声明 `initialTabUrlParam`；`set_properties` 可修改它和 `defaultTab`。写入 URL 初值字段时自动采用当前写出版本，普通标题编辑保留已有配置，冲突或非法页签配置由完整页面校验拒绝。

完整场景为 `tab-url-initialization`，来源页面为 `tab-url-source`。两页均使用内联演示数据，仅验证链接和页签行为。

6.34条件呈现及相关限制见[条件显隐](../conditions.md)；子项全部隐藏不自动收起父容器。
