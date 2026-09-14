# T05 / #131 浏览器消费迁移回执

S2 task `01a09f69-a06b-7703-b87b-ccdfe05d765e`；工作树 `/private/tmp/metriccanvas-126-s2`；分支 `codex/s2-browser-layout-131`。基线 `32d0e08976b443aed69d18922f12da051470fbc6`，含S0已验收#129；切分支后先复验18项布局兼容测试通过。

## 行为与验收

| 验收 | 实现与证据 |
|---|---|
| 构造/读取/渲染/示例统一新版 | 工作台createCanvasAuthoringDraft先normalizePageDocument，canvas/page双投影均6.1/layout；两种promote输出规范化；playground载入与即时预览规范化；四份Embed示例和画布示例构造6.1/layout |
| 旧页可读且后续只收到规范形式 | 旧report/dashboard进入草稿、沉淀和预览；完整dataSources/sections与原始initial保留，输入不变；双字段/未来版本拒绝。保留#129原始修订hash先核验边界，未改page-assets-client |
| 正式渲染/搭建画布/Embed公开行为 | 画布10浏览器测试，包括4种版本×布局、编辑后规范文档、筛选分页、选择与实例保留、空分区隔离；Embed41项浏览器回归，包括ESM/IIFE、旧新布局等价、未知版本、真实仓内IOC页面及导航/初始行/错误 |

## 命令

- `pnpm test`：127文件通过，944测试通过，5个既有跳过。
- `pnpm check`：成功，全部Svelte检查0错误0警告。新增测试对象的类型推断问题已修正后重跑成功。
- `pnpm build`：page/engine/metric-canvas、Embed ESM/IIFE及Platform静态构建成功。
- `pnpm exec playwright test`（packages/metric-canvas）：10通过，Chrome。
- `pnpm exec playwright test`（packages/embed）：41通过，Chrome。
- `node --import tsx tools/scripts/export-authoring-contracts.ts --check`：190 product / 4 authoring / 1 interface，无漂移；本提交不改生成物。
- `git diff --check`：通过。

两套浏览器验收使用真实本机构建和受控数据网关；不是#103异构内网消费者或#104真实部署验收。旧生产工作台完整界面接线后续由S1负责，不把画布harness冒充新创作生命周期端到端。

## 文件所有权

S1/S0明确临时交给S2：apps/platform/src/lib/workbench/document-edit.ts、promote.ts，以及对应document-edit.test.ts、promote.test.ts。只改规范化输入/输出与对应回归；保留空分区投影。S1另授权component-building.test.ts的一行新文档构造补layout:report；此前10类同义替换断言因规范化补默认字段失败，此修正使测试输入符合新写出形式，未改变共享组件fixture或组件构造器。

上述五文件随本票验收后归还S1。PageAuthoringWorkbench.svelte、page-assets-client.ts和协调模块未改。

S2其余文件：apps/playground/src/lib/{default-preview-page.json,page-repository.ts,preview-document.ts}、apps/playground/tests/preview-document.test.ts；packages/embed/examples/{inline,esm,query,ai-summary}.html；packages/embed/tests/browser/layout-compatibility.spec.ts；packages/metric-canvas/tests/browser/harness/{Harness.svelte,document.ts}及metric-canvas.spec.ts。完整清单以本提交diff为准。

## 分票边界与接续

#132生成支持独立提交`4f6be5f5a33e41385d4dabbb96e67b7a5d885062`，位于另一个工作树，不混入本票。它基于S3作者提交，只派生当前构造黄金向量及刷新锁；冻结legacy-contracts不改。S3负责成套Python验收。

存量pages/、文档支持区间、过渡Page类型别名和最终四交付物打包在#133收口；旧协议读取长期保留。#131/#132均验收进入共同基线后执行#133，不等M0。#143/#144未实施。无外部服务实现/确认、无远端push或registry发布。

回退本票可逆向提交；#129的6.1读取支持必须保留，已产生6.1文档不得退回仅支持6.0的读取方。原输入文档保持未修改。
