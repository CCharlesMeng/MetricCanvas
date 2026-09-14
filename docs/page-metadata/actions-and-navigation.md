# 交互与导航

受控action支持写筛选与导航。writeFilter目标须存在且类型匹配；表格selection只把受控字段/固定值映射到允许目标。URL导航使用目标页面公开参数名，保留标准anchor能力，宿主可选择接管。

表格列selection与link同时存在时selection优先。行导航只在声明的入口列触发。当前页字段、目标页面参数和筛选器id不能靠同名猜映射。文本链接与普通URL不开放脚本执行。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](README.md)。

## 当前内容工具边界

#137只开放add/update/remove_dimension_filter、set/remove_table_link五项原子操作。筛选声明和完整绑定集合一起修改；仅现有DQE dimension queryField，不改原查询body/order/initial，也不借此创建params、initialParam、paramBindings或层级筛选。悬空级联、参数或导航引用阻止删除。

表格链接可定位Tab子树/分组列；必须显式给出安全href及非空row/param/filter映射。selection抢占、多navigate歧义或共享目标不一致会拒绝；删除最后链接时清导航并保留其它动作。它不是通用actions或表头筛选编辑器。

`t11-evidence.md`记录两形态真实Chrome→createDqeGateway→本地HTTP，选择/清空raw_region、未绑定表格保留，以及真实anchor跳转携row/param/filter/fixed/hash。实际外部DQE、权限及目标业务页仍待独立联调。源码定位：`metriccanvas-authoring/tool/metriccanvas_authoring/domain/interaction_editing.py`、`page_editing.py`，公开回归`test_content_interactions.py`。
