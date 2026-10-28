# 操作与数据场景索引

按“本次操作 → 数据逻辑”各选命中项，只读对应说明与一个最接近的示例。明确的可信绑定小改动直接复用原对象。新增整页或改变布局形态时，再进入本文末尾的整页范式。

“指标表／详情表”描述结果粒度，均可用 table 展示；页面名字含“详情”、字段是数字，都不足以判断查询类型。先确认一行代表分组指标还是一条对象记录。查询编写沿用[数据识别与接数](data-analysis.md)中的业务标识、证据与验真规则。

包内示例可独立读取；Playground 列给出已有页面 id，有该运行环境时从 `/pages/<id>` 定位。示例覆盖相应逻辑，未必与 Playground 整页一一相同；取用数据逻辑时沿用目标页布局、身份与业务依据，仿真或内嵌行不证明真实服务可用。

## 先选操作

| 操作与典型说法 | 首步与完成边界 |
|---|---|
| 新增：“加指标／表格／查询／筛选” | 确认结果粒度及可复用声明，再选下方逻辑；新查询进入[数据分析](data-analysis.md)，新增整页先[确认形态](page-form.md)。检查新引用及共享消费者。 |
| 修改：“换口径／改字段／调整筛选或排序” | 定位原对象及依赖；已有可信绑定直接复用。字段身份、类型、单位或查询条件变化时核对引用两端及初始结果。按受影响逻辑验证。 |
| 删除：“删列／组件／查询／筛选／明细” | 先核对完整页面中的消费者与引用：数据槽、组合源成员、结果绑定、计算、条件、详情及导航。解除或迁移目标引用后删除声明；共享资源有剩余引用时保留。[共享消费者示例](page-metadata/examples/stored-count-measures.json)中图表与表格共用一个源，删除其中之一仍需保留源。局部 scan 未显示某引用不能作为无人使用的证明。 |
| debug：“报错／没数据／数不对／交互不生效” | 先按下方症状定位失败层，再选对应数据逻辑。保留原始错误或请求证据，只修复原因；静态校验通过后继续核对实际数据或交互。 |
| 仅分析：“匹配指标／查影响范围／列缺口” | 用[数据分析](data-analysis.md)的 scan/find；全页证据覆盖才用 draft/check。交匹配与缺口，不顺带修改页面。 |
| 升级：“旧页面继续开发” | 按[旧页升级](page-upgrade.md)检查可读范围，保留原件，确认工作文件后接回实际操作。 |
| 页头替换：“旧 header 换成 iocHeader” | 按[页头迁移](ioc-header-migration.md)识别旧声明、映射身份与筛选位置，核对只读、返回及无法承接的能力；协议升级后仍需执行此步骤。 |

写入类操作结束后完整校验目标页，并核对受影响交互；具体步骤见[本地验收](local-workflow.md)。删除页面配置只作用于本地页面文档，不表示删除后端业务记录。

## 再选数据逻辑

### 结果粒度

| 用户需求／选择条件 | 查阅与包内示例 | Playground 对照 |
|---|---|---|
| 指标聚合表：按地区、月份等维度看收入、数量、比率 | `data.query`、`query.core`、`table.columns`；[普通指标查询](page-metadata/examples/query-dashboard.json)。先明确分组维度及指标口径。 | `sales-detail`：名字虽含明细，表格仍使用维度＋指标查询 |
| 已有数值直接展示：源里已经存有“项目数量”等结果，无需再次聚合 | `fields.output-measures`；[现成数值](page-metadata/examples/stored-count-measures.json)。区分原始数值、度量角色和重新聚合。 | `stored-count-measures` |
| 对象详情表：每行是一条审批、订单等记录，保留记录身份与重复业务对象 | [查询定义](page-metadata/queries-and-bindings.md)的 DQE 对象查询；[最小对象查询](page-metadata/examples/object-query-page.json)。示例未展示唯一记录标识，需依真实契约确认，不能把项目／商务编号自动当唯一键。 | `dqe-object-query-demo` |

### 多源关系与级联

| 用户需求／选择条件 | 查阅与包内示例 | Playground 对照 |
|---|---|---|
| 按同一业务键补列：不同查询提供同一对象的不同指标，要求全局排序与分页 | `data.pagedJoin`；[组合查询源](page-metadata/examples/paged-join-page.json)。固定业务排名另看[排名示例](page-metadata/examples/paged-join-fixed-rank-page.json)。 | `multi-query-table` |
| 多来源逐行合并：合同、商务等记录统一列后混排，保留各来源记录 | [多来源表格](multi-source-table.md)、`data.pagedUnion`；[分页合并源](page-metadata/examples/paged-union-page.json)。 | `multi-source-table` |
| 查询结果级联：先查对象集合或 TopN，再用其维度值查询下游指标 | [查询结果绑定](page-metadata/queries-and-bindings.md)的 resultBindings；[级联与回填](page-metadata/examples/query-cascade-page.json)。明确上游集合与完整性。 | `business-sdt-cascade-example` |
| 查询分页／排序驱动级联：下游只跟随上游当前查询窗口，可先用 where 筛行 | [窗口级联](page-metadata/examples/query-result-page-window-page.json)；需完整输入时对照[结果筛行](page-metadata/examples/query-result-where-page.json)。使用查询分页；本地分页／排序不改变绑定输入。当前窗口、TopN 与全量分别核对。 | `query-result-where-page` |
| 跨源计算：已有归一化行集需要关联、汇总、透视或比率计算 | [具名算子](page-metadata/compute.md)；[跨源计算](page-metadata/examples/cross-source-page.json)。核对输入完整性；完整行集计算不替代组合源的全局分页。 | `dqe-object-query-demo` 的完整结果计算；`business-sdt-cascade-example` |

### 筛选、明细与交互

| 用户需求／选择条件 | 查阅与包内示例 | Playground 对照 |
|---|---|---|
| 筛选候选级联：地区变更后刷新下级候选，或候选依赖时间＋其他筛选 | [筛选声明](page-metadata/filters.md)；单父级 dependsOn 看[筛选示例](page-metadata/examples/filters-page.json)，多条件 candidateContext 看[候选窗口](page-metadata/examples/calendar-window-page.json)。 | `ioc-header-dense-filter-demo`；`ioc-header-calendar-window-demo` |
| 点击或按钮联动：点击表格值／固定按钮，改变筛选状态并让已绑定查询更新 | `filterGroup.core`、`query.core`；[选择与查询绑定](page-metadata/examples/dimension-selection-page.json)、[固定按钮组](page-metadata/examples/filter-group-page.json)。 | `table-cell-selection`；`filter-group-page` |
| 行内已有明细：父行已带 recordList，展开其中的记录 | [表格](page-metadata/components/table.md)的行内子表格；[recordList 展开](page-metadata/examples/table-row-expansion-inline.json)。子字段按项契约解释。 | `table-row-expansion-inline` |
| 行内查询明细：展开一行后，以该父行作为输入独立查询 | [按行查询展开](page-metadata/examples/table-row-expansion-query.json)、[输入绑定](page-metadata/examples/table-row-expansion-inputs.json)。实例属于各父行。 | `table-row-expansion-query` |
| 层级选择只收窄父行、保持父整体指标，子级先反向定位父级 | `read-knowledge.mjs show --topic table.hierarchy-selection`、[完整声明](page-metadata/examples/table-hierarchy-selection.json)。确认真实独立归属查询，不假设候选或明细有 parent。 | `table-hierarchy-selection` |
| 一次导出全部匹配父子数据，包含未展开子表 | `read-knowledge.mjs show --topic table.hierarchy-export`；显式 all 范围、可见父关联列、冻结条件与严格失败。 | `table-hierarchy-selection` |
| 弹窗／抽屉明细：点击入口展示详情，先确认使用已有快照还是独立查询 | [交互与导航](page-metadata/actions-and-navigation.md)；[详情浮层](page-metadata/examples/detail-views.json)、[查询详情绑定](page-metadata/examples/reference-export-detail-bindings.json)。 | `table-detail-overlay` 演示已准备好的快照 |
| 跨页明细：从清单进入详情页，传对象身份、筛选或期间 | [交互与导航](page-metadata/actions-and-navigation.md)；[来源页](page-metadata/examples/navigation-source-page.json)与[目标页](page-metadata/examples/navigation-detail-page.json)。核对显式传值和目标输入。 | `ioc-header-navigation-source-demo`；`ioc-header-navigation-detail-demo` |
| 时间模式切换：年／季／月等模式需要不同静态查询时间声明 | `filters.timeModes`；[静态时间模式](page-metadata/examples/time-modes-page.json)。 | `ioc-header-time-modes-demo` |
| 固定业务选项切换查询：不同选项采用不同查询体或绑定 | `query.modes`；[查询分支](page-metadata/examples/query-modes-page.json)。 | `query-mode-chart-demo` |
| 表格搜索／列筛选／排序／分页／导出：变更记录集合或浏览范围 | `table.search`、`table.pagination`、`table.export` 中命中的主题；[搜索字段选择](page-metadata/examples/table-search-options-page.json)、[工具区](page-metadata/examples/table-toolbar-page.json)。区分本地完整数据与远端查询窗口。 | `table-search-options-demo`；`table-column-candidates`；`table-toolbar-demo` |

结果绑定传递查询结果中的维度集合；候选级联更新可选值；点击联动写入筛选状态；行内查询接收父行输入。先按输入来自哪里选择上述路径，再查具体配置。

## debug 按症状进入

| 观察到的问题 | 首先核对 | 后续入口／对照 |
|---|---|---|
| JSON、版本或字段引用报错 | validate-page 回执的 type/path/message 与声明两端 | [校验与错误](page-metadata/validation.md)、[旧页升级](page-upgrade.md) |
| 查询未执行、被拒绝或空结果 | 执行入口、生效条件、输入集合、真实响应；区分请求失败与成功空结果 | [数据分析](data-analysis.md)，再选对应查询／级联逻辑 |
| 缺行、重复行、排序／分页／导出不一致 | 行粒度、稳定键、totalCount、完整结果与当前窗口 | 上方对象查询、pagedJoin、pagedUnion 或窗口级联；不要从 UI 当前页推断总集合 |
| 数值、百分比或空值显示不对 | queryField、字段类型、原始值、单位／刻度与格式 | `fields.core`、`fields.format`；[查询容错](page-metadata/examples/query-numeric-tolerance.json)；Playground `query-numeric-tolerance` |
| 筛选、展开或导航没有带来预期变化 | 值写到哪里、谁消费绑定、目标参数、请求是否改变 | 上方交互逻辑；控件状态变化与数据变化分别检查 |

## 整页创作再选范式

地图概览、主题分析、筛选清单、对象详情见 [Dashboard 范式](dashboard-patterns.md)；经营月报、分析简报见 [Report 范式](report-patterns.md)。形态确认沿用[页面形态规则](page-form.md)，已有有效选择时直接继续。

例如：“删除级联表”＝删除＋查询结果级联；“详情表翻页缺行”＝debug＋对象记录／查询分页；“给指标表补不同来源的列”＝修改＋组合查询源。只组合命中的路径，不展开操作与逻辑的全部组合。
