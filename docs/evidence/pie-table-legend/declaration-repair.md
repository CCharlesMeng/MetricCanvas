# 发布声明修复（2026-10-26）

首次 main 提交 `934d397e7f44948110c6017aa461044b9c0975da` 的 CI `40324980347` 在 compatibility 消费者类型检查及 build 的取数包独立安装检查失败。两者均报告发布包缺失 `schema/component.d.ts` / `schema/page.d.ts`，不是图例的运行态或页面协议验证失败。

本地重建 Page 包复现：svelte-package 返回成功，却缺少上述两份声明。收缩到直接 TypeScript 声明编译后，明确得到 `componentSchemas`、`componentZ`、`sectionZ` 的 TS7056（推导类型超过序列化上限）。单独给 componentSchemas 注解不足；给组件联合与分区 Schema 都保留精确类型引用后，直接声明编译和实际 Page 包构建全部通过，两份声明实际存在。

修复仅增加类型注解：组件列表使用每个现有 Schema 的 typeof 元组；componentZ 使用该精确元组的 ZodDiscriminatedUnion；sectionZ 使用精确 SectionShape。没有改成 any/unknown，没有修改运行时 Schema 结构、页面协议版本或字段类型。产品及 Skill/MC 派生信息由真源重新生成。

已有 CI 的仓外安装消费者是本问题的真实回归检查入口。修复后本地执行 `node tools/package-build/data-execution-consumer.mjs`，重新 pack 并独立 npm 安装 Page 与取数包：Node ESM 执行、严格外部 TypeScript、已安装 CLI 全部通过，且没有引入 Svelte/ECharts/引擎/UI 依赖。另直接执行 `tsc --declaration --emitDeclarationOnly --noEmit false -p packages/page/tsconfig.json` 已通过。

复杂度仍为 metriccanvas-ts-ast/1 / TypeScript 5.9.3；本次两个文件仅修改类型声明，无新增/修改可执行函数，前后函数清单均为空，没有未关闭复杂度项。原图例的行为与复杂度证据见 main-delivery.md。

余下回归及修复提交的最终 exact-SHA CI 结果以交付答复为准，不将首次失败 CI 记为通过。

补充复验完成：Page、公开 API、local-authoring 和参考知识回归 92 文件 / 997 测试通过；引擎类型检查 0 errors / 0 warnings；契约导出一致性、MC 来源覆盖、30 项 Python 测试和诊断夹具检查均通过。类型注解前后的实际 JSON Schema 结构保持不变，差异为源摘要及相应生成信息。
