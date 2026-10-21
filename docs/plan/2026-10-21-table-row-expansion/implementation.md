# 行内子表格实施与验收

2026-10-21。已完成用户确认的非导出范围；Q5导出范围仍挂起。实现位于独立工作区 `/Users/moon/.codex/worktrees/table-row-expansion/DataDashboard`，Git交付见本文末尾。

## 可直接检查的页面

- [父行自带明细](http://127.0.0.1:5182/pages/table-row-expansion-inline)：无需后端；第一张表默认干净、多行展开，第二张按需声明标题、搜索、排序和单行展开。
- [按父行查询分页](http://127.0.0.1:5182/pages/table-row-expansion-query)：本地合成DQE Sim；C01共25条、C02共18条、C03为空。两张表的模板查询分别独占定义，展开才发请求。
- [桌面实际页面](evidence/implemented-query.png)：C01第2页、C02第1页同时展开，白底，无默认标题、搜索或排序入口；使用现有Table的总数、页大小、编号页、上一页/下一页及跳页。
- [390px实际页面](evidence/implemented-query-narrow.png)：父表与子表分别拥有横向滚动；子表分页按可视宽度换行。子表177px可视宽度、420px内容宽度；下一页按钮右边界212px，在父表右边界311px内；页面scrollWidth=390。

启动：`DQE_SIM_PORT=18239 DQE_SIM_HOST=127.0.0.1 pnpm sim:dqe`，另开终端 `DQE_SIM_PORT=18239 pnpm --filter playground dev --port 5182 --host 127.0.0.1`。原5173进程不变。

## 实现与协议对应

| 范围 | 真源 / 行为 |
|---|---|
| 6.44页面协议 | `packages/page/src/schema/components/table.ts`、`row-expansion.ts`、`validate-row-expansion.ts`、`version.ts`；rowExpansion非递归，recordList/query显式分支，父/子稳定行键、专属查询源与私有输入校验 |
| 延迟执行 | `packages/data-execution/src/source-scope.ts` 排除首屏子表查询；不放宽详情视图完整结果要求 |
| 私有作用域 | runtime `row-expansion.ts` 每个父行独立stream、条件、窗口、快照、取消与代次；折叠/离开父页销毁，重开回第一页；每父表最多4个并发请求 |
| 查询语义 | 复用SourceProgram、TableSession；使用映射行键补齐最终稳定排序；默认排序保留；排序/搜索/页大小重置第一页；错误重试保留目标页 |
| 实际呈现 | `ExpandableTable.svelte` / `ScopedTableContent.svelte` 组合现有Table与TableController；白底干净默认；不复制分页控件 |
| 几何隔离 | Table仅测量自身表头、colgroup和fixed单元格；变体样式不向子表传播；展开区按父表可视宽度约束，复用既有分页换行 |
| 元数据文档 | `PAGE-METADATA.md`、`docs/page-metadata/components/table.md`、fields/data-sources、reference-map及4个合法契约夹具 |
| 领域结论 | `CONTEXT.md` 与ADR-0113、page-document-structure主题页 |
| 本地创作Skill | 从上述产品真源生成协议、示例、独立校验器、知识/哈希清单；`table-row-expansion-inline/query/inputs/none`覆盖来源、输入和分页分支 |

基线提交952b3a27。为复用用户当前的现有Table呈现，显式承接原工作区的Table.svelte、TableControlIcon.svelte、table-geometry.ts三项既有TinyVue OS呈现前置；原始SHA-256见[基线清单](implementation-baseline.json)。这些前置不归为本次新增设计，其余并行改动未复制。使用原工作区当前AGENTS.md的组件复用及实际页面验收要求，不使用历史SDD流程。交付整合时必须保留这些前置及并行任务的更新。

## 首次基线952b3a27的执行证据

- `pnpm test packages/page/tests packages/engine/runtime/tests packages/engine/widgets/tests packages/data-execution/tests tests/local-authoring-skill.test.ts tests/page-reference.test.ts tests/authoring-export-isolation.test.ts`：初次141文件1258项中1256项通过；两项暴露编排层方言访问及变体样式源码断言问题，已修复。随后包含这两项的4文件27项定向复测全部通过；再增加并发队列边界后，行内子表格runtime 5项通过。未把初次整套执行表述为全绿。
- 新增协议14项、runtime 5项、Sim 4项；协议拒绝低版本、缺行键、共享源、不完整输入、完整结果/本地窗口混用、缺映射、动作、递归与未定导出。runtime验证懒执行、独立分页/搜索/排序/页大小、取消/迟到、失败重试、缺输入、重复子行键和并发排队取消。Sim测试直接读取正式query页面，经真实DQE网关编码与本地HTTP服务执行。
- `MC_EMBED_EXAMPLE_PORT=4183 pnpm --filter @metriccanvas/embed test:browser tests/browser/table-row-expansion.spec.ts tests/browser/table-toolbar.spec.ts`：11项通过，含5项子表行为与6项现有表格搜索/导出/详情回归。实际分页窗口、可选配置、single模式、父页切换、空态、失败重试、390px分页右边界均有断言。
- `@metriccanvas/page`、`@metriccanvas/data-execution`、`@metriccanvas/engine`、`@metriccanvas/dqe-sim`检查通过；engine为0错误/0警告。tests/tsconfig类型检查通过。
- embed生产构建、Playground生产构建通过；31个正式页面文档校验通过。
- `authoring:contracts:check`通过；`check_bundle.py`验证2766次摘要检查；本地创作Skill、协议参考、导出隔离测试在上述广回归中通过。仅验证local-authoring，不追加历史其他Skill行为或真实DS模型。
- 独立复制Skill到仓库外，仅使用该副本Node校验器验证两个正式页面，均通过，见[独立安装回执](evidence/standalone-skill.json)。
- 实际Playground浏览器验证Sim的两个父行独立分页、跳至第3页、白底、390px无整页溢出及分页可达；最后捕获error日志为空。截图来自真实运行时，原型截图仍单列为设计阶段证据。
- ADR索引、生成一致性及`git diff --check`通过。没有提交、推送、CI或远端SHA证据。

## 仍待确认 / 不作已验收声明

Q5父/子XLSX与页面PNG/PDF范围由用户挂起。子表无导出字段；带子表父表导出和页面内置导出配置在协议校验中明确拒绝，不替用户决定范围。其他普通表格既有导出继续回归。

查询搜索仅在显式声明并具备网关encodeSearch时可用；当前query演示未伪造DQE搜索编码，inline演示提供搜索，runtime测试验证查询搜索透传及实例隔离。真实DQE、Relay、宿主身份/权限、大数据性能与真实DS模型尚未执行验收；本地Sim和注入网关证据不能替代。

实时offset分页依赖数据方保证子行键全结果唯一；当前窗口可检测重复键，无法仅凭当前页证明全结果唯一，也不提供快照token/cursor保证。


## 2026-10-21 main整合交付

用户授权提交与push，并要求Playground可见。按scoped-main-delivery在原独立工作区交付，原混合工作区未改动。交付前fetch确认origin/main为431f2e91；将本批rebase到该基线，保留已经发布的IOC选择、搜索选项、条件呈现与TinyVue OS表格更新。[整合后实际查询分页截图](evidence/delivered-query-main.png)。原前置样式已在main发布，最终diff仅包含子表需要的承载、作用域及几何隔离。

main已使用6.43，本能力按独立版本门禁升为6.44，合法示例、文档、契约向量与安装包统一再生成；ADR编号调整为0113。新增内部导出显式登记到public-api/page.txt，主入口公开面未变。展开区的自身DOM选择器采用:where维持既有样式优先级，普通、forecastMatrix、embedded与reportCompact的已有表现继续回归。

- 整合后全仓pnpm check通过；后续engine复查0错误0警告。
- pnpm test：297文件中296通过；2585项通过、5项跳过，唯一失败为内部公开面快照新增6项尚未登记；补齐后public-api 8项定向复测通过。完整CI在push后另行核对，不把这次本地整套执行写成全绿。
- 子表、原工具栏、TinyVue OS浏览器回归20/20通过，含既有静态导出与官方CSS像素比对；新版目录9/9检查通过，两个子表页面均有运行条件、操作说明、配置定位与关联入口。
- pnpm build、pnpm build:playground通过；57个正式页面校验通过。
- authoring:contracts:check通过（961 product、4 authoring、1 interface）；Bundle校验3356项通过。更新后的local-authoring仓外安装独立校验两个6.44页面通过，回执附输入SHA-256。
- Playground运行于5182，本地DQE Sim运行于18239；原5173与其并行工作区保持。因用户需要继续预览，暂保留本任务工作区与预览服务。

Q5导出范围、真实DQE/Relay、身份权限、大数据性能与真实DS模型边界保持不变。CI结果由本次交付提交对应的GitHub Actions运行及交付答复报告。
