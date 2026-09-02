# MetricCanvas Product Contracts

这里存放跨运行时共享的产品契约导出物。`metriccanvas/` 由
`pnpm authoring:contracts` 从当前 TypeScript/Zod 作者真源单向生成，禁止手工修改。

Authoring Bundle 不拥有这些契约；它在 `metriccanvas-authoring/contract-snapshot/`
携带一份完全相同的只读快照，并由 `contract-lock.json` 锁定 manifest 摘要，以便
Bundle 被独立复制后仍可离线运行和验收。
