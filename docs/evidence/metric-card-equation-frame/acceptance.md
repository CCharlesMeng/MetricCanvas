# 指标卡连接组拉宽与外框验收

2026-10-21，基线 d07c6a31812742a071145066ad323aa9fe17b567，独立工作区 metric-equation-frame。

用户要求前两天的指标卡带文字场景自动左右对齐拉宽，并用 `border-box`、`1px solid rgba(0,0,0,0.1)`、`16px` 圆角和白底的大区域包裹整组。用户审核原型后确认保留独立小卡片，并指定连接文字两侧各8px、小卡白色背景。最终在既有 MetricConnectionRow 和 RuntimeSection 的组件单元格上完成，不新增协议字段。小卡面采用白底、1px灰边和12px圆角；外框16px圆角及20px内边距保持。整组仍按成员 span 之和占列，合计12时占满分区；内部卡片按 span 比例分配，扣除边框、20px内边距、文字与双侧gap；不足144px卡片预算时单列。

## 对应关系

- 正式页面：`pages/metric-card-equation.json`，既有目录注册保留。预览入口 `http://127.0.0.1:5181/pages/metric-card-equation`；5181由本独立工作区提供，原5173进程来自另一个工作区，未替换。
- 文档：`PAGE-METADATA.md`、`docs/page-metadata/components/metricCard.md`、`sections-and-layout.md`、`pages/README.md`。
- 本地创作：从上述真源通过 `pnpm authoring:contracts` 重新导出知识、快照与哈希锁；没有手改派生文件。导出器管理的其他分发投影随同更新，没有追加其他Skill或真实模型验收。

## 浏览器结果

在页面试验场实际页面查看了符号公式和“其中”两组：灰色边框包裹整组，四卡左右拉宽，连接文字保留。最终截图：[实际页面](playground-confirmed.jpg)，[窄屏](playground-mobile.jpg)。第一阶段截图playground.jpg保留作为被用户纠正的历史结果，不代表最终验收。该截图视口1280px，组宽1233px，四卡宽为278.25/278.265625/278.265625/278.265625px，左右外边缘到首尾卡片均为21px（1px边框+20px内边距）。computed style确认为border-box、1px solid rgba(0,0,0,0.1)、16px圆角、rgb(255,255,255)背景。最终两组12处水平间距实测均为8px，小卡背景全部为rgb(255,255,255)，小卡1px灰边、12px圆角且内部指标面板无重复边框；测量回执为confirmed-geometry.json。

生产global与ESM浏览器用同一页面，2项通过，覆盖小卡独立白底灰边、内部无重复边框、1440px四卡等宽及两组双侧8px；1980/1024/800px外框填满所占列、左右内容边缘对齐；680px局部容器扣除外框后的预算退化；部分跨度和390px窄屏单列及纵向8px，无页面横向溢出。

## 已执行检查

- `pnpm --filter @metriccanvas/embed build`：通过。
- `pnpm --filter @metriccanvas/embed exec playwright test metric-before.spec.ts`：2项通过。
- `pnpm --filter @metriccanvas/engine check`、`pnpm --filter @metriccanvas/embed check`：0错误、0警告。
- `pnpm exec tsc --noEmit -p tests/tsconfig.json`：通过。
- `pnpm exec vitest run packages/engine/runtime-ui/tests/metric-connections.test.ts tests/local-authoring-skill.test.ts tests/page-reference.test.ts tests/authoring-export-isolation.test.ts`：4文件49项通过，包括仓外独立安装、链接闭合和校验。
- `pnpm validate`：57个页面通过。最初把单文件传给只接收目录的仓库CLI得到ENOTDIR，改用正确入口并另外运行Skill单文件校验，均通过。
- `node metriccanvas-authoring/skill/metriccanvas-local-authoring/scripts/validate-page.mjs --expected-layout dashboard pages/metric-card-equation.json`：通过。
- `pnpm authoring:contracts:check`：961份产品、4份创作、1份接口投影一致。
- `python3 metriccanvas-authoring/scripts/check_bundle.py`：3356项摘要检查通过。

使用inline演示数据；本批没有改变查询、公式或业务数据，没有真实DQE/Relay/模型验证。未提交或推送，未执行远端CI。

## 标题体系修正（2026-10-21 用户补充）

用户明确取消“plain沿用共用标题”的规则，Report与Dashboard标题必须分别呈现。本批将RuntimeSection分区标题的样式明确按data-page-layout-form选择：Dashboard四种容器（含缺省）统一黑色16px/500/24px、左对齐且无装饰；Report保留各层级标题。text.heading补齐Dashboard独立呈现；Dashboard页面、组件和分区标题颜色也不再引用Report文字颜色变量。ExportView显式携带页面layout，确保独立导出文档命中Report标题样式。

新增并注册的正式对照页为pages/dashboard-title-styles.json与pages/report-title-styles.json，两页均只有静态内容，无服务依赖。文档同步PAGE-METADATA.md、sections-and-layout.md及components/text.md；reference-map登记来源与完整示例，导出器从pages真源生成conformance/valid及独立Skill中的完整例子，避免复制维护第二份页面。

实际页面试验场截图：[当前指标卡页](playground-dashboard-titles.jpg)、[Dashboard标题对照](dashboard-title-styles.jpg)、[Report标题对照](report-title-styles.jpg)。当前指标卡页实测“收入构成”“业务拆分”均为16px、500字重、rgb(25,25,25)，::before content为none。

浏览器layout-titles与metric-before共4项通过：1440/390宽度，四容器与text.heading，Report→Dashboard→Report切换，Report专属字号/颜色变量被改动时Dashboard标题保持独立，独立白色小卡与双侧8px回归。report-pdf中“页面配置驱动ShadowRoot里的PDF按钮和实际下载，无新窗口”1项通过。engine/embed检查0错误0警告，生产embed构建通过，测试TypeScript检查及report-pdf派生一致性通过；59个正式页面校验通过。

首次对照页校验发现组件ID跨分区重复，已改为全页唯一并通过。首次目录测试发现Report示例摘要中的英文Dashboard使关键词命中Report页，已改为准确的中文对照描述，目录9项定向复验通过。

最终创作投影965份产品、4份创作、1份接口一致；Bundle 3368项摘要通过。两种标题完整例子均进入独立Skill，产品/Skill单文件校验通过。最后一次相关检查中其余4文件52项通过；手册测试的来源加载清单未包含新增两份页面导致suite加载失败，已同步清单后定向6项全部通过（合计58项）。测试TypeScript与git diff --check通过。仍未提交/推送或运行远端CI。

## main交付前复验

用户授权提交并push main后，已fetch并整合最新基线b21eac59c5c7435d3ab5044159708ba343695759（包含同期表格候选、单元格交互及目录过滤修复）。冲突仅在生成清单/哈希锁和README追加处，说明保留双方内容，派生物从合并真源重生成。

在该基线上复验：pnpm check、pnpm build、pnpm packages:check通过；61个页面校验通过；标题宽窄屏、global/ESM指标卡及PDF下载浏览器5项通过；经pnpm test入口（含svelte-kit sync）运行7个相关测试文件，86项全部通过；authoring投影965/4/1一致、Bundle3368摘要检查通过。没有使用skip ci。下方历史“未提交”是当阶段状态，最终远端SHA及CI以交付回执为准。

原型源码仅保留在本地codex/metric-equation-prototype分支，不进入main；原型图属于设计过程证据，最终行为以正式页面和浏览器验收为准。
