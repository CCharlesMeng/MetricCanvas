# 交互与导航

受控action支持写筛选与导航。writeFilter目标须存在且类型匹配；表格selection只把受控字段/固定值映射到允许目标。URL导航使用目标页面公开参数名，保留标准anchor能力，宿主可选择接管。

表格列selection与link同时存在时selection优先。行导航只在声明的入口列触发。当前页字段、目标页面参数和筛选器id不能靠同名猜映射。文本链接与普通URL不开放脚本执行。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](README.md)。

## 当前内容工具边界

#137只开放add/update/remove_dimension_filter、set/remove_table_link五项原子操作。筛选声明和完整绑定集合一起修改；仅现有DQE dimension queryField，不改原查询body/order/initial，也不借此创建params、initialParam、paramBindings或层级筛选。悬空级联、参数或导航引用阻止删除。

表格链接可定位Tab子树/分组列；必须显式给出安全href及非空row/param/filter映射。selection抢占、多navigate歧义或共享目标不一致会拒绝；删除最后链接时清导航并保留其它动作。它不是通用actions或表头筛选编辑器。

`t11-evidence.md`记录两形态真实Chrome→createDqeGateway→本地HTTP，选择/清空raw_region、未绑定表格保留，以及真实anchor跳转携row/param/filter/fixed/hash。实际外部DQE、权限及目标业务页仍待独立联调。源码定位：`metriccanvas-authoring/tool/metriccanvas_authoring/pages/editing/interaction_editing.py`、`page_editing.py`，公开回归`test_content_interactions.py`。

6.35：modes范围的导航筛选引用支持part:"mode"；显式映射目标mode/from/to三个查询键，目标页按整组校验。不把模式放入普通月份或timePoint参数，不依赖同名猜测。完整示例见time-modes-page。

## 6.36 显式跨页传值

`navigate`及文本链接可声明`validateTargetInputs:true`，由集成应用的`RuntimeNavigation.resolveTargetInputs(href,{signal})`提供目标当前页级公开声明投影。`projectNavigationInputs(document)`验证并提取pageId/params/filters，不含业务结果、凭据或授权候选，排除详情私有筛选。投影未就绪/失败/缺能力时链接没有可导航href，操作返回navigation-error及原因；销毁或换页忽略旧投影。集成应用保证目标身份与实际路由对应。未声明该意图的普通URL保持兼容。

仅映射query声明的row/param/filter，保留0/false，多值重复编码；不按同名继承。受控链接缺值清除href同名静态旧值后再验必需输入。显式映射的必需值缺失时，即使目标有默认值也拒绝，避免进入另一实体。未知目标键、单值重复、类型/层级/枚举不符、半范围及不完整mode/from/to拒绝；季度或多月不能取起点变成详情单月。目标授权候选由目标实例加载确认，相关查询保持门禁。

6.36声明`strictURLInputs:true`的目标页面显式非法筛选URL给错误，不回退默认查询；非法数字/布尔/重复单值参数不回退default。`RuntimeNavigation.resolveHref`可映射集成应用部署路径，真实href和点击共用映射。仅传值，无分页/排序/Tab/滚动/行展开/来源视图恢复。

实际示例：navigation-source-page、navigation-list-page、navigation-detail-page。Playground来源`/pages/ioc-header-navigation-source-demo`；清单直达需`?origin=直接入口`，详情需`?project-id=P001&project-name=示例项目&origin=直接入口&month=2026-09&currency=RMB&regions=north`。清单切季度或点缺编码行拒绝；概览缺目标能力链接提示不可用。B6挂起。

`strictURLInputs:true`由页面显式开启，兼容规范化升版本不自动开启。来源和目标可分别选择该策略；本批三个验收页均开启。受控编辑使用`set_url_input_validation`，enabled=false仅删除该标记。

目标输入投影排除不可由URL覆盖的旧数组固定参数；该旧模式整体不接收筛选URL，因此其筛选也不作为可传入接口。strictURLInputs与旧数组固定参数互斥，应显式使用分组参数；不自动迁移业务页。
