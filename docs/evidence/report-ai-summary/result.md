# Report AI 总结本地验收

2026-10-22；隔离工作区 report-ai-summary，基线 a1618d7e。实现与本地验收完成，未提交、未 push，主工作区并行改动未修改。

## 接入结果

云宝助手唯一实现文件为 `packages/application-runtime/src/yunbao-assistant.ts`：`async generate(question, contextInfo): Promise<string>`。本地为明确标记的 mock，内网替换函数体构建 SSE、消费事件并返回完整 HTML/纯文本；Playground、Platform 阅读、工作台及发布/参数预览共用此文件。集成应用持续使用同一 aiSummary 配置对象，组件卸载只取消订阅。

Schema 6.50 支持 Report 提供正文与动态生成两模式；显式数据源字段优先，否则按 section 当前可见组件及活动 Tab 收集非明细数据。分析输入冻结查询条件、实际时间、字段、结果范围、数据及状态。空或失败交给分析实现。后台任务按完整输入去重、每区域节流、全局并发；切换不取消已启动请求，完成后缓存，返回时复用。命中缓存也会清理同区域过时的待启动任务。

受控 HTML 不合规时提取纯文字，保留段落；不执行脚本、属性或加载资源。导出使用当前输入的完整正文，保留降级格式，未完成时显示占位。

旧组件内盘古 SSE、流式会话和 Markdown 路径及对应旧专用测试已由新 Interface、任务和正文测试替代；旧 Dashboard 混合示例中的 AI 总结迁为普通说明，Report 示例继续覆盖生成。

## 验证

| 检查 | 结果 |
|---|---|
| 页面、runtime-ui、data-execution 回归 | 131 个文件、1109 项通过，见 unit-tests.log |
| 浏览器 | 4 项通过：双区域字段范围、切换迟到隔离与复用、销毁重挂载、Tab 保留、完整 HTML、既有样式与 PNG 导出；见 browser-tests.log |
| 实际 Playground | http://127.0.0.1:5177/pages/report-ai-summary；本地 DQE Sim :18229；手工切换月份、返回、实际 PNG 下载成功，见 playground-export.png |
| 全部示例 | 83 个页面通过校验，见 pages.log |
| local-authoring | authoring:check 四组共 73 项通过；最终生成后重新执行知识/参考/Skill 三组 50 项通过；见对应日志 |
| 分发一致性 | authoring:contracts:check 通过（1076 product、4 authoring、1 interface）；见 contract-check.log |
| 仓外安装 | 复制完整 local-authoring 到临时目录，使用该副本校验本次页面通过；见 independent-skill.json |
| 类型与构建 | Engine、Embed、application-runtime、Platform、Playground 检查与根 tests 类型检查通过；packages、最终 Engine、Embed、Platform 构建通过 |

浏览器验收发现并修复了 Embed 中 Svelte 深层代理改变配置对象身份的问题：AI 配置以 raw 状态保存，跨挂载复用同一应用会话。测试使用同一注册页面及其真实时间和导出声明。

## 复杂度

口径：metriccanvas-ts-ast/1，TypeScript 5.9.3，自身 CC；Svelte 的 module/instance 脚本分别提取。扫描全部本次手写新增/修改源文件与测试；生成分发包不作为手写源码重复计数。完整前后测量见 complexity.json，初始重点基线见 complexity-before.json。

| 函数 | 之前 | 之后 |
|---|---:|---:|
| RuntimeSurface.prepareReport | 6 | 6 |
| validate.checkAiSummary | 3 | 4 |
| 版本能力期望测试回调 | 58 | 2 |
| assembleGenerationInput | 新增 | 7 |
| task-session.pump | 新增 | 8 |
| task-session.watch | 新增 | 2 |
| aiSummaryRelatedData | 新增 | 4 |
| summaryContent | 新增 | 5 |

54 个本次源文件中，修改/新增函数最高 15；新增运行时函数最高 8；本次超限未关闭项 0。未将其他未改函数的存量复杂度宣称清零。

## 证据边界

本地 mock 与 DQE Sim、静态协议、独立 Skill、浏览器及构建通过。真实云宝助手 SSE、内网身份、真实 DQE/Relay 与 CI/远端交付未执行，不以本地结果替代。

## SDT 报告摘要外观对齐（2026-10-22）

根据用户指定的实际 SDT 页面复核，目标是 ReportHeader 内的完整“报告摘要”，不是 TextBlock insight。提取 widgets/shared/ReportSummary.svelte，SDT ReportHeader 与默认 AiSummaryView 共同调用它；渐变面板、居中双侧装饰标题、白色内框、浅紫正文描边、18px/32px 字体与行高只维护一份。默认标题为报告摘要；显式 reportInline 继续复用 TextBlock。局部重试使用既有 UI Button；文本降级保留换行。SDT 页面 JSON 无修改。

Playground 实际入口 http://127.0.0.1:5177/pages/report-ai-summary 已观察完整正文、降级换行、两个 Mock 区域。浏览器对比直接读取 SDT 原始页头正文，在 1440/640 视口将摘要设置为相同宽度，逐项比较尺寸、padding、margin、font、color、background、border、radius 与 gap；对齐通过。截图见 ai-summary-1440.png / ai-summary-640.png 和相应 sdt-reference 文件。截图保留各自页面背景，不宣称整图每个像素相等。

最终浏览器 6 项通过（含宽窄外观、原有四档 Report 样式、时间切换、后台缓存、重挂载、导出）。page-reference/local-authoring-tools/local-authoring-skill 50 项通过，独立安装覆盖在 local-authoring-skill 中；另有任务/输入等 63 项组合检查通过。Engine/Embed 类型检查和 Embed 构建通过；派生协议导出 current。

复杂度使用 metriccanvas-ts-ast/1、TypeScript 5.9.3，Svelte script 单独提取。原 AiSummaryView 脚本无函数，新增 summaryBody 自身 CC=5；共享组件和 ReportHeader 脚本无新增函数；新增浏览器测试回调最高 CC=2，原回调最高 3 未增。本次无超限未关闭项。完整记录在 visual-complexity.json；Svelte 模板分支人工核对，不混同 TypeScript 函数测量。

架构图与职责见 docs/plan/2026-10-22-report-ai-summary.md。云宝 SSE 仍由内网替换单文件实现；本轮未提交或 push。

## 功能目录收拢（2026-10-22）

根据用户要求，将原 AiSummaryHost 重命名为 AiSummary.svelte 作为入口；输入与页面上下文合并到 runtime/input.ts，后台任务位于 runtime/session.ts，正文适配与纯渲染位于 view/，云宝唯一文件移至 adapters/yunbao-assistant.ts。模块外的引擎引用统一经过 index.ts。原 application-runtime 的云宝文件与临时 subpath 已移除，Playground / Platform 改由 @metriccanvas/engine/ui/ai-summary/yunbao-assistant 按需导入同一配置；主入口不自动加载 Adapter。公开 generate Interface、缓存身份、节流、并发与呈现行为保持。

实际 Playground 5177 已确认后端正文、文字降级、两个独立 Mock 区域正常展示。回归 131 文件 / 1109 项通过，浏览器 6 项通过，文档及 local-authoring（含仓外安装）50 项通过。Engine、Embed、application-runtime、Platform、Playground 检查通过；Engine 与 Embed 构建通过，契约生成 current。未联调真实云宝 SSE。

复杂度仍使用 metriccanvas-ts-ast/1 / TypeScript 5.9.3；对全部迁移实现、Adapter 与两个 Svelte script 实测前后，逐函数 selfCC、optionalChains、subtreeCC、nestedFunctions 相同。input 最高 7→7，session 最高 8→8，View 的 summaryBody 5→5；无新增函数和超限未关闭项。对照见 restructure-complexity-before.json、restructure-complexity.json。本轮未提交或 push。

## main 交付前核对（2026-10-23）

基线同步到 origin/main 的 713586a7017d997fc334bb1394c80d254c99ae1a。main 已有 query-modes 6.50，本次 AI Summary 使用独立能力名 ai-summary-report-modes、版本下限 6.51；当前作者协议 6.51。源代码保留两边改动，契约与 local-authoring 从合并后真源重新生成（1090 product、4 authoring、1 interface）。云宝唯一文件以当前模块 README 所述 adapters/yunbao-assistant.ts 为准，仍为 Mock。

公开导出登记与快照补齐生成 Interface 和云宝独立入口。Dashboard 混合内容改为 text 后，一并删除失去消费者的 summary-data，避免一次性执行器额外查询。Tab 回归相应确认未消费来源不参与摘要查询。

完整检查也覆盖了 main 示例改版后的旧连接测试：将改版前的四卡声明冻结为 tests/fixtures/metric-before-legacy.json，保留原有连接/编辑/显隐回归；现行 Playground 页面不回退。页面 id 中立检查明确排除 prototypes 原型/旧导航目录，正式产品源码仍保持严格检查；AI 能力内部名不复用页面 id。

本地结果：84/84 页面校验、全仓类型检查、完整 pnpm build、六交付物包入口/声明/组件检查、6 项浏览器回归和契约漂移检查通过。全仓 pnpm test 为 317 文件/2751 项通过、5 项既有跳过，仅隔离导出首项子进程触及原有 30 秒限时；停止并行构建后单独复跑该项通过（13.24 秒），未调整任何超时门禁。其余隔离场景与仓外安装已在全仓检查中通过。CI 结论以最终提交对应的 GitHub Actions 为准。

交付补充复杂度使用 metriccanvas-ts-ast/1 / TypeScript 5.9.3。改动测试回调最高 13，页面 id 扫描回调 3→5；其余相关函数保持原值或减少一个已无意义的等待回调。tools/package-build/surface.ts 仅登记导出入口，未改的 exportedNames 仍为 CC=30，不归本次重构范围。全部修改函数无超限未关闭项，详见 delivery-complexity.json。此前功能实现/目录重构的测量继续适用。

主工作区与其他并行 worktree 的文件不作修改；本次按精确路径清单提交。真实云宝、内网身份、DQE/Relay 联调仍需内网另验。

## 安装消费者浏览器验收补齐（2026-10-23）

首个交付提交 ac64e8f6 的 CI 中，build/tests/types/authoring 均成功；compatibility 的 Chrome/Edge 共 498 个浏览器场景中 478 个成功、20 个失败。下载 consumer-browser.log 后确认失败全部是旧验收预期：16 个 Dashboard 展示矩阵仍放入 Report 专用 AI Summary，4 个 Tab 场景仍计入已经移除的 Dashboard 摘要查询。

测试矩阵按声明适用布局选择用例：Report 保留全部 54 个分支，Dashboard 为 52 个；非法 Dashboard AI Summary 仍由页面协议负例验收。Tab 请求预期与真实已消费来源同步，不减少页面内的交互或保活断言。产品源码和协议不变。

本地重跑对应 10 个 Chrome 场景全部成功（8.1 秒），Embed 检查及契约漂移检查通过；Edge 安装消费者结果以补充提交 CI 为准。复杂度 metriccanvas-ts-ast/1 / TypeScript 5.9.3：适用布局筛选回调 1→3，矩阵测试回调 2→3，Tab 回调不变；无超限未关闭项，见 browser-compatibility-complexity.json。
