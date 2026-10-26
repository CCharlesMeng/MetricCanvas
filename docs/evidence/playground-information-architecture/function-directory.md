# 数据功能目录与布局形态区分

截图、日志与机器报告仅保留本机；最新基线复验见[交付记录](delivery.md)。

2026-10-24，回应用户指出的两个问题：数据入口混排 Report／Dashboard，右侧选择按场景而非功能组织。

## 调整结果

数据与联动按「实际页面布局形态 → 六个数据阶段 → 具体功能 → 直接相关的演示」查找。阶段名称保留，右侧不再显示“能力场景／演示变体”两个下拉框，而是可直接点击的功能入口；一个功能只有一份演示时显示名称，不增加选择层级。

`scenarios/data-features.ts` 维护 35 项功能及精确页面引用，场景模块继续拥有演示环境、可信输入和跨页组。页面与功能之间复用引用，不复制页面文档。当前 Dashboard 有 30 项可观察功能、Report 有 21 项；这是演示覆盖数量，不是两种布局的产品能力上限。形态从页面实际声明读取，不能按文件名、场景名或目录猜测。按键补列与专用适配器的多来源有序合并分别呈现，当前查询窗口与完整结果也明确区分。

搜索在当前形态中返回功能及所属阶段。关联入口指向具体功能；左侧数量改为当前形态的功能数。`layout`、`feature` 进入开发工具 URL，旧 `scene`／`example` 链接按实际页面解析；失效或不匹配选择有明确回退提示。导航参数不进入运行页面文档，`exampleSearch` 仍封装显式运行参数。

跨页流程可以从 Dashboard 清单进入 Report 详情，目录跟随实际目标形态并保留显式参数。共有演示的挂载仍由父目录持有，跨组件和数据入口保持同一实例。

## 验证

- Dashboard 截图（本机原始产物 `functions-dashboard.png`）、Report 截图（本机原始产物 `functions-report.png`）、窄屏截图（本机原始产物 `functions-mobile.png`）。阶段标题与布局切换同行，场景说明继续默认折叠。
- 浏览器记录（本机原始产物 `function-directory-browser.json`）：两种形态各六个阶段均可访问，计数与可见功能一致；Report 时间选择仅出现两份实际 Report 演示；搜索“补列”直接命中按键补列，单一演示没有下拉框。
- Dashboard 来源 → 清单 → Report 详情实际传递 `P&中文/001`、`2026-09`、人民币、南北区，目标回显与目录选择一致。
- 局部筛选选中订单量后，跨到独立筛选组件目录再回功能入口，选择仍保留。浏览器返回恢复时间范围功能。
- 390 CSS 像素下 `scrollWidth=clientWidth=390`，功能点击可用；测试结束恢复默认视口。
- Playground 回归（本机原始产物 `function-directory-tests.log`）：18 文件、86 测试通过，包括新增 5 个功能目录测试；覆盖引用完整性、真实形态过滤、功能精确映射、旧链接与不可用回退、参数封装及功能搜索。初次全量检查发现源码局部变量名命中旧页面 `demo` 的字符串扫描，改用中性名称后全量通过，未放宽原门禁。
- Svelte 与类型检查（本机原始产物 `function-directory-check.log`）：0 errors、0 warnings；静态构建（本机原始产物 `function-directory-build.log`）成功。
- local-authoring 一致性（本机原始产物 `function-directory-authoring.log`） current；仓外安装与页面校验测试（本机原始产物 `function-directory-local-authoring.log`）21 项通过。同步 Playground 说明、路由文档、实施计划和页面元数据入口说明；本批不更改页面协议，分发知识没有新语义。

以上是目录导航、既有运行时和本地合成流程证据，不代表真实 DQE／Relay／CloudIOC 验收。本批未重新验收 PDF 文件内容或导出服务。

## 复杂度与范围

使用 `metriccanvas-ts-ast/1`，覆盖两份 Svelte script、目录函数、功能映射及测试回调；Svelte 编译器单独提取模板内函数表达式后测量。共 134 个函数与闭包，自身 CC 最高 7，无超过 15 的项。前（本机原始产物 `function-directory-complexity-before.json`）、后（本机原始产物 `function-directory-complexity-after.json`）。前基线仅包含原有脚本和 TS，未用 script 数值替代模板复杂度。

| 函数 | 修改前 | 修改后 |
| --- | --- | --- |
| `catalogHref` | 5 | 6，增加可选功能参数 |
| `sceneRelations` | 1 | 1；新增筛选回调最高 3 |
| `setQuery`／`selectExample` | 2／2 | 2／2 |
| `selectDataExample` | 新增 | 2 |
| `dataLayout` | 新增 | 5 |
| `resolveFeature` | 新增 | 7 |
| 功能控件 `changeLayout`／`selectExample`／`featureLink` | 新增 | 1／3／4 |
| 其他新增映射、搜索辅助函数及其闭包 | 新增 | 1–3 |

本次测量范围没有未关闭超限项。没有提交、推送或执行远端 CI；共享工作区其他批次修改保留。
