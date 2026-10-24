# 图表 ECharts 隐含透传验收

日期：2026-10-19。结论：**P0–P6 本地实施与验收完成**。首批 barChart、lineChart、pieChart 通过 `props.echartsOption` 声明受保护的呈现补丁，支持单次回退、console-only 诊断和导出降级终止。以下首次本地验收完成时尚未提交或推送；用户随后授权交付 main，交付阶段另记基线与复验。真实 DQE/Relay/DS 模型及部署未运行。

决策：[ADR-0110](../../adr/0110-hidden-echarts-presentation-options.md)。执行：[主计划](../../plan/2026-10-19-chart-echarts-option.md)。完整页面：[chart-echarts-option-page](../../../pages/chart-echarts-option-page.json)。页面为内联演示数据，无真实查询验收含义。

## 输入与环境

- 隔离检出：`/Users/moon/.codex/worktrees/chart-echarts-option/DataDashboard`，基线提交 `8ff56a268a659dc026ec76b90d6bcc4353c48d5d`。
- 完整兼容验收源码树：`80a0fe4cbe2d32055639b3d5162ca753a597ef3d`。通过临时 Git index 和显式路径清单生成树对象，未提交或修改真实 index；`sourceCommit` 字段是基线，源码输入以 `sourceTree` 为准。
- Schema 6.32、ECharts 6.1.0、Svelte 5.56.6；Node 24.11.1、pnpm 11.13.0、Python 3.14.7。
- `pnpm-lock.yaml` SHA256：`63f17f9b6cf5abb75bdcb9217e01bdba3d12ef2578403e256beb4316376d72a0`。
- Python 锁 SHA256：`4a9b20cb50b80477bffdd1c830fb29325e7c7e9f8379074168c4da561da79c26`。锁定依赖安装于临时 venv，系统 Python 未修改。
- Chrome `155.0.8059.82`、真实 Microsoft Edge `155.0.4283.62`。本机缺 Edge，最初矩阵在启动前失败；最终完整运行使用官方 PKG 经 SHA256 核对后解包的临时 Edge，未运行安装脚本或修改系统应用。见[下载元数据](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/chart-echarts-option/artifacts/edge-artifact.json)。

## 实际检查

| 层次 | 执行与结果 |
|---|---|
| 页面 | `pnpm validate pages`：29/29 通过 |
| TypeScript | 冻结树完整 `pnpm test`：2243 通过、5 跳过；256 个测试文件通过，含完整契约、Skill 仓外闭合、导出隔离与已有图表回归 |
| 类型与构建 | 冻结树 `pnpm check`、`pnpm build`、六包 pack 通过；安装后的 page-only Node ESM、UI-only 与合并消费者类型/构建通过 |
| Python 创作 | 锁定依赖下 `pnpm authoring:test`：541 项，540 通过、1 跳过；含普通编辑保留、同类型不变、跨类型清除。脚本模型调用为 0，不作为真实 DS 证据 |
| 协议分发 | `pnpm authoring:contracts:check` 通过；Bundle 0.3.1 的 2767 项摘要检查通过。Schema、参考、契约向量、Skill 知识、独立校验器与清单由产品真源生成 |
| 安装消费 | `node tools/package-build/compatibility.mjs --source-tree=80a0fe4cbe2d32055639b3d5162ca753a597ef3d`，使用临时 Edge 路径：完整矩阵通过，298 项成功，0 unexpected、0 skipped |
| 功能浏览器 | 新增9个场景在安装后的 Chrome/Edge 各执行一次，共18项通过；直接消费完整页面，故障仅由测试注入 |
| 文档与差异 | `pnpm adr:index:check`、新文档链接检查、`git diff --check` 通过 |

本地设置 `CI=1` 的兼容进程仍是本地验收，不是 GitHub CI。完整步骤、真实浏览器版本和耗时见[兼容摘要](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/chart-echarts-option/artifacts/compatibility-summary.json)。

## 功能与交付物对应

| 功能 | 页面、产品文档与分发 |
|---|---|
| 三类图表的隐含呈现补丁 | [完整页面](../../../pages/chart-echarts-option-page.json)、[高级协议说明](../../page-metadata/chart-option.md)、[Schema](../../../packages/page/src/schema/components/charts.ts) |
| 默认不使用、已有配置保留 | [本地创作 Skill](../../../metriccanvas-authoring/skill/metriccanvas-local-authoring/SKILL.md)、[页面构建 Skill](../../../metriccanvas-authoring/skill/metriccanvas-page-builder/SKILL.md)、[平台创作 Skill](../../../metriccanvas-authoring/skill/metriccanvas-platform-authoring/SKILL.md) |
| 独立校验与安装闭合 | 由产品真源导出的协议知识、正反例、校验器与哈希清单；完整 TS 套件内的仓外安装检查及[Bundle 摘要检查](../../../metriccanvas-authoring/scripts/check_bundle.py) |

## 关键行为

- 声明序系列补丁与 stackOrder 绘制序映射；对象递归合并、普通数组替换、空补丁保留；字段和数据均不被修改。
- JSON/版本/受保护路径/越界拒绝并给出 Pointer；param/filter/parts 碰撞保持不透明。tooltip 原始 HTML、CSS 声明片段、资源和回调入口有拒绝见证。
- 构造、合并异常通过纯接口注入验证；布局测量、真实 canvas 绘制失败由浏览器注入。扩展失败销毁实例回退一次；基础失败空图、保留标题；resize 不重启扩展，有效输入更新可再尝试。
- console 记录阶段、组件、路径和原始异常；页面无本能力的错误文案/alert/toast/tooltip。校验器/invalid 事件保留结构化详情。
- 静态 PDF/PNG 降级立即终止，无下载、busy 恢复、导出文档释放；正常 PDF/PNG 实际下载并检查文件签名。
- 普通编辑、保存重开保留；跨类型清除并 console 记录；既有同步撤销精确恢复。属性面板仍无高级入口，三个创作 Skill 保留默认不主动使用的策略。
- 饼图缺失行、真实零和重复类别保留正确的原行身份，完整类别色域保留。

截图：[chart-options-chrome-1440](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/chart-echarts-option/artifacts/chart-options-chrome-1440.png)、[chart-options-chrome-390](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/chart-echarts-option/artifacts/chart-options-chrome-390.png)、[chart-options-msedge-1440](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/chart-echarts-option/artifacts/chart-options-msedge-1440.png)、[chart-options-msedge-390](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/chart-echarts-option/artifacts/chart-options-msedge-390.png)

## 证据与范围

[完整 TS 测试](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/chart-echarts-option/artifacts/source-test.txt)、[类型检查](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/chart-echarts-option/artifacts/source-check.txt)、[构建](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/chart-echarts-option/artifacts/source-build.txt)、[安装消费者浏览器](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/chart-echarts-option/artifacts/consumer-browser.txt)、[Python 摘要](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/chart-echarts-option/artifacts/python-summary.txt)。

ECharts 静默忽略的未知属性不承诺提前识别。地图与其他组件不新增透传入口。真实服务、真实模型默认选择行为、远端 CI、发布和部署均未由本次本地成功推断；后续如需要，单列验收。

留存的文本日志仅去除行尾空白和文件尾多余空行，便于 Git 差异检查；内容与检查结果保持。

## main 交付前复验（2026-10-19）

用户随后明确授权提交并推送 main。接入远端基线 `952b3a273f0f4f8be5820f5af1bb76c2f5afa513`，保留画布交互与本地创作流程两批提交的意图；目录同时保留两个新场景，公共协议、Skill 与哈希由合并后的产品真源重新生成。原混合工作区未改动。

复验输入树 `35da237dacc94ec2e793573b3149828b6469e39a`；复验后仅补充此交付记录和文本日志，不更改产品输入。

- 完整 `pnpm test`：257 个文件通过，2255 项成功、5 项跳过，见[日志](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/chart-echarts-option/artifacts/main-test.txt)。
- `pnpm check`、`pnpm build` 通过，见[类型检查](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/chart-echarts-option/artifacts/main-check.txt)、[构建](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/chart-echarts-option/artifacts/main-build.txt)。
- 完整 `pnpm authoring:test`：540 项成功、1 项跳过，无真实模型调用，见[摘要](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/chart-echarts-option/artifacts/main-python.txt)。
- `pnpm validate pages`：30/30；契约检查、ADR 索引和差异检查通过；Bundle 摘要检查 2776 项通过。

首轮本地安装后的 Chrome/Edge 298 项结果仍对应上文冻结树；不把它当作接入新基线后的浏览器证据。交付提交的完整安装消费与聚合检查由其 GitHub CI 提供，以实际提交 SHA 和完成结论为准。
