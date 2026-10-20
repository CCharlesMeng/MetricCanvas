# 正式 API 审查结论

用户批准原型后，本次把选择交互落到公共中立组件，而非复制 IOC 页面渲染或引入 Vue。Select 原 string 回调不变；Selection 单独承担数组值。组件只保存展开/搜索/焦点临时状态，运行时仍是页面筛选状态和候选加载的所有者。

页面字段 selection/searchable/treeSelection 的规则及版本门见 [设计冻结](story-delta-frontend-design.md)。新增候选 parentValue 不改变已有候选端口调用形状；旧路径关系保留，非法显式关系明确报错。父码与下级维度切换是两种数据语义，不互相替换。不新增远程搜索、懒加载、搜索结果全选、已选侧栏或业务页面专属状态。

公开 API、Schema、版本门、初始化/URL/直接写入/详情输入、普通与层级 FilterBar 两条接线已逐项核对；单选多值统一拒绝，不截取第一项。官方 CSS 继续通过原生成器与局部 Theme 注入，新增树/复选框/SVG族，保留 ShadowRoot 注入选项。SVG只保留有效路径及官方白色填充；半选形状有浏览器断言。

正式入口为 packages/ui/src/index.ts；页面试验场 /pages/ioc-header-selection 直接消费正式控件及 pages/ioc-header-selection.json。页面专用合成网关与其他页面隔离，验证不代表真实服务联调。
