# Playground 顶部空间收紧

截图、日志与机器报告仅保留本机；最新基线复验见[交付记录](delivery.md)。

2026-10-24，按用户截图反馈调整目录页的顶部密度。

- 页标题改为单行，去掉品牌眉题和重复引导语；缩小页边距、工具栏与选择器间距，主题名称与说明在宽屏同行展示。
- 场景问题、关联目录、专题链接和运行提示集中到默认折叠的原生 `details`「场景说明」。交互演示／试改与独立打开入口保持可见，沿用现有 UI 组件。
- 未修改页面 Schema、数据查询或场景适配器。

## 实测与检查

在同一 1600 CSS 像素宽度访问 `/catalog/data/sources?scene=ioc-header`，演示 iframe 顶端从 529.921875px 变为 253.0078125px，上移 276.9140625px。记录为页面文档中的 CSS 位置，未用截图物理像素直接相减。

默认说明关闭；展开后问题、两个关联目录、两个专题链接和运行提示均可见。勾选演示中的「仅看重点国代」，展开再收起说明，勾选仍保留。点击「在此基础上试改」可显示当前场景 JSON 编辑器，再返回交互演示正常。

390 CSS 像素宽度下，折叠和展开时页面 `scrollWidth` 均为 390，未出现横向溢出。测试完成恢复默认视口。

- 修改前截图（本地附件，不随仓交付：`compact-header-before.png`）、修改后截图（本地附件，不随仓交付：`compact-header-desktop.png`）、窄屏截图（本地附件，不随仓交付：`compact-header-mobile.png`）。
- `pnpm --filter playground check`：0 errors、0 warnings，日志（本地附件，不随仓交付：`.scratch/evidence-runtime-attachments-20261028/playground-information-architecture/compact-header-check.log`）。
- `pnpm build:playground`：静态构建成功，日志（本地附件，不随仓交付：`.scratch/evidence-runtime-attachments-20261028/playground-information-architecture/compact-header-build.log`）。

采用 `metriccanvas-ts-ast/1` 分别提取两份 Svelte script 测量，覆盖全部 15 个函数与闭包，前后自身 CC 序列完全一致。目录脚本最高 2 → 2；工作台脚本最高 7 → 7，具体 `trackPage` 6 → 6、`trackMessage` 7 → 7，其余函数 1–2 不变。没有新增可执行函数或修改查询／导航分支；模板只移动已有说明到原生折叠元素，不新增条件或循环。模板由 Svelte 检查、构建与实际浏览器交互覆盖，不作为 TypeScript AST 测量对象。测量范围无未关闭超限项：前（本地附件，不随仓交付：`compact-header-complexity-before.json`）、后（本地附件，不随仓交付：`compact-header-complexity-after.json`）。

本次为本地 UI 调整，未提交、推送或执行远端 CI。
