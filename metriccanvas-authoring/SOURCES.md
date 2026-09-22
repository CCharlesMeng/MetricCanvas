# 真源与派生链

| 内容 | 权威维护源 | 派生/消费位置 | 更新方式 |
|---|---|---|---|
| 页面协议、能力、校验与组件目录 | 根仓 `packages/page/src/` 与对应合法/非法夹具 | 根仓 `contracts/metriccanvas/`，本 Bundle `contract-snapshot/` | 根仓 `pnpm authoring:contracts` |
| 产品参考语义、示例索引 | 根仓 `docs/page-metadata/` 与 `tools/scripts/page-reference.ts` | 产品 `page/reference/`、Bundle 快照与 page-builder Skill 参考 | 同一导出器；不得手改生成物 |
| 创作输入与内部生命周期契约 | `contracts/authored/`，平台用例中的 Schema 定义 | `contracts/exported/`、产品 authoring 投影、MCP 参数 | 修改真源后运行导出器与实际注册 Schema 测试 |
| 正式 Skill 工作流 | `skill/*/SKILL.md` 与非生成的 workflows/references | 安装 Skill，兼容入口位于 `skill-compat/` | 手工改工作流；生成参考由导出器更新 |
| Bundle 版本、入口与分发规则 | `bundle.json` | `bundle.lock.json`、运行时 bundle-info、安装包 | 修改声明后导出；不手改 hash |
| 产品快照来源锁 | 根仓产品契约 manifest | `contract-lock.json` 与 `contract-snapshot/manifest.json` | 同一导出器生成 |
| 测试分类 | `test-harness/test-layers.json` | 全量及按层 runner | 必须覆盖每个测试文件且恰好一次 |

本 Bundle 的 `contract-snapshot/` 是安装时需要的离线副本，不是第二份可编辑协议。wheel/sdist 的 `_bundle` 和独立 Skill 参考也必须在没有根仓源码时可用。删除这些副本会破坏离线交付；压缩重复内容应在投影生成器完成。

反例参考仅含 `inputExcerpt`、聚合后的错误路径和 `fullInput` 来源。完整页面仍保留在 `page/conformance/invalid/`；验证对完整向量执行，参考片段不能当作可执行 Page。独立 Skill 的片段足以定位触发规则，完整向量需要产品契约或 Bundle 快照，不承诺 Skill 单独携带整页反例。

修改真源后的检查顺序：

```sh
pnpm authoring:contracts
pnpm authoring:contracts:check
python3 metriccanvas-authoring/scripts/check_bundle.py
pnpm exec vitest run tests/page-reference.test.ts tests/authoring-export-isolation.test.ts
pnpm authoring:test
```

前两条需在根仓运行；安装后的 Bundle 只消费快照，不反向修改产品协议。`bundle.lock.json` 不散发本地虚拟环境或 Python 缓存。历史归档的 hash 校验使用冻结来源，当前派生物变化不应改写历史证据。
