# Tab 容器 tabContainer

在同一区域切换普通内容与组合卡。容器不绑定数据，每个子组件独立声明数据槽。

6.49 起支持全部普通内容组件及组合卡；不允许 reportHeader 和嵌套 tabContainer，组合卡内部继续遵守自身白名单，所有子组件禁止 layout.layer。`component` 与非空 `components` 二选一。

`props.contentLayout: "grid"` 复用12列栅格，子组件 layout.span 相对当前面板生效；省略时保留旧纵向全宽，不修改已有页面布局。

同一页签包含多个组件时，面板随内容自然展开，不建立额外滚动区域；compact 容器在多内容页签激活时也随内容增高，切回单组件页签恢复原有紧凑高度。各表格保留自身的滚动、分页与交互状态。可观察场景：Playground `/pages/tab-multiple-tables`（内联合成数据，覆盖默认、compact、analysisStack 及 grid，含宽窄屏和单/多表切换）。

首次进入只读取当前内容所需数据与上游依赖；已访问面板保持挂载，切换保留图例、滚动、表格状态和AI总结会话。公共条件改变使相关隐藏数据失效，重新进入后补查，迟到响应不得覆盖新条件。AI输入失效立即中止旧流，重新取得数据后再生成；单纯切换不重新生成。

页面公共筛选与组件局部筛选继续通过显式绑定消费，不新增Tab筛选栏；独立筛选控件使用各自 filterId 和独立查询源，沿用现有单图隔离校验。同字段公共/局部查询条件取交集，不相交按空结果处理。

活动项由 `tab.<组件id>=<页签id>` 保存，复用 navigation.replaceSearch（替换历史、不刷新）；局部筛选沿用筛选URL。多个容器互不覆盖，未知页签回退 defaultTab 或第一项，无关参数保留。URL不保存结果、滚动、图例或AI文本。

Report整页导出按声明顺序展开全部Tab，补齐普通数据，只捕获已有AI文本，未生成则空态；Dashboard不新增整页导出，表格Excel保留自身范围。可观察入口：[混合内容](../examples/tab-mixed-content.json)，Playground `/pages/tab-mixed-content`。Report验收入口 `/pages/tab-mixed-content-report`。使用本地DQE Sim，不证明真实DQE或Relay接入。

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

该配置是页面实例的初始呈现输入，由统一运行时消费集成应用传入的 `initialSearch`。纯呈现组件不读取浏览器地址。6.48及以前的页面初始化后用户可自由切换，切换不回写 URL；筛选更新与数据刷新不重新应用初值。新建页面实例或显式改变 `initialSearch` 时重新初始化。不新增页面参数声明，不改变查询执行和报告导出的既有全 Tab 展开行为，也不负责自动滚动到容器。

来源页面必须使用目标容器公开的参数名和 Tab id。固定值写在 `href` 中，动态值使用既有 `query` 的 row / param / filter 显式绑定；配置方法见[链接传参与目标页签](../actions-and-navigation.md#链接传参与目标页签)。普通导航不加载目标页面校验其配置；目标 Tab 改名或删除后，旧链接按上述规则回退，应同步更新引用它的来源页面。

创作工具的 `add_tab_container` 可直接声明 `initialTabUrlParam`；`set_properties` 可修改它和 `defaultTab`。写入 URL 初值字段时自动采用当前写出版本，普通标题编辑保留已有配置，冲突或非法页签配置由完整页面校验拒绝。

完整场景为 `tab-url-initialization`，来源页面为 `tab-url-source`。两页均使用内联演示数据，仅验证链接和页签行为。

6.35条件呈现及相关限制见[条件显隐](../conditions.md)；子项全部隐藏不自动收起父容器。

6.49起声明混合内容或显式grid的容器使用 `tab.<组件id>` 保存活动项，优先于 `initialTabUrlParam` 的合法初值；旧表格容器仍按显式参数只初始化、不回写。两个入口均拒绝重复键并回退默认页签。独立筛选使用当前 `filterGroup` 组件，Tab内容包括已存在的筛选按钮组和受控按钮，仍遵守各自布局形态与动作约束。
