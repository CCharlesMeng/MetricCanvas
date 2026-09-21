# #126 创作生命周期实施票批次（2026-09-14 起，已收口）

## 这批做了什么

在 #95 已交付的架构上，增加**创作生命周期**与**盘古独立开发**两项要求，拆成 20 张票（发布为 #127–#146）。它不是 #95 的替代地图：#95 继续负责静态 Platform 真部署、真实异构集成与盘古基础接入的终点，#126 只做增量。

批次自带一套多会话协同的工程纪律——独立 worktree、逐文件 SHA-256 白名单、统筹台账单点写入——记录在 [`coordination.md`](./coordination.md) 与 [`baseline-assets.json`](./baseline-assets.json)。

## 结论落在哪

**票据拆分与对照见 [`126-implementation-tickets.md`](./126-implementation-tickets.md)**（原 `README.md`，为腾出结论页位置改名）；开发排期见 [`development-plan.md`](./development-plan.md)。

生效的契约结论已经出档，**不要回来读票据原文**：

| 契约 | 现在住在哪 |
|---|---|
| 执行消费契约（T18） | [`t18-execution-contract.md`](./t18-execution-contract.md)——仍被 [`PAGE-METADATA.md`](../../../PAGE-METADATA.md) 与 [`packages/embed/README.md`](../../../packages/embed/README.md) 正文引用 |
| 参数契约（T17） | [`t17-params-contract.md`](./t17-params-contract.md)；已实现形态见 [`PAGE-PARAMETERS.md`](../../../PAGE-PARAMETERS.md) |
| 内容编辑契约（T08） | [`t08-content-edit-contract.md`](./t08-content-edit-contract.md)；组件闭集见 [`docs/page-metadata/components/README.md`](../../page-metadata/components/README.md) |
| 工具契约（T19） | [`t19-tool-contract.md`](./t19-tool-contract.md) |
| 执行样例夹具 | [`t04-contract-examples.json`](./t04-contract-examples.json)——**被两处测试直接读取**，见下 |

对应的架构裁决是 [ADR-0078](../../adr/0078-dimension-values-templates-and-page-instances.md)（维度取值、模板与页面实例）；后续被 [ADR-0080](../../adr/0080-java-assets-single-attempt-save-and-status-publication.md) 部分替代，**当前 Java 发布不以模板/参数提取为前置**。

## 还在被代码引用的两个文件

移动它们必须同步改引用方：

- `t04-contract-examples.json` → `packages/engine/runtime/tests/execution.test.ts`、`apps/platform/tests/workbench/revision-preview-execution-browser.mjs`
- `t18-execution-contract.md` → `PAGE-METADATA.md`、`packages/embed/README.md`

`t04-contract-examples.json` 本质是测试夹具而不是文档，原方案（S1）打算把它迁出文档树。**2026-09-21 决定不迁**：同目录的 [`t04-verify-examples.py`](./t04-verify-examples.py) 用 `Path(__file__).with_name()` 按同级文件名找它，[`t02-evidence.md`](./t02-evidence.md) 与 [`t04-java-relay-proposal.md`](./t04-java-relay-proposal.md) 的正文也写着「同目录」。迁走要么弄断这个已冻结的 checker，要么去改已冻结的实证正文——**改归档件的正文就改变了这份记录当时说了什么**，代价高于收益。**它是 CI 的真实输入，删改前先跑 `pnpm test`。**

## 被推翻的方向

- **不据旧正文的勾选状态判断事实。** #95 正文部分仍写 `adapter-node`，但当时代码已是 `adapter-static`（#104 在 2026-09-10 确认提交已推送）——批次明确规定以代码与最新有证据的评论为准，不据旧正文新建静态化任务。
- **不重做身份机制与容器布局**（#101/#110 的成果沿用），不另拆渲染器或重建画布（#96/#56 的成果沿用）。
- **不建第二套盘古 SDK 适配**：T01 只做内部接缝，真实 SDK / 身份 / 路由依赖 #106–#108，不能靠替身关闭。
- **不另建同义部署票**：新创作验收场景交给现有部署线验证。

## 里面有什么

20 张票稿（`01.md`~`20.md`）、逐票实证（`t01-evidence.md`~`t20-evidence.md`）、四份契约、`handoff/` 下 12 份会话交接，以及 `relations.json` / `index.json` / `published.json` / `verification.json` 等机器留痕。**探索时读本页就够了。**
