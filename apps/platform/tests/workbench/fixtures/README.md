# 工作台文档夹具

从 `07536fd7cccfdc9571496732db4e9d57b0eb6e60` 的工作台测试输入，使用该版本旧装配器一次性生成。`document-edit.json` 来自 `document-edit.test.ts` 的 `assembled()`，`promote.json` 来自 `promote-flow.test.ts` 的 `transientDocument()`。生成日期：2026-09-08。

当前测试只消费固定页面文档，验证人工编辑与沉淀的存活规则；不调用旧问数算法生成预期。历史实现可在 `legacy/pre-static-platform-2026-09-08` 按需复查。

`promote-cases.json` 来自同一提交 `packages/server/mcp/tests/promote.test.ts` 的八组装配输入；对应存活的沉淀规则回归已迁到工作台测试并改为验证工作台实现。
