# Tab 容器 tabContainer

在同一区域切换普通内容与组合卡。容器不绑定数据，每个子组件独立声明数据槽。

6.32 起支持全部普通内容组件及组合卡；不允许 reportHeader 和嵌套 tabContainer，组合卡内部继续遵守自身白名单，所有子组件禁止 layout.layer。`component` 与非空 `components` 二选一。

`props.contentLayout: "grid"` 复用12列栅格，子组件 layout.span 相对当前面板生效；省略时保留旧纵向全宽，不修改已有页面布局。

首次进入只读取当前内容所需数据与上游依赖；已访问面板保持挂载，切换保留图例、滚动、表格状态和AI总结会话。公共条件改变使相关隐藏数据失效，重新进入后补查，迟到响应不得覆盖新条件。AI输入失效立即中止旧流，重新取得数据后再生成；单纯切换不重新生成。

页面公共筛选与组件局部筛选继续通过显式绑定消费，不新增Tab筛选栏；独立筛选控件使用各自 filterId 和独立查询源，沿用现有单图隔离校验。同字段公共/局部查询条件取交集，不相交按空结果处理。

活动项由 `tab.<组件id>=<页签id>` 保存，复用 navigation.replaceSearch（替换历史、不刷新）；局部筛选沿用筛选URL。多个容器互不覆盖，未知页签回退 defaultTab 或第一项，无关参数保留。URL不保存结果、滚动、图例或AI文本。

Report整页导出按声明顺序展开全部Tab，补齐普通数据，只捕获已有AI文本，未生成则空态；Dashboard不新增整页导出，表格Excel保留自身范围。可观察入口：[混合内容](../examples/tab-mixed-content.json)，Playground `/pages/tab-mixed-content`。Report验收入口 `/pages/tab-mixed-content-report`。使用本地DQE Sim，不证明真实DQE或Relay接入。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](../README.md)。
