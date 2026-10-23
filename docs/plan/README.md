# 计划总览

更新：2026-10-19。先按下表选择任务；**plan只保留未完成工作**，已完成实施记录和被替代的分稿移到证据或归档。这里的完成状态区分方案、本仓实现、本地验收与真实集成，不按文档日期或旧勾选推断生产完成。

## 当前未完成工作

| 主题 | 当前状态 | 唯一主入口及剩余工作 |
|---|---|---|
| 表格默认排序与决策意见明细合并分页 | 业务规则已确认，Playground 归并预览可运行；通用协议待实施 | [实施主计划](2026-10-23-paged-union-table.md)、[页面入口](../../pages/capabilities/table/README.md#决策意见明细)、[合成样例](paged-union-table/example-input.json)：预览复用 query、查询 order 与分页，defaultSort/pagedUnion、检查点及真实接入另行承接 |
| DQE object 查询 | 本仓实现及本地验收完成，真实接入待验 | [实施计划](2026-10-23-dqe-object-query.md)：对象字段、页面交互、完整结果、关联及 local-authoring 已完成；[本地验收](../evidence/dqe-object-query/result.md)，真实 DQE 分页/排序/候选另验 |
| Report AI 总结重启 | 本仓实现与本地验收完成，真实云宝接入待验 | [主计划](2026-10-22-report-ai-summary.md)：双模式、区域范围、应用会话缓存、单文件云宝 mock；真实内网接入另验 |
| TypeScript 圈复杂度治理 | 已迁入最新main并执行完整验收；原清单现存文件超限175→125，4条定位待核 | [交付与验收](../evidence/code-complexity/2026-10-22-main-delivery.md)、[全部259条及剩余125个函数](../evidence/code-complexity/2026-10-22-original-list-follow-up.md)、[计划与规则](2026-10-22-code-complexity.md)；未宣称全量清零 |
| local-authoring 上下文与数据识别 | 本仓实现及本地验收收口；真实业务/重复模型统计待验 | [实施主入口](2026-10-21-local-authoring-context-optimization.md)、[验收记录](../evidence/local-authoring-context/result.md)：精确知识读取、页面与指标MD匹配、查询候选及独立分发；与并行filterGroup分开承接 |
| 表格列候选值与 DQE 对接 | 本仓引擎及本地验收完成；真实 DQE/Relay 编码与权限待核 | [主计划](2026-10-21-table-column-candidates.md)、[实施证据](../evidence/table-column-candidates/result.md)、[DQE 简要说明](table-column-candidates/dqe-handoff.md)：统一候选语义、保留 NO_PERMISSION、共享执行及独立 Skill 验证 |
| 图表 ECharts 隐含透传 | P0–P6 本地验收完成，已授权交付 main | [唯一主计划](2026-10-19-chart-echarts-option.md)、[ADR-0110](../adr/0110-hidden-echarts-presentation-options.md)、[验收证据](../evidence/chart-echarts-option/result.md)：Schema 6.32，首批柱/线/饼图、保护数据结构、单次回退、console-only、导出终止及安装消费闭合 |
| IOC公共页头 | B0–B5本地实施；B5仅传值、B6挂起，真实服务另验 | [唯一主计划](2026-10-16-ioc-header-feature-plan.md)：6.40含显式跨页输入、6.39时间模式/可信期间事实/候选窗口；[B5证据](../evidence/ioc-header-b5/result.md)。未迁移现有IOC业务页，真实DQE/CloudIOC/Relay另验 |
| Report 高清 PNG 导出 | 本仓实现与Chrome安装验收完成，真实门户/Edge待验 | [导出主方案](2026-10-16-report-png-export.md)、[验收记录](../evidence/report-png-export/result.md)、[按钮简化验收](../evidence/report-png-export/export-buttons.md)：6.31统一exportButtons、按配置直接下载PDF/单张PNG、独立文档与流式编码，页面/文档/Skill/属性编辑/分发及PDF回归完成；真实门户/DQE/Relay、Edge与部署另验 |
| 本地创作页面范式 | 独立规划待用户细化；六类为候选草案 | [范式设计规划](2026-10-19-local-authoring-patterns.md)：业务分组、阅读／操作顺序、选型与替换边界；先定分类及样卡，再实现与验收 |
| 已有权限下的页面显隐与区域联动 | 本仓实现、完整回归与Chrome安装验收完成；Edge及真实内网待验 | [唯一执行方案](2026-10-15-page-visibility-and-region-interactions.md)、[验收记录](../evidence/page-visibility-region-linkage/result.md)：6.34统一展示条件、显式父级规则、筛选事务、事实修订、交互/详情/导出、人工/AI创作与安装分发 |
| Dashboard 年季月与近一年筛选 | 本地实现及定向验收完成；真实接入未验证 | [验收记录](../evidence/dashboard-period-filter/result.md)；[实施规划](2026-10-15-dashboard-period-filter.md)：Schema 6.27、顶部 filter、模式恢复、创作和独立安装包；保留原查询聚合 |
| 多查询表格分页和共享查询 | P0–P5 已实施，P6 缺真实 DQE/Relay 上下文 | [实施方案与状态](2026-10-14-multi-query-table.md)、[验收证据](../evidence/multi-query-table/result.md)；6.22 组合查询源、共享执行、视图所有权与校验分发闭合 |
| 查询结果过滤与分页级联 | 本仓实现与本地验收完成，真实接入待验 | [实施计划](2026-10-14-query-result-page-input.md)：6.19 where、6.20查询窗口输入与任意列排序、共享执行/导出、配置说明及独立Skill；真实DS/DQE/Relay接入单独验收 |
| 平台打包与源码调试 | 第一期独立调试包本地完成，第二期真正分块未实施 | [两期计划](2026-10-14-platform-microfrontend-build.md)、[打包与调试](../platform-build.md)、[本地验收](../evidence/platform-debug-build.md)：后续测量分块收益，再冻结工具链并实施 |
| 共享页面取数 | 本仓实现完成，真实Relay/DQE接入待验收 | [实施主计划](2026-10-14-shared-page-data-execution.md)、[验收记录](../evidence/shared-page-data-execution/result.md)；取数包、引擎和Node程序共用查询核心 |
| **本次Report与Dashboard生成** | **方案已认可，生产实现未开始** | **[统一主计划](2026-10-12-report-dashboard-authoring-plan.md)**：六份分稿合并，集中目标、文本流程、computed、架构、C00–C11、协议、R/J/D依赖和验收；接口/部署选型仍待冻结 |
| 创作基线的内部接入 | 本仓主要批次已完成，真实接入待验证 | [创作基线与接入待办](authoring-current-status.md)：F01–F08承接版本采用、轮次/状态、授权、保存/预览、参数、原故障复验及旧页盘点 |
| 现有IOC四页优化 | 部分实现，整批未验收 | [四页主计划](2026-09-30-ioc-project-map-optimization.md) → [执行状态](ioc-project-map-execution/README.md)；查询键、区域映射、来源输入、导航/返回及整页验收仍有缺口 |
| IOC全量来源与能力迁移 | 未完成，部分来源/设计待核对 | [全量主计划](2026-09-23-ioc-full-page-capability-gap.md)；[M0/M1设计材料](ioc-m0-m1-2026-09-30/README.md)仍待评审；不得以四页或本次两页代替21入口验收 |
| IOC页内内容导航 | 功能验收完成，SDD汇总未收口 | [收口状态](ioc-content-navigation/README.md)：角色审阅clear，aggregate报告仍缺真实基线映射 |
| CodeCheck整改发布/复验 | 本仓整改完成，发布及外部复验待补证 | [当前整改记录](2026-09-30-codecheck-remediation.md)；旧IOC契约阻塞需按当前版本复核，不能把旧失败直接当成今日结论 |
| 页面管理与MetricCanvas UI | 交互/架构原则已确认，工程计划待决策 | [实施主入口](2026-10-12-platform-ui-management-implementation.md)，[交互规格](2026-10-12-platform-page-management-design.md)与[视觉/组件架构](2026-10-12-platform-os-theme-component-architecture.md)为基线；尚未实施产品代码 |
| 创作自动格式策略 | 待设计收口及实施 | [格式策略交接](2026-10-08-authoring-format-policy-handoff.md)；不以同期字段/坐标轴修复反推整套自动策略完成 |
| 目标门户微前端接入 | 通用实现本地完成，真实门户/服务未验证 | [接入状态](qiankun-platform/README.md)；不重复已完成的平台框架迁移 |

三组IOC范围独立：本次是**生成两页**，四页优化是**修现有业务页**，全量迁移是**覆盖全部来源入口**；它们可以共享能力和证据，不能互相代替完成判据。

其他独立在途批次的运行时实现与验收由对应提交交付，不包含在本次文档整理提交中。

## 已完成的本仓工作

| 工作 | 完成范围 | 查看结论或证据 |
|---|---|---|
| AI Summary 容器组合与顶部位置 | Schema 6.56，本仓实现与本地验收完成；未提交/推送 | [设计](../evidence/ai-summary-regions/design.md)、[验收](../evidence/ai-summary-regions/result.md)：组合卡准入、显式所在区域、顶部约束及独立 local-authoring |
| 显式数字颜色与图表标签 | 6.16声明、商务SDT迁移及本地验收完成；真实集成/发布未执行 | [批次结论](../archive/2026-10-12-explicit-presentation/README.md)、[验收](../evidence/2026-10-12-explicit-presentation/result.md) |
| 早期创作架构/模块收敛 | 本仓实现及各批次本地检查；外部待办已转当前接入入口 | [批次结论](../archive/authoring-foundation-2026-09/README.md)、[部署就绪证据](../evidence/2026-09-23-authoring-deployment-readiness-report.md) |
| 9235/9236执行整改 M0–M7 | 本地回归、真实模型分批复验及本地浏览器；内部采用/生产未执行 | [执行报告](../evidence/2026-09-29-authoring-mc-execution-report.md) |
| 页面参数本仓实现 | 提取、实例、引用与正交化等历史实现；外部链路和旧页整批迁移单列待办 | [批次结论](../archive/page-parameters-2026-09/README.md)、[现行参数文档](../../PAGE-PARAMETERS.md) |
| 报告日期筛选及完整实例导出 | Schema 6.13范围、本地测试和浏览器/PDF验收 | [验收](../evidence/report-date-filters/acceptance.md)、[本地交付记录](../evidence/report-date-filters/main-delivery.md)；CI/部署不由本表推断 |
| Tiny OS日期选择器及白色工具带 | 指定范围内本地视觉/行为验收已收口 | [批次结论](../archive/report-date-ui-2026-10/README.md) |
| 通用HTML微前端及候选loader | 本地实施、构建及候选主应用验收 | [实施证据](../evidence/qiankun-platform/implementation.md)；真实门户仍在上表 |
| 本次创作流程设计 | 两页范围、整体文本流程和D1–D7；生产实现尚未开始 | [主计划完成状态](2026-10-12-report-dashboard-authoring-plan.md#1-完成状态)、[ADR-0098](../adr/0098-profiled-page-composition-and-incremental-navigation.md) |

## 历史分稿与本次整理

- [本次六份方案的历史快照](../archive/report-dashboard-design-2026-10-12/README.md)：已被统一主计划替代，不再作为执行入口。
- [旧IOC阶段计划](../archive/ioc-planning-2026-09/README.md)：旧五页推进顺序被四页主计划替代，未完成缺口仍保留。
- [整理记录与移动表](../archive/plan-cleanup-2026-10-12/README.md)：可追溯原路径；归档不代表相关产品能力全部完成。

后续一个批次只维护一份执行主计划。已确认原则链接ADR；详细证据链接evidence。主计划就地更新流程、任务和状态，不再为每次补充新增独立方案；移走旧计划前先转移仍未完成的任务。

## 四种寿命，四个去处

判据两条：**这份文件还会被改吗？还会被当论据引吗？**

| 去处 | 什么进去 |
|---|---|
| `docs/plan/`（这里） | 还在做的计划、规格草案、进行中的盘点 |
| [`docs/evidence/`](../evidence/README.md) | 被 ADR 正文或代码当**论据**引用的报告与基线。跟决策走，不跟批次走 |
| [`docs/archive/<批次>/`](../archive/README.md) | 已收口批次的过程件。只读，**探索时默认不读** |
| 消费者旁的 `fixtures/` | 被测试直接读取的机器证据。它不是文档 |

不确定时按后果判：移走它会不会切断某份决策的论证链？会 → `evidence/`。会不会让某个测试红？会 → 夹具目录（并同步改引用方）。都不会且不再更新 → `archive/`。

**夹具放哪跟着消费者走**，仓里既有的写法就是这样：`packages/page/fixtures/`、`apps/platform/tests/workbench/fixtures/`、`tools/dqe-sim/fixtures/`、跨包共享的 `tools/fixtures/legacy-contracts/`。没有统一的 `tests/fixtures/`，也不要为两个文件新造一个。

## 批次收口的三件事

缺一件就不算收口：

1. **抽结论**——仍然生效的裁决写进 ADR 或正式协议文档，过程件里不留唯一副本。做法见 [`docs/adr/README.md`](../adr/README.md)：新 ADR 要并进对应[主题页](../adr/topics/)，不在文末追加附录段。
2. **写结论页**——`docs/archive/<批次>/README.md`，三段式：这批做了什么、**最终结论落在哪**（ADR 编号 / 协议文档章节 / 代码位置）、过程中被推翻的方向与推翻它的依据。目标是探索时读 1 页而不是 75 份票据。
3. **整批移走**——连同实证与证据 json 一起移，然后扫一遍全仓改链接。链接不要靠字符串替换猜：按旧位置解析成仓内路径，套用移动表，再按新位置重新相对化。

## 机器证据不要放这里

json / txt / py 这类**不给人读**的执行留痕，如果被测试引用就进消费者旁的夹具目录，否则随批次进归档。判断标准不是体积，是「有没有人会读它的正文」。

**这条只管新产生的东西，不回溯改已冻结的批次。** `authoring-tickets-126/t04-contract-examples.json` 与 `unified-authoring/2026-09-15-unified-authoring-s0-sources.json` 被三处测试直接读取，却留在归档批次里——2026-09-21 逐个看过后决定不迁：批次内部的 checker 脚本按同级文件名找它、实证正文写着「同目录」，迁走就得改已冻结的记录。两处批次结论页都写明了它们是 CI 的真实输入。判据与例外的完整理由见 [`2026-09-21-docs-consolidation.md`](../archive/docs-consolidation/2026-09-21-docs-consolidation.md) §4.6。

IOC当前：B0–B4本地完成；B5按用户收窄为显式跨页传值、不恢复；B6挂起。主计划§22为准。
