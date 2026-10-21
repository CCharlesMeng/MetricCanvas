# 真源与派生链

| 内容 | 权威维护源 | 派生/消费位置 | 更新方式 |
|---|---|---|---|
| Java 数据集语义元数据接口 | 根仓 `service/dataset-detail-java.yaml`，由提供方 YAML 原文落盘 | 产品和 Bundle `data-context/rest-services-dataset-detail.yaml` | 原文更新后运行契约导出；不替换独立的页面管理服务 YAML |
| 页面协议、能力、校验与组件目录 | 根仓 `packages/page/src/` 与对应合法/非法夹具 | 根仓 `contracts/metriccanvas/`，本 Bundle `contract-snapshot/` | 根仓 `pnpm authoring:contracts` |
| 产品参考语义、示例索引 | 根仓 `docs/page-metadata/` 与 `tools/scripts/page-reference.ts` | 产品 `page/reference/`、Bundle 快照与 page-builder Skill 参考 | 同一导出器；Skill 的合法示例统一规范化到当前写出版本并重新校验，产品兼容向量保持原版本；不得手改生成物 |
| 创作输入与内部生命周期契约 | `contracts/authored/`，平台用例中的 Schema 定义 | `contracts/exported/`、产品 authoring 投影、MCP 参数 | 修改真源后运行导出器与实际注册 Schema 测试 |
| 正式 Skill 工作流 | `skill/*/SKILL.md` 与非生成的 workflows/references | 安装现行 Skill | 手工改工作流；生成参考由导出器更新 |
| 独立本地创作 Skill | `skill/metriccanvas-local-authoring/SKILL.md`、作者维护的 `references/*.md`、`scripts/snapshot-attempt.mjs` | 整目录独立安装；`.agents/skills/metriccanvas-local-authoring` 为本仓发现入口 | 只在上述作者文件维护流程；安装后的知识链接必须在目录内闭合 |
| 本地创作知识与校验器 | 产品页面参考；`tools/scripts/local-authoring-projection.ts`、`local-authoring-validator.ts`，后者复用产品 `parsePage` 与文件名校验 | 本地 Skill 的 `references/page-metadata/`、`references/knowledge.json`、`scripts/validate-page.mjs` 与第三方许可证 | 同一导出命令生成；剔除在线工具路由与仓外溯源路径，不改变字段语义；知识清单锁定作者版本、产品契约版本和各生成文件哈希 |
| 成型页面范式 | `tools/scripts/local-authoring-patterns.ts` 与其选定的 `pages/` 页面 | 本地 Skill `references/page-patterns/*.json` | 只投影布局、嵌套组件树与来源哈希；纳入知识清单；阅读目的与误判提示由作者范式卡维护 |
| 精确创作知识 | 产品 Schema/参考语义、reference-map 的 authoringTopics、local-authoring-knowledge 与 knowledge-core | 本地 Skill references/authoring-knowledge/、scripts/read-knowledge.mjs | 同一导出器生成；语义保留原文，结构局部读取并标出未展开引用；不手写第二份规则 |
| 用数扫描和数据分析 | local-authoring-data-analysis.ts、local-authoring-data-cli.ts、产品组件树遍历/校验 | 本地 Skill scripts/analyze-data.mjs | 打包为独立脚本，清单锁定；用户 MD/报告只在用户工作目录，不进入分发 |
| 概览布局样例与地图地名 | `tools/scripts/local-authoring-overview-example.ts`；产品 `page/map-regions.json` | 本地 Skill `assets/layouts/overview-map-led.json`、`references/map-regions.json` | 导出时验证布局样例，地名保留底图哈希而移除仓库路径；均纳入知识清单 |
| Bundle 版本、入口与分发规则 | `bundle.json` | `bundle.lock.json`、运行时 bundle-info、安装包 | 修改声明后导出；不手改 hash |
| 产品快照来源锁 | 根仓产品契约 manifest | `contract-lock.json` 与 `contract-snapshot/manifest.json` | 同一导出器生成 |
| 测试分类 | `test-harness/test-layers.json` | 全量及按层 runner | 必须覆盖每个测试文件且恰好一次 |

本 Bundle 的 `contract-snapshot/` 是安装时需要的离线副本，不是第二份可编辑协议。wheel/sdist 的 `_bundle` 和独立 Skill 参考也必须在没有根仓源码时可用。删除这些副本会破坏离线交付；压缩重复内容应在投影生成器完成。

本地创作入口通过 `bundle.json` 的 `local-page-metadata` 投影分发。维护时更新产品真源并运行下面的导出与检查；不要手改安装副本。仓库源码溯源留在产品参考，本地副本仅保留来源摘要。校验脚本由锁定版本的 esbuild 打包为只依赖 Node.js 22+ 内建模块的单文件，运行不需要 npm、Python、Relay 或仓库源码。静态校验、运行时预览与真实取数分别验收；独立安装不内含渲染引擎、DQE 或线上资产服务。更新和回退都使用完整 Skill 目录，避免知识和校验器混版。

`.agents/skills/metriccanvas-local-authoring` 只是仓内整目录发现别名，不是分发载体；单独安装复制 `skill/metriccanvas-local-authoring/` 的完整实体目录。该目录内没有指向仓外知识的软链接。

反例参考仅含 `inputExcerpt`、聚合后的错误路径和 `fullInput` 来源。完整页面仍保留在 `page/conformance/invalid/`；验证对完整向量执行，参考片段不能当作可执行 Page。独立 Skill 的片段足以定位触发规则，完整向量需要产品契约或 Bundle 快照，不承诺 Skill 单独携带整页反例。

本地 Skill 的完整维护流程见[仓库维护入口](../docs/agents/local-authoring-skill-maintenance.md)；安装副本附有[目录内维护说明](skill/metriccanvas-local-authoring/references/maintenance.md)。

修改真源后的检查顺序：

```sh
pnpm authoring:contracts
pnpm authoring:contracts:check
python3 metriccanvas-authoring/scripts/check_bundle.py
pnpm exec vitest run tests/local-authoring-skill.test.ts tests/page-reference.test.ts tests/authoring-export-isolation.test.ts
pnpm authoring:test
```

前两条需在根仓运行；安装后的 Bundle 只消费快照，不反向修改产品协议。`ownership.json` 声明内部自有 adapters 树；`bundle.lock.json` 排除它，并且不散发本地虚拟环境或 Python 缓存。公共参考模板位于 examples/adapter_template，内部复制后独立维护；只修改内部适配无需运行产品导出。历史归档的 hash 校验使用冻结来源，当前派生物变化不应改写历史证据。

条件协议、纯求值及稳定目标修改的真源是packages/page/src/condition.ts、presentation-policy.ts、presentation-edit.ts和presentation-operation.ts；Node Bridge分发同一实现，Python只负责传输。两个page-visibility演示页面由导出器直接投影到契约见证，浏览器消费原页面。
