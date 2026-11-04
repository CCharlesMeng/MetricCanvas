# 共享字段解析器公开面快照补登记

只读审计主控最终工作树 `/Users/moon/.codex/worktrees/relay-reference-final/DataDashboard`。`tests/public-api.test.ts` 通过 `tools/package-build/surface.ts::renderSnapshot` 对全部六个交付物按入口导出名做 AST 快照比对，类型导出也属于此公开面。全部结果见 `final-export-audit.json`。

仅 `@metriccanvas/page` 的 `./internal` 缺少以下三个明确新增的导出：

- `FieldResolutionSlots`：共享解析器所需的最小数据槽类型。
- `ResolvedField`：既有运行时字段解析结果类型移到通用 page 层，engine 继续复用/转导。
- `resolveField`：原 engine 的字段解析实现移到 page 层供运行时与无 DOM 创作检查共同使用。

来源为 `packages/page/src/internal.ts` 的 `export * from './field-resolution'`；定义全部位于同目录 `field-resolution.ts`。page 主入口 `.` 及其他五交付物完全一致；没有导出删除、未知名字、子路径变化。

只在 B 独立树的 `tests/public-api/page.txt` 内 `./internal` 排序段添加这三行。未运行批量 UPDATE_PUBLIC_API，不删改测试、不改 frozen 接口/实现。最终树的原失败 7/8 可复现；补丁后在 B 普通模式执行 `node node_modules/vitest/vitest.mjs run tests/public-api.test.ts`，8/8 通过。补后的内容与只读渲染出的最终树实际公开面逐字相同。

本目录 `source-manifest.json` 为单文件清单，包含主控输入 SHA 与新文件 SHA，供 guard 后精确导入。此前 25 源文件和后续 4 文件 runtime delta 的 SHA 均重新核对不变。主控最终树未写入。

这是文本快照登记，不新增或修改可执行函数、分支或协议字段，无复杂度测量项；普通测试本身未变。此结果仅证明公开面枚举与显式登记一致，最终集成全仓测试、构建、分发仍由主控运行。
