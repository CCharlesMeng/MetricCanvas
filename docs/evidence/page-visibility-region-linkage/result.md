# 统一展示条件验收记录

日期：2026-10-19。基线 `origin/main` = `9c39d6455776cfbd0084d78394fe4edeb55dc3f7`，实施分支 `codex/unified-visibility`。原工作区未修改；所有产品变更在隔离 worktree。协议从 6.33 增量到 6.34，现行决策 [ADR-0112](../../adr/0112-unified-presentation-conditions.md)，唯一执行计划 [B0–B8/C01–C17](../../plan/2026-10-15-page-visibility-and-region-interactions.md)。

## 本仓实现

条件直接写在受控节点，由产品 TS 统一求值。筛选、分区、分区组、组件、Tab、完整本地表格行、按钮、已有动作、工具栏、正文片段与详情共用语义。父级条件单向限制后代，子项全部隐藏仍保留父容器、标题和占位。没有规则注册表、脚本执行、节点依赖图或按隐藏停查机制。原 Page、源图、共享结果和 compute 不改写。

筛选写入走 FilterState 原子事务，层级空选择可保留并恢复 URL；候选按消费者、维度、约束与请求代次隔离。displayInputs 由集成应用传入，待定、错误与拒绝分开；权限修订使旧实例、详情和导出失效。人工属性编辑与 AI 编辑共享产品的封闭目标定位和操作实现，Python 只转发新能力到 Node Bridge。

## 页面、文档与分发映射

| 能力 | 实际页面与证据 | 协议入口 |
|---|---|---|
| 层级空选择、分区与父容器、按钮、条件文字、本地行、Tab、分区组回退 | `pages/page-visibility-region-linkage.json`；[宽屏](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/page-visibility-region-linkage/wide.png)、[窄屏](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/page-visibility-region-linkage/narrow.png) | `docs/page-metadata/conditions.md`、`components/button.md`、`filters.md` |
| 有限事实、已有权限、等待/错误、修订停用、公共 JS mount | `pages/page-visibility-inputs.json`；[浏览器报告](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/page-visibility-region-linkage/browser.json) | `displayInputs`、runtime/Embed/Platform 接线 |
| PDF/PNG/XLSX、导出冻结、权限修订取消 | `pages/page-visibility-report.json`；[实际 PNG](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/page-visibility-region-linkage/visibility.png)、浏览器 Worker 捕获断言 | 共享展示投影、既有导出链路 |
| 协议版本、非法来源、类型、深度、行键、片段定位 | 产品与分发 conformance 向量、page/runtime 单元测试 | Schema 6.34、`reference-conditions-page.json` |
| 人工/AI 操作差分、失败回滚、隐藏目标 | 产品 operation、属性编辑与 Python stdio 测试 | `set_presentation_condition`、`add_button`、`set_text_parts` |

三页均注册在 Playground 目录；Sim 只由开发应用的目录配置注入，页面没有模拟权限开关。`PAGE-METADATA.md`、`PAGE-PARAMETERS.md`、`pages/README.md` 和本地创作 Skill 已同步。生成器输出同版契约、参考文档、示例、Bundle 和独立 Node Bridge。最终文件树与独立安装结果见[安装验收](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/page-visibility-region-linkage/installed-acceptance.json)，原始失败阶段记录另存[原矩阵记录](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/page-visibility-region-linkage/compatibility-original.json)。

## 浏览器与导出

`pnpm --filter playground dev --port 5185` 后运行：

```sh
VISIBILITY_BASE_URL=http://127.0.0.1:5185 node apps/playground/tests/page-visibility-browser.mjs /tmp/metriccanvas-visibility-verified
```

Chrome 151，1440/390，16 类行为通过，pageerror 为零。脚本直接读取三份实际页面，未改写交互声明。已人工查看截图：地区部分区消失，父容器保留，组B子项隐藏后组入口仍在，Tab回退正确；宽窄屏可读。新按钮复用 UI Button。

实际 PDF 验证 `%PDF` 文件头；Worker 接缝捕获真实导出 DOM，断言目标分区缺席、空父容器保留、只展开允许的 Tab、投影表格恰好两行；捕获后普通筛选变化不会改变内容。实际 PNG 已查看；XLSX 用 ExcelJS 读取，内容为“名称/金额、代表处A/60、代表处B/40”。权限修订发生在实际 Worker 启动接缝时，取消本次下载。下载文件保留在 `/tmp/metriccanvas-visibility-verified/`。

公共 JS `mount` 直接注入稳定 displayInputs：等待、允许、修订失效及 destroy/remount 均通过。新增替换source对象的真实回归，确认页面重新初始化不能覆盖实例级权限失效锁；旧实例必须重新挂载。筛选批次中无效子级写入不再阻止父级清理旧后代；条件行回调重取当前行，缺键、重复键和已移除行均拒绝执行。平台保存重开使用真实 DS 产物和本地 HTTP Java/DQE 替身，在1440/640下通过，重开重新发出7次DQE请求，[报告](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/page-visibility-region-linkage/model-browser.json)。已人工查看640截图，标题、区域、18/12行值及柱图可读。

## 模型与受控链路

[无模型预检](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/page-visibility-region-linkage/preflight.json) 通过，modelRequests=0；[确定性六用例](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/page-visibility-region-linkage/scripted.json) 全绿，modelCalls=0。[真实 DS 合并记录](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/page-visibility-region-linkage/model-merged.json) 覆盖三种创建和三种编辑；没有单次全量全绿。真实模型为 deepseek-v4-flash，各次参数、用量、Skill/用例 hash 在对应报告中。

| 用例 | 确定性 | 真实 DS | 页面产物 | 浏览器 |
|---|---|---|---|---|
| create-report | pass | pass | pass | 由保存后的 edit-report 产物覆盖 |
| create-dashboard | pass | pass | pass | 本轮未单独复验 |
| create-complex-report | pass | pass | pass | 本轮未单独复验 |
| edit-report | pass | pass | pass，局部差分与零取数断言 | pass，保存重开重新取数 |
| edit-dashboard | pass | pass | pass，局部差分与零取数断言 | 本轮未单独复验 |
| edit-add-data | pass | pass | pass，保留旧源和旧组件 | 本轮未单独复验 |
| 新展示条件三种编辑操作 | 产品/stdio pass | NOT_RUN | parse/差分/失败回滚 pass | 实际功能页 pass |

首次全量因600000预算阻塞后续编辑；第二轮 edit-report通过，但 edit-dashboard遇MCP Connection closed，edit-add-data预算不足。随后分别重跑dashboard与新增数据用例均通过，未删除失败报告，见 [model-first.json](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/page-visibility-region-linkage/model-first.json)、[model-edit-retry.json](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/page-visibility-region-linkage/model-edit-retry.json)、[model-dashboard-retry.json](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/page-visibility-region-linkage/model-dashboard-retry.json)、[model-add-retry.json](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/page-visibility-region-linkage/model-add-retry.json)。完整脱敏轨迹、HTTP日志与 `document.json` 保留在 `/tmp/visibility-ds-*`。这证明六个既有创作主流程的回归；新增条件操作只有确定性证据，不能称为真实模型已掌握条件创作。

## 最终回归与安装兼容

冻结产品源码为`0c6464bf`，运行时与构建输入hash见[frozen-inputs.json](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/page-visibility-region-linkage/frozen-inputs.json)。完整TS回归263文件、2295通过、4项既有skip；Python完整回归544项、1项既有skip，最终Bridge相关18项另行通过。详情工具栏补齐执行条件与触发复核，参考文档生成器统一结尾换行。类型检查、全部包/Platform/Playground生产构建及独立安装均通过；另已通过、产品/Playground构建、定向行为回归、共享契约检查、2910项Bundle digest检查、ADR索引及Python复杂度检查（366函数、最大15、超限0）。全量回归首次发现旧目录/组件计数/页面身份断言，已修正并定向全绿；一次Python完整回归与契约生成并行，命中重建目录短暂不存在的测试设施竞态；冻结后完整重跑通过。首次全量TS及安装矩阵遇到生成隔离场景超时；复用同一Schema的联合分支编译后，独立检查从5.62秒降至2.94秒，产物完全不变。26项参考/生成隔离回归及最终2295项全量回归通过，未扩大超时门槛。

## 外部边界

真实 CloudIOC、内网 Java、生产 DQE、Relay 身份/权限和部署验收均 NOT_RUN：本机未配置相应生产身份与可达内网端点。本地 inline、Sim、受控 HTTP、Chrome 和 DS 不能替代这些证据。恢复方式：由真实集成应用注入当前身份权限与有限事实，复用以上三页和 C01–C17，分别核验身份失效、真实候选级联、DQE重查及导出取消；不改页面增加模拟后门。本批不部署、不发布页面、不改现有权限。

## C01–C17 对照

| 编号 | 本地证据 | 结论 |
|---|---|---|
| C01/C02 | 层级空选、URL reload、FilterState URL与事务行为测试 | pass |
| C03/C04 | 目标分区隐藏、保留空父级、动态/静态隐藏筛选仍保留状态 | pass |
| C05 | Tab/组回退、无可用项、恢复不复活旧选择、空组入口保留 | pass |
| C06 | SourceProgram既有回归、纯展示投影保留源图；inline浏览器无查询 | pass，本轮无真实门户查询 |
| C07/C08 | 同源另一Tab仍三行、本表/XLSX两行；远程窗口拒绝单测 | pass |
| C09 | 门禁与嵌套动作、详情工具栏、当前行重取/重复键拒绝 | pass，本地行为/类型接线 |
| C10/C11 | 正文片段、Text Value既有回归；not/any缺键/等待/错误 | pass |
| C12 | 候选代次、消费者隔离、递归级联与单次通知单测 | pass |
| C13 | Worker真实导出捕获与冻结、普通变化/权限变化下载分支 | pass |
| C14 | 版本绕行拒绝、合法旧页面conformance | pass |
| C15 | 产品受控operation、属性编辑、Python stdio和保存重开模型基线 | pass，新条件真实DS单列NOT_RUN |
| C16 | JS mount、仓外Skill、Node、严格peer安装、UI/组合消费者和Chrome浏览器 | pass，Edge NOT_RUN |
| C17 | 只读输入、已有权限修订、换source不能越过失效锁 | pass |

## Chrome安装验收收口

[完整安装记录](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/page-visibility-region-linkage/installed-acceptance.json) 对应`/tmp/visibility-compatibility-complete/`。从冻结Git树重新安装依赖，完整测试、全仓类型检查和生产构建通过；六个包均tar安装到仓外，确认没有指回工作区。page-only Node ESM、UI-only无产品依赖、Svelte/TS类型及Vite构建通过，UI浏览器24项通过。

组合浏览器最初因其他工作区占用4176端口而停止；后续Chrome完整运行138通过、16失败，均为新增按钮后旧矩阵仍要求53个分支。计数同步为54，并为受权限控制的静态参考按钮提供明确有限事实；保留原有所有测试，新条件用例使用独立文件。最终通过可配置空闲端口63453续跑，Chrome155下156项全部通过、零skip，包含实际层级页、事实页中的层级/父容器/私有行及替换输入源后失效锁。

续跑仅更新浏览器测试与端口配置，已编译产品文件与冻结hash一致；源码未在安装测试期间修改。首次失败报告和日志保留，不能把原始`compatibility:check`退出1写成默认全矩阵通过。Chrome本地安装验收通过；默认要求的Edge未运行，因为本机未安装Microsoft Edge。恢复方式：安装真实Edge后，在空闲端口下运行默认双浏览器矩阵；不可将Chrome可执行文件冒充Edge。

真实DS的新增条件创作未运行，六个既有主流程合并通过；真实CloudIOC/Java/DQE/Relay亦未运行。上述限制不影响已完成的本仓条件声明、同一引擎语义和Chrome本地验收，生产接入结论仍待相应环境提供证据。

安装验收后的测试/端口修改再次通过 `pnpm check`（零错误/警告）；最终Playground生产构建、契约检查、2910项Bundle校验和ADR索引检查均通过。浏览器测试提交与运行时冻结提交分别记录在JSON中，原工作区和其他任务的4176服务保留。分支本地提交可审阅，尚未合并主线或推送，不宣称远端CI通过。


## 主线交付合并（2026-10-20）

本节为后续交付记录；前文的 6.34、冻结提交及安装报告保留为当时证据。交付合入最新 `origin/main` `5dcfe6f6d97e87bb789bcecc4d3741b3c76929f8`，保留指标卡前置连接文字和 Playground 目录/操作说明。主线已登记 6.34／ADR-0111，因此统一展示条件递增为 **6.35／ADR-0112**；页面、能力门禁、反例、文档、知识和独立校验器从合并后的产品真源重新生成。

补齐两项整合：三份功能页加入新版目录的能力、环境与操作说明；展示投影隐藏指标卡时切断原相邻连接，避免跨过隐藏卡片重新连接，恢复后沿用原声明。只调整渲染投影，不改原 Page。新增行为回归同时检查连接分组及原文档不变。

合并后的 `pnpm check` 零错误/警告，补丁后的 engine 类型检查、`pnpm build && pnpm build:playground` 均通过；页面 37/37 校验通过，契约生成一致性及 ADR 索引通过。版本、条件、属性编辑、指标卡、目录和投影的 45 项定向回归通过；仓外 local-authoring 安装与独立校验 20 项通过。未追加其他 Skill 或真实 DS 模型复验。

`VISIBILITY_BASE_URL=http://127.0.0.1:5185 node apps/playground/tests/page-visibility-browser.mjs /tmp/metriccanvas-visibility-main-635` 在 6.35 三份实际页面上完成 16 类场景，pageerror 为零，包括公共 JS 输入、权限失效、替换输入源、PDF/PNG/XLSX 和导出取消。[浏览器结果](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/page-visibility-region-linkage/merge-browser-6.35.json)与[合并输入和检查记录](https://github.com/CCharlesMeng/MetricCanvas/blob/9ee7e6ac611e5651046dde16f9b5fc44dc0974b1/docs/evidence/page-visibility-region-linkage/main-merge-6.35.json)分别保留机器证据。合并后的仓外浏览器矩阵交由远端 CI；真实 CloudIOC/Java/DQE/Relay 与新条件真实 DS 创作仍未运行。

首次合并全量 TS 回归覆盖267文件，2329通过、5项既有skip、2项目录失败：自动合并把新增页面放入了能力列表，导致目录缺页及能力缺少文档。已修复为独立能力及三份完整页面说明，目录9/9与合并回归45/45通过。最终提交的全量结论以远端CI为准，未把首次失败写成全绿。
