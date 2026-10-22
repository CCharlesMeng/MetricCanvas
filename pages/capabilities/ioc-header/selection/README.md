# pages/capabilities/ioc-header/selection

页面由 JSON 自动发现。本文件仅记录使用说明，不参与渲染或注册。

## IOC 页头选择控件

入口：`/pages/ioc-header-selection`；[页面 JSON](ioc-header-selection.json)。

启动：`pnpm dev:playground`。

树形单选、多选标签横向滚动、可选搜索和父子规则。

本地合成数据

页面专属候选与查询夹具，无外部服务

1. 点击区域树单选并搜索代码，检查表格与URL。
2. 点击客户分类标签打开，横向滚动并删除一个标签。
3. 行业父子独立，业务仅叶子，模型关闭搜索，存量树保留父选后代。

本地合成候选及查询，未接真实服务。

关键声明：`filters[].selection`, `filters[].searchable`, `filters[].treeSelection`。
