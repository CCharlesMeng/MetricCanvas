# AI Summary 复数命名修正与元数据修改流程

最终交付基线为 `f69ac7912252da5556f8934b382367553725fb03`，包含并行的决策意见预览与表头筛选改动。初始检查从 `4e30dece` 开始；纳入并行提交后，从合并后的产品真源重新生成契约并重跑受影响的检查，未覆盖主工作区的并行修改。

## 修正

Schema 6.53 的正式声明为 `relatedDataSources: ["usage", "comparison"]`，与同层 `relatedSections` 对称。完整 Report 示例、产品文档、云宝交接和本地创作知识统一推荐复数。数据范围、非明细字段投影、时间条件、异步 Adapter 和任务缓存语义保持。

已发布的 6.52 单数 `relatedDataSource` 仍可读取。新旧拼写由 page 中的 `aiSummarySourceReferences` 集中解析，数据执行、输入组装与分页引用检查共用；诊断保留文档实际使用的字段路径。新旧拼写同时出现时拒绝，不合并范围。旧 `relatedData` 字段白名单声明的读取规则保持。

正式字段、旧别名、值形态与版本分别验证。测试直接断言示例具有 `relatedDataSources` 且不具有旧单数，不从被测 Schema 推导这份命名期望。

## 后续工作方式

规则落在 `docs/agents/page-metadata-changes.md`，并从既有必读 `feature-acceptance.md` 接入：

1. 先写完整声明，同时核对业务含义、路径、数量形态、省略/空值、引用所有者和同层命名。
2. 使用处引用已有定义，避免摘要再维护一份数据源字段与术语映射。
3. 以产品 Schema 和语义实现为真源，版本、完整页面、文档、契约向量、Skill 与独立校验器同批生成。
4. 用独立的字段名与值形态期望补足行为测试，覆盖合法、错误和历史声明。
5. 更名时明确当前正式声明与历史读取兼容，集中解析，禁止冲突；不以增加逐字段审批替代实现者自检。

## 验证结果

- `pnpm check`：合并基线后的完整类型与 Svelte 检查通过。
- 相关 page、data-execution、runtime、runtime-ui、local-authoring、reference 与并行预览回归：192 个文件、1549 项通过。
- `pnpm authoring:contracts:check`：1100 product / 4 authoring / 1 interface 文件与真源一致。
- `local-authoring-skill.test.ts` 在仓外复制安装后验证复数正式声明、6.52 单数读取与 6.51 版本拒绝；原有协议向量、引用与哈希闭合检查通过。
- 使用 4e30dece 的独立校验器与当前独立校验器对照单数声明的六种输入（合法、未知 ID、重复 ID、空数组、provided 冲突、版本不足），退出状态与完整有序错误列表全部一致。详细 JSON 保留在本地证据目录。
- `pnpm validate pages`：合并后的完整页面目录全部通过。
- 包构建、Embed 构建与 `pnpm packages:check` 通过。
- 浏览器两项回归通过：复数正式声明、独立区域上下文、时间切换、后台完成、缓存复用与导出；SDT 摘要宽窄尺寸样式一致。
- 实际 Playground 打开 `/pages/report-ai-summary`，查看页面 JSON 确认为 6.53 与 `relatedDataSources: ["comparison"]`，两区域生成结果正常。

以上为本地确定性、DQE Sim 与 Mock 证据，不代表真实云宝、DQE/Relay 或内网身份验收。交付沿用用户的 `[skip ci]` 要求，跳过 CI 不代表 CI 通过。

## 复杂度

工具为 `metriccanvas-ts-ast/1`，TypeScript 5.9.3；按每个函数自身 CC 测量，包含新增回调和测试回调。

| 函数 | 前 | 后 |
| --- | ---: | ---: |
| aiSummarySourceReferences | 新增 | 3 |
| aiSummaryRelatedData | 5 | 5 |
| aiSummaryErrors 的组件回调 | 9 | 9 |
| providedErrors | 7 | 7 |
| sourceErrors | 6 | 8 |
| addSummaryReferences | 5 | 5 |
| assembleGenerationInput | 8 | 8 |

新增版本能力回调 CC 2，新增契约测试回调 CC 1；其余修改的测试与向量回调均不超过 15。本批无未关闭的新增或修改函数超限。未修改 Svelte 脚本与模板；扫描到的未修改存量函数未纳入本批重构。
