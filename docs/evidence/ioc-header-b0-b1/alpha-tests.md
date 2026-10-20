# B0+B1 验收账本

## AC ↔ 证据映射

| AT | 状态 | 执行环境 | 证据记录 | 新鲜度 | 说明 |
| --- | --- | --- | --- | --- | --- |
| AT01 | PROVEN | mock | quality_gate；candidate-context-green.log；filter-coordinator.test.ts | 当前源指纹 | 整组拒绝、递归清理、共享写入口；三层writeMany和restore不接收旧上下文回执 |
| AT02 | PROVEN | contract | BE-1、BE-2、BE-5；filter-execution-gate.test.ts | 当前依赖哈希 | 候选迟到成功/失败、URL选值重试、相关及下游门禁；无关查询继续 |
| AT03 | PROVEN | mock | quality_gate；packages/page/tests/ioc-header.test.ts | 当前源指纹 | 版本下限、排重、TextValue与非法根结构 |
| AT04 | PROVEN | contract | BE-1、BE-2、BE-3；restore-report-green.json | 当前依赖哈希 | 五项文字规格测量；390展开候选层不越界，隐藏控件inert |
| AT05 | PROVEN | contract | BE-1、BE-3、BE-4、BE-6 | 当前依赖哈希 | 年季月锚点、近一年、详情单月、离散月份、多实例及合法来源返回 |
| AT06 | PROVEN | contract | quality_gate；BE-1..4；static-header.html、static-applied.html | 当前依赖哈希 | 四页创建/编辑/重开、独立安装包和Skill、静态身份与已应用范围/搜索值 |

这里的contract为本地合成HTTP契约环境；不代表真实DQE、CloudIOC、Relay、DS模型、门户或部署验收。编辑前未完整采集可比质量起点，不声明历史无回归。

## 计划外承接

| 文件 | Task | 原因 |
| --- | --- | --- |
| page/src/version.ts、schema/page.ts、page.ts、text-value.ts、public-api/page.txt | T3 | 能力下限、根结构、身份缺失投影和类型公开面快照 |
| runtime-ui/src/ExportView.svelte、embed入口 | T4 | 静态身份及已应用条件、只读输入闭包 |
| ui/src/components/date-picker/DatePicker.svelte | T4 | 折叠或只读转换为inert时关闭已开日期浮层，保持中立UI职责 |
| runtime-ui/src/filters/FilterBar.svelte | T4 | 静态数值范围与搜索已应用值、折叠关闭原生details |
| platform/tests/workbench/property-edit.test.ts、playground/page-catalog.json | T5 | 当前版本回归断言及追加验收目录，保护原目录排序 |
| authoring生成物、Python交互编辑、文档、测试及compatibility.mjs | T5 | 受控set_ioc_header、产品真源生成和独立安装分发闭包 |
