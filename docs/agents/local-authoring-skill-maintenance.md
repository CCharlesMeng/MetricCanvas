# 独立本地创作 Skill 的维护

维护 `metriccanvas-local-authoring` 时读取本页。分发实体是 `metriccanvas-authoring/skill/metriccanvas-local-authoring/`；仓内发现入口 `.agents/skills/metriccanvas-local-authoring` 指向该实体目录。安装复制完整实体，内部知识路径必须闭合。

所有新功能的场景、页面元数据文档和本 Skill 同步均按[新功能验收要求](feature-acceptance.md)执行，为同批必选完成项。

安装副本附有[维护说明](../../metriccanvas-authoring/skill/metriccanvas-local-authoring/references/maintenance.md)，只使用自身目录。下面的仓库路径与命令属于维护流程，不是 Skill 使用者的运行依赖。

## 修改入口

| 改动 | 真源 |
|---|---|
| 触发条件、流程、数据口径复核、布局及地图说明 | Skill 的 SKILL.md 和作者维护的 references/*.md |
| 尝试快照 | Skill 的 scripts/snapshot-attempt.mjs |
| 页面字段、约束、校验 | packages/page/src/ 及合法/非法夹具；涉及公共协议时按产品契约流程同步 |
| 协议语义正文、示例路由 | docs/page-metadata/ 与 tools/scripts/page-reference.ts |
| 成型页面范式 | `tools/scripts/local-authoring-patterns.ts` 选择 `pages/` 中页面并提炼结构；形态识别及分支范式卡由 Skill 作者维护 |
| 通用概览完整样例 | tools/scripts/local-authoring-overview-example.ts；使用当前写出版本并重新校验 |
| 目录封闭、参考净化与校验器打包 | tools/scripts/local-authoring-projection.ts、local-authoring-validator.ts |
| 实际地图地名 | 产品底图，经导出器投影；保留源摘要，移除仓库路径 |
| 注册与分发 | metriccanvas-authoring/bundle.json、scripts/check_bundle.py |
| 精确知识主题与结构 | `reference-map.json` 的 `authoringTopics`、`local-authoring-knowledge.ts` 与纯读取核心；语义从产品参考原文分块，不另写摘要 |
| 页面用数、MD 索引与报告/候选检查 | `local-authoring-data-analysis.ts`、`local-authoring-data-cli.ts`；组件字段位置沿产品 Schema 和组件树遍历发现 |
| 旧页面继续开发与确定性升级 | `packages/page/src/upgrade-document.ts`、`upgrade-chart-filters.ts` 与 `tools/scripts/local-authoring-upgrade.ts`；生成 `scripts/upgrade-page.mjs`，作者流程在 `references/page-upgrade.md` |

精确知识的生成树为 `references/authoring-knowledge/`；新增 `scripts/read-knowledge.mjs`、`scripts/analyze-data.mjs`，均接入清单、漂移检查和仓外测试。模型按任务读取 JSON 输出，不读取机器知识包或脚本全文。精确主题失效/过大时修复真源，不截断约束。语义章节保持单一原文，显式主题的标题选择器在更名时生成失败；全部章节自动成为可发现主题，新语义不静默丢弃。

对比统计分别报告脚本输出 UTF-8 字节、实际工具读取、请求 input/cached/output 与修复轮次；确定性路由字节对比不能冒充实际 Agent token/费用节省。没有相同模型/编码器的逐请求证据时，实际收益保留未验收。默认只运行 local-authoring 相关检查，不追加其他 Skill 或真实 DS 专项验收。

生成范围由导出器管理：references/page-metadata/、references/page-patterns/、references/map-regions.json、references/knowledge.json、assets/layouts/overview-map-led.json、scripts/validate-page.mjs、scripts/THIRD-PARTY-LICENSES.md。其他文件归作者维护，重新生成必须保留。真源映射总表见[真源与派生链](../../metriccanvas-authoring/SOURCES.md)。

## 验收范围

Skill 验证按 [仓库约定](../../AGENTS.md#skill-验收范围) 只验收 local-authoring。知识、示例、独立校验器与分发清单仍从产品真源生成；不把其他 Skill、历史 Bundle 行为测试或真实模型验收作为默认完成条件。产品契约和受影响代码的测试仍照常执行。

## 更新与交付

先确认实际产品版本；混合工作区中在独立检出承接本次改动，再从该检出的产品真源生成。不能把其他任务未提交的 Schema 或组件知识散入安装包。

```sh
pnpm install --frozen-lockfile
pnpm authoring:contracts
pnpm authoring:contracts:check
pnpm authoring:check
pnpm exec tsc --noEmit -p tests/tsconfig.json
```

Python 测试需要 Bundle 锁定依赖；使用已装依赖的环境执行，不能把缺依赖当成产品失败。独立安装运行校验只需 Node.js 22+，无需上述维护工具链。

检查生成差异、第三方许可证、注册入口及完整目录链接闭合。tests/local-authoring-skill.test.ts 会复制实体至临时位置，核对生成哈希、短片段/完整样例、快照与产品契约向量的一致性；导出隔离测试验证生成漂移与作者文件保留。显式暂存本次真源和对应派生物，保持其他任务的源文件与本地证据不变。

## 行为复测

实质工作流变化以独立输入复测。先总结原始页面特征；模型仅取得冻结 Skill、需求、设计与原始数据，不取得旧页面JSON、预期答案或之前生成结果。独立期望值必须从输入程序化计算，特别记录分组分子/分母、百分刻度、零分母和未知值。

保留模型版本、提示词、输入/知识哈希、原始尝试、校验回执与实际使用的作者说明版本。浏览器检查宽/窄屏、最终显示文字、地图地域命中、Tab、排序、筛选状态和导航值。静态成功、控制状态变化与真实数据变化分别判定；真实DS复验另按[模型验收流程](skill-ds-model-acceptance.md)执行。

项目概览的历史复测见[问题与改进](../evidence/local-authoring-ioc-overview/improvements.md)：布局和结构改善，完整业务/视觉验收仍失败；后续文档追加不能改写历史结论。记录所用知识版本与当前分发版本的差异，不能用过去模型测试替当前版本背书。

升级与回退均交付完整Skill目录，重新核对版本、哈希及用户页面。Skill内知识清单覆盖生成文件；作者文件随完整目录/仓库提交版本保存，Bundle锁覆盖所有分发文件。

## MC 同步完成条件

页面 Schema、验证器、迁移、组件目录、语义章节/规则/例子、发现/查询/参数或工具契约更新（包括不升 Schema 的语义修复），同批执行 `pnpm authoring:contracts` 与 `pnpm mc:content:check`。原有导出入口从同一产品输出图生成 MC 和 local-authoring；完整 MC 覆盖检查使用产品注册/reference-map/活动工具注册作为分母，不能只核对已有文件 hash。不要从安装副本回读事实。

CI authoring job 不按变更路径跳过此链路；MC 独立归档使用 `pnpm mc:content:pack --output <new-path>`，源树/内容/归档摘要和部署状态分开记录。每次发布补旧页可读/可迁移/人工处理矩阵及受影响产品引擎回放；真实 Relay/DQE/保存/预览由部署方另验。local-authoring 仍整目录仓外安装，不依赖 MC 兄弟目录。说明与验收入口见 `tools/mc-content/README.md`、`HANDOFF.md` 和 `docs/plan/2026-10-24-layout-standards/mc-content-completeness-plan.md`。
