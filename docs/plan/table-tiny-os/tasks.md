# MetricCanvas / 引擎 Table TinyVue OS 还原

**Goal:** 普通、forecastMatrix、embedded Table 采用指定 TinyVue OS Grid 样式；reportCompact 外观保持原样。

**关键结构决策:** 新皮肤限定在非 reportCompact 根节点；状态与查询仍由 TableSession/运行时拥有。平台 UI Grid 不变。容器高度、列结构、业务显式颜色、排序/筛选/分页语义保留。

**TaskPacket:** project=MetricCanvas | story=table-tiny-os | verification_schema=v2 | component_test_status=available | component_test_framework=Vitest | browser_test_status=available | browser_test_framework=Playwright | search_paths=packages/engine,packages/embed/tests/browser,pages,apps/playground/page-catalog.json,docs/page-metadata/components/table.md | project_type=frontend | frontend_design_path=story-delta-frontend-design.md | baseline_source=reference_page | reference_route=https://opentiny.design/tiny-vue/zh-CN/os-theme/components/grid | affected_routes=/pages/table-tiny-os,/pages/table-toolbar-demo,/pages/table-detail-overlay | required_states=hover,focus,disabled,selected,empty,overflow,long-copy | restore_tasks=1 | risk_triggers=spec-gap

## 项目边界

| 范围内 | 范围外 |
|---|---|
| 普通/forecastMatrix/embedded 表格本体及其控件、Dashboard 覆盖 | reportCompact 现有外观、平台 Grid、查询语义、协议字段新增 |

## 模块与文件

| 文件 | 职责 | Task |
|---|---|---|
| packages/engine/widgets/src/components/table/Table.svelte | OS 隔离皮肤、短线、排序/筛选图标、空态、滚动边界 | 1 |
| packages/engine/widgets/src/components/table/TableControlIcon.svelte | 官方 SVG 路径及状态形状 | 1 |
| packages/engine/widgets/src/components/table/table-geometry.ts | 实际表头和固定列几何与滚动状态 | 1 |
| pages/capabilities/table/table-tiny-os.json | 内联合成场景及 reportCompact 对照 | 2 |
| apps/playground/page-catalog.json | 可发现入口 | 2 |
| packages/embed/tests/browser/table-tiny-os.spec.ts | 样式值、状态交互与排除项回归 | 2 |
| docs/page-metadata/components/table.md | 变体外观边界说明与示例路由 | 2 |
| metriccanvas-authoring/skill/metriccanvas-local-authoring/references/page-metadata/components/table.md | 从产品文档生成的知识同步 | 3 |
| metriccanvas-authoring/bundle.lock.json | 按真源生成清单 | 3 |
| packages/embed/tests/fixtures/tiny-os-grid.css、tiny-os-grid-reference.json | 官方 CSS、数据及图标路径冻结参照（测试工件） | 2 |
| PAGE-METADATA.md、pages/README.md | 产品入口及能力索引指路 | 2 |
| contracts/metriccanvas/manifest.json、page/reference/components/table.md | 产品文档生成契约 | 3 |
| metriccanvas-authoring/contract-lock.json、contract-snapshot/manifest.json、contract-snapshot/page/reference/components/table.md | 独立分发快照及哈希闭合 | 3 |
| metriccanvas-authoring/skill/metriccanvas-local-authoring/references/knowledge.json | 独立知识索引中的 table 文档条目 | 3 |
| metriccanvas-authoring/skill/metriccanvas-page-builder/references/page-metadata/components/table.md | 现存生成器的同源机械镜像；不扩展旧 Skill 验收 | 3 |

## 用例追溯

| AT | 标题 | 验证范围 | 验证方法 | Task |
|---|---|---|---|---|
| AT-01 | 三种纳入表格的字体、尺寸、底色、边框、图标逐项匹配外部基线 | S2_PAGE | restore_contract | 1,2 |
| AT-02 | 排序、筛选、搜索、分页、空态及固定列滚动不改变既有语义 | S3_STORY | test_case | 1,2 |
| AT-03 | reportCompact 保持既有字体、表头和表体、控件外观 | S2_PAGE | test_case | 1,2 |
| AT-04 | 窄屏及多级表头不重叠、固定列与实际列宽一致 | S2_PAGE | test_case | 1,2 |
| AT-05 | 文档和独立本地创作知识同步闭合 | S1_COMPONENT | test_case | 3 |

## Task List

### Task 1: 引擎表格隔离还原 [用例: AT-01,AT-02,AT-03,AT-04]

**形态:** 还原

- [x] 记录外部样式基线和当前失败项。
- [x] 实现非 reportCompact 皮肤及必要几何，保留业务布局和 reportCompact 旧路径。
- [x] 回填逐项证据与实际限制。

### Task 2: 可观察场景和回归 [用例: AT-01,AT-02,AT-03,AT-04]

**形态:** 还原

- [x] 增加完整内联场景、目录入口和产品文档。
- [x] 验证样式、状态、窄屏和 reportCompact 排除项。

### Task 3: 本地创作知识同步 [用例: AT-05]

**形态:** 机械

- [x] 在隔离真源中生成本次文档知识，保留并行派生物。
- [x] 验证独立安装与本次场景校验。

## 风险与回滚

共享规则意外影响 reportCompact 时修复隔离选择器，不放宽排除项。目标未采样状态不得写已验证。仅回滚本次文件中的本次差异，不丢弃并行工作。
