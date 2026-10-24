# 页面试验场信息结构验收

日期：2026-10-19。检出目录与输入哈希见 [inputs.json](inputs.json)，开工基线为 `952b3a273f0f4f8be5820f5af1bb76c2f5afa513`。本轮在共享工作区增量修改，保留开工前已存在的指标卡混排、详情弹窗与三层表头页面增量；未执行 Git 提交或 push。

## 范围与可观察结果

- 32 个实际页面均有能力展示名、操作结果摘要、数据性质、运行条件、可体验范围与使用说明。六个能力主题允许跨用途归属，与布局形态、用途、关键词、运行条件组合筛选；保留原文档标题搜索，不重复目录卡片。
- 每页“体验与配置说明”提供步骤、预期、边界、实际 JSON 片段、完整 JSON 下载、关联页面和仓库协议文档链接。说明位于 RuntimeView 外部，不进入页面声明及报告导出。关联示例覆盖来源／目标、主示例／变体／业务应用。
- 校正 IOC 概览与清单的 `query` + 合成内嵌初始行描述、清晰度回退说明；移除不存在的自定义组件目录记录；合并重复 PDF 文档，时间选择恢复独立章节。Platform 搭建场景明确区分内容预览与工作台操作。
- 页面协议、查询定义、组件树和创作流程未变。`PAGE-METADATA.md` 补能力导航；字段语义仍引用既有模块。目录信息不进入 Skill 运行依赖；IOC 源文件描述改变导致范式来源 SHA 改变，已从真源重新生成两份范式摘要及 knowledge／bundle 锁，结构内容保持不变。

## 验证

| 层次 | 命令／入口 | 结果 |
|---|---|---|
| 目录及开发工具测试 | `pnpm test apps/playground/tests` | 12 文件、54 测试通过 |
| 页面校验 | `pnpm validate pages`、`pnpm validate pages/sdt` | 根目录 31 个、子目录 1 个，共 32 个通过；校验器不递归，故分开运行 |
| 类型检查 | `pnpm --filter playground check` | 0 errors／0 warnings |
| 静态构建 | `pnpm build:playground` | 成功 |
| 真实浏览器 | `node apps/playground/tests/page-catalog-browser.mjs` | Chromium；1440×1000 与 390×844；32 页、71 个配置选择器，组合筛选／空结果重置／旧标题搜索／跨页关联／完整 JSON 下载通过，pageerror 为 0 |
| 分发漂移检查 | `pnpm authoring:contracts:check` | 751 product、4 authoring、1 interface 文件 current |
| Bundle 完整性 | `python3 metriccanvas-authoring/scripts/check_bundle.py` | bundle 0.3.1，2718 digest checks 通过 |
| 仓外安装与导出隔离 | `pnpm test tests/local-authoring-skill.test.ts tests/page-reference.test.ts tests/authoring-export-isolation.test.ts` | 3 文件、46 测试通过，包含 Skill 整目录复制安装、链接与哈希闭合及隔离导出检查 |

浏览器启动入口为 `http://127.0.0.1:5173/`；复用已有试验场和本地 DQE Sim。先在首页选择筛选主题、Dashboard、Sim 和关键词，确认跨用途的图表独立筛选能被找到；构造无匹配条件后重置；逐页展开说明和配置；从详情弹窗页下载 JSON、核对详情声明并跳转关联演示；最后在窄屏检查目录和展开配置无页面级横向溢出。浏览器机器结果见 [result.json](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/page-catalog-information-structure/result.json)。所有被展示的关键配置都由当前加载的页面提取，完整性测试同时检查关联页面与协议文件存在。

本轮验证的是开发工具的信息可发现性、说明与实际配置的一致性。逐页打开不代表逐项重新验收所有引擎交互；真实 DQE／Relay、业务口径、身份权限、真实模型、Platform 搭建及生产部署均不属于本轮结论。浏览器测试不要求业务查询成功，允许它们按既有规则报告诊断。协议链接指向仓库 main，当前运行文档以下载 JSON 为准。

## 截图

[历史截图：能力主题与组合筛选](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/page-catalog-information-structure/catalog-desktop.png)

[历史截图：页面体验与配置说明](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/page-catalog-information-structure/guide-desktop.png)

## 快速范围交付复核

交付检出：`/Users/moon/.codex/worktrees/page-catalog-delivery/DataDashboard`，基线 `9c39d6455776cfbd0084d78394fe4edeb55dc3f7`。保留远端并行新增的图表高级配置与两个 Tab URL 页面入口，为三页补齐同结构说明；最终目录 35 页。原工作区保持不变，ADR、计划及其他并行改动未带入。

在交付检出重新执行：`pnpm test apps/playground/tests`（12 文件／54 测试）、`pnpm --filter playground check`（0 errors／0 warnings）、`pnpm authoring:contracts:check`（784 product／4 authoring／1 interface）、`python3 metriccanvas-authoring/scripts/check_bundle.py`（2818 digest checks）、`pnpm validate pages` 与 `pnpm validate pages/sdt`（34 + 1 页面），均通过。浏览器使用本检出独立 5191 端口，`PLAYGROUND_BASE_URL=http://127.0.0.1:5191 node apps/playground/tests/page-catalog-browser.mjs /tmp/metriccanvas-page-catalog-delivery` 覆盖 35 页、75 个配置选择器、宽窄屏、组合筛选、关联及下载，通过且 pageerror 为 0，见 [delivery-result.json](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/page-catalog-information-structure/delivery-result.json)。

按用户快速交付要求，不重跑全仓测试／构建与耗时独立安装套件；初轮结果保留为其原检出的证据，不宣称新基线已跑这些项目。提交使用 `[skip ci]`，不将跳过 CI 表述为绿色 CI。交付输入见 [delivery-inputs.json](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/page-catalog-information-structure/delivery-inputs.json)。
