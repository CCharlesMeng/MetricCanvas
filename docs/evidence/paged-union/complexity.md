# 本次复杂度检查

口径：metriccanvas-ts-ast/1，TypeScript 5.9.3，按函数自身 selfCC；闭包、回调、对象方法逐项测量。基线 `3f502e482b4b56e35011f994b1f735b0abab5909`。Svelte 仅提取 script 测量，本次模板只替换已有通知计算调用，未新增模板分支。

本次测量 238 个修改或新增函数；全部新增函数最高 CC 13。完整清单见 [complexity.json](complexity.json)。

| 函数 | 修改前 | 修改后 |
|---|---:|---:|
| `packages/data-execution/src/execute.ts` / `createPageDataExecutor/execute` | 15 | 12 |
| `packages/data-execution/src/source-program/column-candidates.ts` / `createColumnCandidatesReader/<anonymous>` | 48 | 44 |
| `packages/data-execution/src/source-program/session.ts` / `createSourceProgram/read/execute` | 15 | 13 |
| `packages/page/src/migrate-param-bindings.ts` / `migrateParamBindings` | 41 | 40 |
| `packages/page/src/navigate.ts` / `navigationErrors/<anonymous>` | 31 | 31 |
| `packages/page/src/page.ts` / `deriveComponentCapabilities` | 25 | 24 |

存量未关闭项：候选读取 48→44、参数迁移 41→40、组件能力推导 25→24；导航校验回调 31→31。本批新增逻辑已提取，保留通用导航绑定校验的旧控制流，避免在字段映射功能中扩大所有导航场景的重构风险；后续仍需单列拆分。未修改的其他存量超限函数不属于本批。

行为验证覆盖产品协议、排序筛选计数分页、检查点、总数变化重试、取消、独立消费者、导出与来源导航，命令与结果见 [acceptance.md](acceptance.md)。

CI 后续修复沿同一基线重测：合并行投影复制字段原文证据，归并结果复用 rawSnapshot 序列化，initial 保留相同证据；新增回归先验证旧实现丢失证据，再通过当前页、完整导出和采集 initial。补测包含根目录 Skill 测试回调。未放宽任何超时预算，五次 CLI 调用拆为五个独立场景。
