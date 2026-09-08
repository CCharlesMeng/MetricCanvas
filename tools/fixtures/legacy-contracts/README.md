# 历史迁移对照（ADR-0074 / #124）

本目录来自 `legacy/pre-static-platform-2026-09-08` 的完整仓库基线；每个文件的原路径、提交和 SHA-256 记录于 `provenance.json`。这些是固定迁移预期，不是当前算法输出。

当前契约导出只复制并核对这些摘要，不运行旧 Node/MCP/问数编排，也不从 Python 输出刷新预期。产品 Schema、组件目录、错误码与页面合法性向量继续由当前 TypeScript/Zod 导出；分析意图由 Bundle 的 `contracts/authored/analysis-intents.json` 定义。需求变化必须显式审查并更新适用的当前用例，历史行为的复查使用完整 tag。

`rest-services-page-assets.yaml` 只保留退场中的旧客户端协议对照。它不代表 #105 提供方的新接口已确认或接通。Java 工程不再是当前导出的依赖或接收方；新接口资料仍由 #105 对账。

浏览器和 Python 的十类局部组件构造共同规则见 `metriccanvas-authoring/test-harness/fixtures/component-building.json`；用例显式给出期望，两侧实现都无权自动改写。
