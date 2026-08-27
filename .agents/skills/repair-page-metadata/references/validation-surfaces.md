# 页面元数据校验面

## 使用方法

先找到失败所在的最低层，再向上补足直到用户意图的证据。下层通过不能推导上层正确。

## 覆盖矩阵

| 层 | 当前入口 | 能稳定发现 | 不能单独判定 |
|---|---|---|---|
| JSON 语法 | `inspect-page-metadata.ts` | JSON 解析失败 | 页面语义 |
| 单页文档 | `parsePage` / `validate_page` | 版本、必填项、未定义属性、枚举、id 格式与重复、行契约、`queryField` 覆盖与角色、筛选绑定、数据槽和字段引用、组件能力、action、查询分页、静态/动态约束 | 文件名、目标页存在性、数据上下文合法性、DQE 真实可执行性、业务口径、页面是否好用 |
| 页面目录 | `pnpm validate` 或诊断脚本的目录模式 | 文件名与 `Page.id`、导航目标、目标筛选器存在性和类型 | 页面仓储之外的目标、真实权限、查询结果 |
| Schema 元数据结构 | `parseDataContextSnapshot` + `data-context-contract.test.ts` | 快照形状、闭集枚举、必填项、额外字段、与 JSON Schema 的结构等价 | id 作用域唯一、relationship 引用完整性、敏感信息文本检测、指标口径真实性 |
| 取数单元清单 | `validateUnitManifest` / `execute_data_request_unit` | 指标、维度、维度取值和时间粒度是否来自数据上下文；临时指标是否留痕 | 用户是否选了正确指标，formula 计算是否符合业务口径 |
| DQE 执行与结果 | 取数单元真实执行、数据网关和结果归一化 | 协议、执行、查询字段映射、结果字段契约和行形状 | 结果是否完整回答了用户问题，数据源本身是否正确 |
| 统一运行时 | 精确页面修订预览和相关 runtime 测试 | 查询编排、ready / empty / error、筛选、分页、action 传播 | 视觉层级和业务可读性 |
| 呈现与业务验收 | 浏览器场景 + 需求/黄金问题 | 布局、截断、格式、交互可用性和问题到答案的对齐 | 无法以通用静态算法证明全部业务正确性 |

## 错误路由

| 错误或现象 | 首先查看 | 常见上游根因 |
|---|---|---|
| `SCHEMA_ERROR` 且路径为 `/schemaVersion` | `packages/page/src/version.ts` | 模型沿用旧版示例或局部迁移 |
| `SCHEMA_ERROR` 且消息为“未定义字段” | 该对象的 Zod 定义 | 拼写、旧协议字段或将创作上下文写入页面 |
| 一个数据源下多个字段/组件引用同时报错 | 数据源 `fields`、数据槽和三个字段空间 | 混用 DQE 输出名与稳定页面字段 id |
| `QUERY_MAPPING_ERROR` | `output_dims` / `output_metrics` ↔ `queryField` | 查询输出改变后契约未重建，alias 未对齐 |
| `FILTER_BINDING_ERROR` | 顶层 `filters` 和当前查询 `filterBindings` | 筛选器类型、id 或 DQE 覆写目标不匹配 |
| `FIELD_CONTRACT_ERROR` 或行路径错误 | 真实响应字段集、`queryField`、类型与 `nullable` | 用样例猜契约，或查询输出已漂移 |
| `DQE_PROTOCOL_ERROR` / `DQE_EXECUTION_ERROR` | 取数单元与数据网关诊断 | 请求体、筛选位置、远程执行或权限；不是组件问题 |
| `DATA_CONTEXT_ERROR` | 当前数据上下文快照与身份 | 字段、关系、权限或口径缺少；保留错误而不猜测 |
| 单文档通过，目录校验失败 | 文件名、`Page.id`、navigate/link 目标 | 单文档入口没有页面仓储视野 |
| 校验通过但数字不对 | 需求、指标条目/已验证查询、生效查询 | 选错指标、时间、维度、筛选或 formula；静态 Schema 不能证明 |
| 数字正确但页面不对 | 组件数据槽、字段绑定、format、布局与浏览器 | 组件选择或呈现语义错误 |

## 命令与证据

单文档：

```bash
pnpm exec tsx .agents/skills/repair-page-metadata/scripts/inspect-page-metadata.ts pages/demo.json
```

页面目录：

```bash
pnpm validate
```

`packages/page/src/validate-cli.ts` 当前把位置参数当作目录，因此文档中的 `pnpm validate pages/demo.json` 不是可用的单文件入口；单文件使用本 skill 脚本。

当前页面校验核心回归：

```bash
pnpm exec vitest run packages/page/tests/validate.test.ts packages/page/tests/validate-cli.test.ts
pnpm --filter @metriccanvas/page check
```

Schema 元数据和仿真语义面问题：

```bash
pnpm exec vitest run packages/mcp/tests/data-context-contract.test.ts tools/dqe-sim/tests/semantic-surface-guard.test.ts
pnpm --filter @metriccanvas/mcp check
```

只运行本次根因涉及的精确测试；修改了共享 Schema、校验器或数据上下文合同时，再扩大到相关包和全仓检查。
