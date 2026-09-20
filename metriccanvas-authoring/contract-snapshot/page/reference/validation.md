# 校验、错误与修复

先验证JSON结构和版本，再验证引用/角色/映射/绑定等页面语义。错误使用稳定type与JSON Pointer定位，message只用于解释。修复原始文档后重新完整校验，不能吞掉错误字段来强行渲染。

SCHEMA_ERROR对应结构和页面语义；FIELD_CONTRACT_ERROR对应结果字段契约；QUERY_MAPPING_ERROR对应查询输出映射；FILTER_BINDING_ERROR对应筛选绑定。查询执行错误是运行期证据，不能由静态例子证明。

本册example是完整页面，短JSON片段必须注明插入路径与依赖；生成器会核对完整例子。实际受控工具是否支持、外部服务是否接通分别查Authoring及集成证据。

## 查阅方式

字段和联合分支以本文件导出版本的生成结构表为准。完整页面示例用于结构/语义校验，渲染行为需结合对应浏览器证据。返回[模块索引](README.md)。


页面协议 6.6。结构真源为本册[schema.json](schema.json)，SHA256 `724a223b61ed116ed3a542b273a0235b6778f87196f289a2a19d1c9feb5a24e7`。字段表自动生成；可选不等于有默认值。

## 结构与分支（生成）

## 语义规则与反例（生成）

- `page-layout-compatibility`：6.1 layout 能力下限与单布局真源；6.0 layoutForm 仍可读取。反例：[layout-before-6.1](errors/layout-before-6.1.json)、[layout-dual-equal](errors/layout-dual-equal.json)、[layout-dual-conflict](errors/layout-dual-conflict.json)、[layout-invalid-value](errors/layout-invalid-value.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `url-navigation-source-contract`：URL 与来源绑定可校验，目标存在性与必填项由目标负责。反例：[navigation-invalid-authority](errors/navigation-invalid-authority.json)、[navigation-invalid-port](errors/navigation-invalid-port.json)、[navigation-scheme-without-authority](errors/navigation-scheme-without-authority.json)、[navigation-unsafe-url](errors/navigation-unsafe-url.json)、[navigation-missing-row-field](errors/navigation-missing-row-field.json)、[navigation-unknown-param](errors/navigation-unknown-param.json)、[navigation-wrong-filter-part](errors/navigation-wrong-filter-part.json)、[navigation-text-row-source](errors/navigation-text-row-source.json)、[navigation-text-unsafe-url](errors/navigation-text-unsafe-url.json)、[navigation-url-input-collision](errors/navigation-url-input-collision.json)、[navigation-url-input-wrong-part](errors/navigation-url-input-wrong-part.json)、[navigation-clicked-slot-missing-field](errors/navigation-clicked-slot-missing-field.json)、[navigation-legacy-target-rejected](errors/navigation-legacy-target-rejected.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `schema-structure`：Page Schema 结构校验（ajv allErrors 文案与顺序）。反例：[missing-schema-version](errors/missing-schema-version.json)、[unknown-top-level-field](errors/unknown-top-level-field.json)、[layout-span-out-of-range](errors/layout-span-out-of-range.json)、[field-id-pattern](errors/field-id-pattern.json)、[sections-empty](errors/sections-empty.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `schema-version-supported`：schemaVersion 必须是当前主版本内的受支持次版本。反例：[version-major-unsupported](errors/version-major-unsupported.json)、[version-minor-ahead](errors/version-minor-ahead.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `composite-card-pure-container`：组合卡是纯容器：不声明 data / actions、至少一个子组件、不嵌套容器、子组件在白名单内。反例：[composite-card-with-data](errors/composite-card-with-data.json)、[composite-card-with-actions](errors/composite-card-with-actions.json)、[composite-card-empty](errors/composite-card-empty.json)、[composite-card-nested-container](errors/composite-card-nested-container.json)、[composite-card-child-not-whitelisted](errors/composite-card-child-not-whitelisted.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `page-param-id-unique`：页面参数 id 唯一。反例：[duplicate-page-param-id](errors/duplicate-page-param-id.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `page-param-not-filter-name`：页面参数不得与筛选器同名。反例：[page-param-named-like-filter](errors/page-param-named-like-filter.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `page-param-default-type`：页面参数默认值符合声明类型。反例：[page-param-default-type-mismatch](errors/page-param-default-type-mismatch.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `text-value-param-declared`：文本取值只能引用已声明的页面参数。反例：[text-value-unknown-param](errors/text-value-unknown-param.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `text-value-format-compatible`：文本取值引用的展示格式与参数类型相容。反例：[text-value-format-mismatch](errors/text-value-format-mismatch.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `page-param-consumed`：每个页面参数至少被一处文本取值消费。反例：[page-param-unconsumed](errors/page-param-unconsumed.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `optional-param-not-in-required-text`：必填文本属性只能引用必需参数。反例：[required-title-references-optional-param](errors/required-title-references-optional-param.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `grouped-query-fields-unique`：按角色分组的查询字段在维度组与度量组之间不得重名。反例：[grouped-field-duplicate](errors/grouped-field-duplicate.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `grouped-query-field-label-not-id`：分组查询字段的 label 与字段 id 相同时应省略。反例：[grouped-field-label-equals-id](errors/grouped-field-label-equals-id.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `query-initial-rows-normalize`：DQE 内嵌初始行按 queryField 归一化并满足结果字段契约。反例：[initial-row-missing-query-field](errors/initial-row-missing-query-field.json)、[initial-row-null-not-allowed](errors/initial-row-null-not-allowed.json)、[initial-row-type-mismatch](errors/initial-row-type-mismatch.json)、[initial-row-date-invalid](errors/initial-row-date-invalid.json)、[initial-row-semantic-html-too-large](errors/initial-row-semantic-html-too-large.json)、[initial-row-detail-missing-query-field](errors/initial-row-detail-missing-query-field.json)、[initial-row-detail-null-not-allowed](errors/initial-row-detail-null-not-allowed.json)、[initial-row-detail-type-mismatch](errors/initial-row-detail-type-mismatch.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `filter-id-unique`：筛选器 id 唯一。反例：[duplicate-filter-id](errors/duplicate-filter-id.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `time-range-default-calendar`：timeRange 绝对默认值须为合法公历值、精度一致且 from 不晚于 to。反例：[time-range-from-format](errors/time-range-from-format.json)、[time-range-to-calendar](errors/time-range-to-calendar.json)、[time-range-datetime-without-precision](errors/time-range-datetime-without-precision.json)、[time-range-from-after-to](errors/time-range-from-after-to.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `relative-time-anchor`：结构化相对时间的 anchor 须为合法公历日期。反例：[relative-time-anchor-invalid](errors/relative-time-anchor-invalid.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `time-point-default`：timePoint 默认值符合其粒度的格式与日历。反例：[time-point-month-format](errors/time-point-month-format.json)、[time-point-month-range](errors/time-point-month-range.json)、[time-point-date-format](errors/time-point-date-format.json)、[time-point-date-calendar](errors/time-point-date-calendar.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `number-range-default`：numberRange 默认值至少有一端且 from 不大于 to。反例：[number-range-empty](errors/number-range-empty.json)、[number-range-inverted](errors/number-range-inverted.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `hierarchy-level-id-unique`：层级 id 在同一筛选器内唯一。反例：[duplicate-hierarchy-level-id](errors/duplicate-hierarchy-level-id.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `default-level-declared`：defaultLevel 只能用于声明了 hierarchy 的筛选器并引用已声明层级。反例：[default-level-without-hierarchy](errors/default-level-without-hierarchy.json)、[default-level-unknown](errors/default-level-unknown.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `hierarchy-picker-requires-hierarchy`：hierarchyPicker 只能用于声明了 hierarchy 的维度筛选器。反例：[hierarchy-picker-without-hierarchy](errors/hierarchy-picker-without-hierarchy.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `filter-depends-on`：级联只能依赖另一个已声明的 dimension 筛选器且不成环。反例：[depends-on-self](errors/depends-on-self.json)、[depends-on-undeclared](errors/depends-on-undeclared.json)、[depends-on-non-dimension](errors/depends-on-non-dimension.json)、[depends-on-cycle](errors/depends-on-cycle.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `hidden-hierarchy-picker-needs-map`：隐藏层级切换器时必须有地图通过 hierarchyFilter 承担下钻。反例：[hidden-hierarchy-picker-without-map](errors/hidden-hierarchy-picker-without-map.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `section-id-unique`：内容分区 id 唯一。反例：[duplicate-section-id](errors/duplicate-section-id.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `component-id-unique`：组件 id 在整页（含容器内）唯一。反例：[duplicate-component-id](errors/duplicate-component-id.json)、[duplicate-component-id-in-container](errors/duplicate-component-id-in-container.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `layer-top-level-only`：layout.layer 只能声明在内容分区的顶层组件上。反例：[layer-inside-composite-card](errors/layer-inside-composite-card.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `single-backdrop-per-section`：一个分区最多一个 backdrop。反例：[two-backdrops](errors/two-backdrops.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `backdrop-needs-siblings`：声明 backdrop 的分区必须还有别的组件叠在其上。反例：[backdrop-only-section](errors/backdrop-only-section.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `backdrop-container-plain`：声明 backdrop 的分区必须使用 container: plain。反例：[backdrop-in-card-container](errors/backdrop-in-card-container.json)、[backdrop-without-container](errors/backdrop-without-container.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `column-track-span`：声明列轨的分区里顶层组件 span 不得超过轨数。反例：[span-exceeds-column-tracks](errors/span-exceeds-column-tracks.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `inline-rows-contract`：inline 数据行满足结果字段契约（字段集合、类型、nullable、明细约束）。反例：[inline-row-undeclared-field](errors/inline-row-undeclared-field.json)、[inline-row-missing-field](errors/inline-row-missing-field.json)、[inline-row-null-not-allowed](errors/inline-row-null-not-allowed.json)、[inline-row-type-mismatch](errors/inline-row-type-mismatch.json)、[inline-row-date-invalid](errors/inline-row-date-invalid.json)、[inline-row-datetime-invalid](errors/inline-row-datetime-invalid.json)、[inline-row-semantic-html-type](errors/inline-row-semantic-html-type.json)、[inline-row-detail-undeclared-field](errors/inline-row-detail-undeclared-field.json)、[inline-row-detail-missing-field](errors/inline-row-detail-missing-field.json)、[inline-row-detail-null-not-allowed](errors/inline-row-detail-null-not-allowed.json)、[inline-row-detail-type-mismatch](errors/inline-row-detail-type-mismatch.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `detail-item-object`：嵌套明细的每一项必须是对象；由 Page Schema 在结构层拒绝，语义层的同名判定因此不可达。反例：[initial-row-detail-item-not-object](errors/initial-row-detail-item-not-object.json)、[inline-row-detail-item-not-object](errors/inline-row-detail-item-not-object.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `detail-list-max-items`：嵌套明细最多 100 项；由 Page Schema 的 maxItems 在结构层拒绝，语义层的同名判定因此不可达。反例：[initial-row-detail-list-too-large](errors/initial-row-detail-list-too-large.json)、[inline-row-detail-list-too-large](errors/inline-row-detail-list-too-large.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `captured-at-valid`：内嵌初始行的 capturedAt 须为有效的 RFC 3339 日期时间。反例：[captured-at-invalid-month](errors/captured-at-invalid-month.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `query-field-mapping`：query 数据源字段与 DQE 输出字段之间的显式、唯一、角色相容映射。反例：[query-field-without-mapping](errors/query-field-without-mapping.json)、[query-field-duplicate-mapping](errors/query-field-duplicate-mapping.json)、[query-field-not-output](errors/query-field-not-output.json)、[query-detail-item-duplicate-mapping](errors/query-detail-item-duplicate-mapping.json)、[query-dimension-role-mismatch](errors/query-dimension-role-mismatch.json)、[query-role-mismatch](errors/query-role-mismatch.json)、[query-output-unmapped](errors/query-output-unmapped.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `filter-binding`：筛选绑定引用已声明筛选器，且 time / dimension 目标类型匹配。反例：[unknown-filter-binding](errors/unknown-filter-binding.json)、[filter-binding-time-target-not-time-range](errors/filter-binding-time-target-not-time-range.json)、[filter-binding-dimension-target-not-dimension](errors/filter-binding-dimension-target-not-dimension.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `compute-operator-inputs`：算子引用的字段已声明、角色相容、数值算子输入为数值类型。反例：[compute-undeclared-field](errors/compute-undeclared-field.json)、[compute-role-mismatch](errors/compute-role-mismatch.json)、[compute-non-numeric-input](errors/compute-non-numeric-input.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `compute-operator-outputs`：算子产出字段已声明、不重名、不来自外部响应。反例：[compute-duplicate-output](errors/compute-duplicate-output.json)、[compute-output-with-query-field](errors/compute-output-with-query-field.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `compute-folding-collapsible`：折叠算子只能作用于显式声明 collapsible 的度量字段。反例：[compute-fold-non-collapsible](errors/compute-fold-non-collapsible.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `compute-row-kind-field`：行类别字段必须是可空的 string 维度。反例：[compute-row-kind-not-string](errors/compute-row-kind-not-string.json)、[compute-row-kind-not-nullable](errors/compute-row-kind-not-nullable.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `compute-pivot-categories-unique`：透视类别取值只能映射到一个目标列。反例：[compute-pivot-duplicate-category](errors/compute-pivot-duplicate-category.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `compute-output-not-in-rows`：算子产出字段不得出现在数据行中。反例：[compute-output-in-inline-rows](errors/compute-output-in-inline-rows.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `data-slot-known-source`：组件数据槽只能引用已声明的页面数据源。反例：[data-slot-unknown-source](errors/data-slot-unknown-source.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `field-binding-resolves`：字段绑定引用组件已声明的数据槽与数据源中存在的字段。反例：[field-binding-undeclared-slot](errors/field-binding-undeclared-slot.json)、[unknown-component-field](errors/unknown-component-field.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `field-binding-role`：字段绑定的角色符合组件属性要求。反例：[field-binding-role-mismatch](errors/field-binding-role-mismatch.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `detail-field-consumption`：嵌套明细字段只能由显式支持 detail 的组件属性消费。反例：[detail-field-in-generic-binding](errors/detail-field-in-generic-binding.json)、[record-list-in-table-column](errors/record-list-in-table-column.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `field-binding-match`：行匹配字段必须是 dimension，匹配值符合其类型。反例：[match-field-unknown](errors/match-field-unknown.json)、[match-field-not-dimension](errors/match-field-not-dimension.json)、[match-value-type-mismatch](errors/match-value-type-mismatch.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `ai-summary-related-data`：AI 总结关联数据引用已声明数据源中的非明细字段，不重复且术语一致。反例：[ai-summary-unknown-source](errors/ai-summary-unknown-source.json)、[ai-summary-unknown-field](errors/ai-summary-unknown-field.json)、[ai-summary-detail-field](errors/ai-summary-detail-field.json)、[ai-summary-duplicate-field](errors/ai-summary-duplicate-field.json)、[ai-summary-term-conflict](errors/ai-summary-term-conflict.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `metric-row-link-needs-navigate`：指标行声明 link 时组件必须至少有一个 navigate 动作。反例：[metric-row-link-without-navigate](errors/metric-row-link-without-navigate.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `bar-forecast-boundary`：实际 / 预测系列不得跨越采集时间所在月。反例：[forecast-before-captured-month](errors/forecast-before-captured-month.json)、[actual-after-captured-month](errors/actual-after-captured-month.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `table-row-key`：多数据槽表格必须声明各槽都有且类型一致的 dimension rowKey。反例：[table-multi-slot-without-row-key](errors/table-multi-slot-without-row-key.json)、[table-row-key-missing-in-slot](errors/table-row-key-missing-in-slot.json)、[table-row-key-not-dimension](errors/table-row-key-not-dimension.json)、[table-row-key-type-inconsistent](errors/table-row-key-type-inconsistent.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `table-row-kind-field`：表格行类别字段必须存在且由该数据源的折叠算子写入。反例：[table-row-kind-field-unknown](errors/table-row-kind-field-unknown.json)、[table-row-kind-field-not-written](errors/table-row-kind-field-not-written.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `table-merge-by-column`：mergeBy 必须是表格已声明的列字段。反例：[table-merge-by-not-column](errors/table-merge-by-not-column.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `table-selection-writes`：单元格选择只能写入已声明的 dimension 筛选器。反例：[table-selection-writes-unknown-filter](errors/table-selection-writes-unknown-filter.json)、[table-selection-writes-non-dimension](errors/table-selection-writes-non-dimension.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `table-column-binding-unique`：表格列字段绑定不重复。反例：[table-duplicate-column-binding](errors/table-duplicate-column-binding.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `table-filterable-dimension`：表头筛选只能声明在 dimension 列上。反例：[table-filterable-on-measure](errors/table-filterable-on-measure.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `category-swatches-need-pie`：分类明细开启色点要求同页有饼图绑定同一类别字段。反例：[category-swatches-without-pie](errors/category-swatches-without-pie.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `map-legend-bands-increasing`：地图图例档位下界严格递增。反例：[map-legend-bands-not-increasing](errors/map-legend-bands-not-increasing.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `map-pinned-summary`：固定地域摘要只用于 regionalOverview，匹配值符合类型，标签不重复。反例：[map-pinned-summary-wrong-variant](errors/map-pinned-summary-wrong-variant.json)、[map-pinned-summary-match-value-type](errors/map-pinned-summary-match-value-type.json)、[map-pinned-summary-duplicate-label](errors/map-pinned-summary-duplicate-label.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `map-hierarchy`：地图下钻字段只与 hierarchyFilter 一起使用，目标是声明了 hierarchy 的维度筛选器。反例：[map-level-fields-without-hierarchy-filter](errors/map-level-fields-without-hierarchy-filter.json)、[map-hierarchy-filter-undeclared](errors/map-hierarchy-filter-undeclared.json)、[map-hierarchy-filter-not-hierarchical](errors/map-hierarchy-filter-not-hierarchical.json)、[map-level-maps-unknown-level](errors/map-level-maps-unknown-level.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `tab-container`：Tab id 唯一且 defaultTab 已声明。反例：[tab-id-duplicate](errors/tab-id-duplicate.json)、[tab-default-unknown](errors/tab-default-unknown.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `ranking-detail-semantic-description`：语义 HTML 说明必须绑定 semanticHtml 类型的 detail 字段。反例：[ranking-semantic-description-not-detail](errors/ranking-semantic-description-not-detail.json)、[ranking-semantic-description-record-list](errors/ranking-semantic-description-record-list.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `ranking-detail-records`：结构化明细必须绑定 recordList 字段，项字段存在且角色相容。反例：[ranking-details-not-record-list](errors/ranking-details-not-record-list.json)、[ranking-details-item-field-unknown](errors/ranking-details-item-field-unknown.json)、[ranking-details-item-role-mismatch](errors/ranking-details-item-role-mismatch.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `actions-live-only`：writeFilter 只允许绑定 query 数据源的组件。反例：[write-filter-on-inline-component](errors/write-filter-on-inline-component.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `write-filter-target`：回写目标是已声明的 dimension 筛选器。反例：[write-filter-undeclared](errors/write-filter-undeclared.json)、[write-filter-non-dimension](errors/write-filter-non-dimension.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `navigation-filter-source`：导航绑定只能引用已声明的筛选器。反例：[navigation-filter-undeclared](errors/navigation-filter-undeclared.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `pagination-local-inline`：pagination.mode='local' 只允许绑定 inline 数据源。反例：[pagination-local-on-query](errors/pagination-local-on-query.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `pagination-query-source`：pagination.mode='query' 只允许绑定 query 数据源。反例：[pagination-query-on-inline](errors/pagination-query-on-inline.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `pagination-query-order`：查询分页要求 DQE order.offset 为 0 且 limit 为正整数。反例：[pagination-offset-not-zero](errors/pagination-offset-not-zero.json)、[pagination-limit-not-positive](errors/pagination-limit-not-positive.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `pagination-initial-rows`：查询分页的内嵌初始行必须声明 totalCount 且是完整第一页。反例：[pagination-initial-without-total-count](errors/pagination-initial-without-total-count.json)、[pagination-initial-not-full-page](errors/pagination-initial-not-full-page.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `pagination-no-view-columns`：查询分页暂不支持排序与表头筛选。反例：[pagination-sortable-column](errors/pagination-sortable-column.json)、[pagination-filterable-column](errors/pagination-filterable-column.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。
- `pagination-exclusive-source`：查询分页表格必须独占页面数据源。反例：[pagination-shared-source](errors/pagination-shared-source.json)。反例文件包含完整input及预期type/path；修复后须重新完整校验。

## 示例与溯源（生成）

- [inline-report](examples/inline-report.json)：完整合法页面；查询仅为静态契约证据。
- 源码/验证定位：`packages/page/src/validate.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`packages/page/src/schema/page.ts`（仓库路径，非分发依赖）。
- 源码/验证定位：`tools/scripts/page-conformance-vectors.ts`（仓库路径，非分发依赖）。

## 联合分支见证（生成）

