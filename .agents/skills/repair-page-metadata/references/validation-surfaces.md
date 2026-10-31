# 页面元数据校验面

## 使用方法

先找到失败所在的最低层，再向上补足直到用户意图的证据。下层通过不能推导上层正确。

## 覆盖矩阵

| 层 | 当前入口 | 能稳定发现 | 不能单独判定 |
|---|---|---|---|
| JSON 语法 | `inspect-page-metadata.ts` | JSON 解析失败 | 页面语义 |
| 单页文档 | `parsePage` / `validate_page` | 版本、必填项、未定义属性、枚举、id 格式与重复、行契约、`queryField` 覆盖与角色、筛选绑定、数据槽和字段引用、组件能力、action、查询分页、静态/动态约束 | 文件名、目标页存在性、数据上下文合法性、DQE 真实可执行性、业务口径、页面是否好用 |
| 页面目录 | `pnpm validate` 或诊断脚本的目录模式 | 递归发现、跨目录重复页面 ID、文件名与 `Page.id`；每页仍按产品规则检查导航 URL 与输入绑定 | 部署目标存在性、目标页面筛选器、真实权限、查询结果 |
| Schema 元数据结构 | `metriccanvas-authoring/tool/metriccanvas_authoring/data/data_context.py` 的 `parse_data_context` | 快照结构、指标和维度的名称与别名索引；具体约束读取当前实现及 `docs/schema-metadata.md` | 指标口径真实性、当前身份的实际权限、数据服务可用性 |
| 取数单元 | `metriccanvas-authoring/tool/metriccanvas_authoring/data/executable_units.py` 的 `derive_executable_units`，以及项目已提供的查询执行入口 | 基于当前数据上下文派生请求与结果字段契约，检查名称和执行约束 | 用户是否选了正确指标、业务口径，以及尚未执行请求的真实结果 |
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
| 单文档通过，目录校验失败 | 递归文件树、重复 ID、其他文档错误 | 单文件未扫描整个目录；导航目标不依赖仓库页面集合 |
| 校验通过但数字不对 | 需求、指标条目/已验证查询、生效查询 | 选错指标、时间、维度、筛选或 formula；静态 Schema 不能证明 |
| 数字正确但页面不对 | 组件数据槽、字段绑定、format、布局与浏览器 | 组件选择或呈现语义错误 |

## 命令与证据

单文档：

```bash
pnpm exec tsx .agents/skills/repair-page-metadata/scripts/inspect-page-metadata.ts pages/capabilities/layout/demo.json
```

页面目录：

```bash
pnpm validate
```

`packages/page/src/validate-cli.ts` 当前把位置参数当作目录，因此文档中的 `pnpm validate pages/capabilities/layout/demo.json` 不是可用的单文件入口；单文件使用本 skill 脚本。

诊断工具与当前页面校验核心回归：

```bash
pnpm skills:repair:check
pnpm exec vitest run packages/page/tests/validate.test.ts packages/page/tests/validate-cli.test.ts
pnpm --filter @metriccanvas/page check
```

Schema 元数据和仿真语义面问题：

```bash
pnpm exec vitest run tools/dqe-sim/tests/semantic-surface-guard.test.ts
python3 -m unittest discover -s metriccanvas-authoring/test-harness/tests -p test_query_validation_policy.py
```

Python 回归使用已安装 Bundle 锁定依赖的维护环境，不要求普通页面修复者安装或启动服务。真实数据上下文的探查先读取 `metriccanvas-authoring/scripts/check_data_context.py` 的帮助，并使用项目提供的适配器配置；该命令可能访问元数据服务，不能用本地快照校验替代真实执行。

只运行本次根因涉及的精确测试；修改了共享 Schema、校验器或数据上下文合同时，再扩大到相关包和全仓检查。两个核心入口的统一回归为 `pnpm skills:check`。
