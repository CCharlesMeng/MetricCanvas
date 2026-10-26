# 当前版本升级示例同步（2026-10-26）

`29aeaceb4326792b9d0da7b56292c732de91da0f` 的 authoring CI 中，187 项通过，唯一失败为 `tests/local-authoring-upgrade.test.ts` 的 Playground 同源示例比对：正式协议已为 6.64，示例仍为 6.63。不是升级器或业务数据变化。

本地对同一用例重现失败后，使用已分发的 `upgrade-page.mjs` 从冻结旧输入 `tools/fixtures/local-authoring-upgrade/schema-upgrade-demo.json` 升级到新的 `/tmp/pie-schema-upgrade-6.64`，保留原件，随后仅按示例原约定修改页面标题和 GMV 卡片标题，再生成正式 Playground 文件。最终差异只有 schemaVersion 从 6.63 到 6.64；没有直接篡改原始旧夹具。全部 98 项旧页升级回归通过。

本次只同步页面 JSON 与派生记录，没有新增或修改可执行函数，复杂度无需新增函数测量。产品知识、local-authoring 与 MC 摘要从当前产品真源重生成。

全量 tests CI 的另一项失败是页面 ID 中立性扫描：新增能力 key 与示例 ID 同为 pie-table-legend。能力 key 改为 pie-legend-table，示例 URL、能力下限 6.64 与检测语义保持原约定；同步 version 测试及自动生成的能力知识。该命名修正没有引入基于页面 ID 的运行时分支，也没有放宽中立性测试。中立性、旧页升级、版本边界合计 103 项通过。版本能力检测回调的分支未改，使用同版 AST 测量器复测前后复杂度相同。

补充广泛回归：`pnpm test --exclude tests/authoring-export-isolation.test.ts`，351 文件通过、3111 测试通过、4 项按现有规则跳过（共 3115），耗时 60.53 秒。单独排除耗时的冷导出隔离文件；该文件在上一轮 exact-SHA authoring CI 中已经通过，下一修复提交仍由 CI 全量执行。并未把本地结果标为全仓无排除检查。

改名涉及的 usedAt 及两个嵌套回调，自身 CC 分别为 1→1、2→2、1→1，口径为 metriccanvas-ts-ast/1 / TypeScript 5.9.3，无新增分支或待关闭项。之前版本的完整 CI 已证明 compatibility、build、types 三组成功；authoring 和 tests 的失败原因在本页分别修复，其结论不作为新提交成功依据。

当前修正的 `mc:content:check` 完整通过：导出一致性、独立来源分母覆盖、30 项 Python 测试及当前诊断夹具。派生物由统一导出器生成，没有手工修补分发脚本。
