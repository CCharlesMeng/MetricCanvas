# 统一展示条件验收记录

日期：2026-10-19。基线 `origin/main` = `9c39d6455776cfbd0084d78394fe4edeb55dc3f7`，实施分支 `codex/unified-visibility`。原工作区未修改；所有产品变更在隔离 worktree。协议从 6.33 增量到 6.34，现行决策 [ADR-0111](../../adr/0111-unified-presentation-conditions.md)，唯一执行计划 [B0–B8/C01–C17](../../plan/2026-10-15-page-visibility-and-region-interactions.md)。

## 本仓实现

条件直接写在受控节点，由产品 TS 统一求值。筛选、分区、分区组、组件、Tab、完整本地表格行、按钮、已有动作、工具栏、正文片段与详情共用语义。父级条件单向限制后代，子项全部隐藏仍保留父容器、标题和占位。没有规则注册表、脚本执行、节点依赖图或按隐藏停查机制。原 Page、源图、共享结果和 compute 不改写。

筛选写入走 FilterState 原子事务，层级空选择可保留并恢复 URL；候选按消费者、维度、约束与请求代次隔离。displayInputs 由集成应用传入，待定、错误与拒绝分开；权限修订使旧实例、详情和导出失效。人工属性编辑与 AI 编辑共享产品的封闭目标定位和操作实现，Python 只转发新能力到 Node Bridge。

## 页面、文档与分发映射

| 能力 | 实际页面与证据 | 协议入口 |
|---|---|---|
| 层级空选择、分区与父容器、按钮、条件文字、本地行、Tab、分区组回退 | `pages/page-visibility-region-linkage.json`；[宽屏](wide.png)、[窄屏](narrow.png) | `docs/page-metadata/conditions.md`、`components/button.md`、`filters.md` |
| 有限事实、已有权限、等待/错误、修订停用、公共 JS mount | `pages/page-visibility-inputs.json`；[浏览器报告](browser.json) | `displayInputs`、runtime/Embed/Platform 接线 |
| PDF/PNG/XLSX、导出冻结、权限修订取消 | `pages/page-visibility-report.json`；[实际 PNG](visibility.png)、浏览器 Worker 捕获断言 | 共享展示投影、既有导出链路 |
| 协议版本、非法来源、类型、深度、行键、片段定位 | 产品与分发 conformance 向量、page/runtime 单元测试 | Schema 6.34、`reference-conditions-page.json` |
| 人工/AI 操作差分、失败回滚、隐藏目标 | 产品 operation、属性编辑与 Python stdio 测试 | `set_presentation_condition`、`add_button`、`set_text_parts` |

三页均注册在 Playground 目录；Sim 只由开发应用的目录配置注入，页面没有模拟权限开关。`PAGE-METADATA.md`、`PAGE-PARAMETERS.md`、`pages/README.md` 和本地创作 Skill 已同步。生成器输出同版契约、参考文档、示例、Bundle 和独立 Node Bridge。独立安装及最终文件树验收结果在收尾后补齐。

## 浏览器与导出

`pnpm --filter playground dev --port 5185` 后运行：

```sh
VISIBILITY_BASE_URL=http://127.0.0.1:5185 node apps/playground/tests/page-visibility-browser.mjs /tmp/metriccanvas-visibility-groups
```

Chrome 151，1440/390，15 类行为通过，pageerror 为零。脚本直接读取三份实际页面，未改写交互声明。已人工查看截图：地区部分区消失，父容器保留，组B子项隐藏后组入口仍在，Tab回退正确；宽窄屏可读。新按钮复用 UI Button。

实际 PDF 验证 `%PDF` 文件头；Worker 接缝捕获真实导出 DOM，断言目标分区缺席、空父容器保留、只展开允许的 Tab、投影表格恰好两行；捕获后普通筛选变化不会改变内容。实际 PNG 已查看；XLSX 用 ExcelJS 读取，内容为“名称/金额、代表处A/60、代表处B/40”。权限修订发生在实际 Worker 启动接缝时，取消本次下载。下载文件保留在 `/tmp/metriccanvas-visibility-groups/`。

公共 JS `mount` 直接注入稳定 displayInputs：等待、允许、修订失效及 destroy/remount 均通过。平台保存重开使用真实 DS 产物和本地 HTTP Java/DQE 替身，在1440/640下通过，重开重新发出7次DQE请求，[报告](model-browser.json)。已人工查看640截图，标题、区域、18/12行值及柱图可读。

## 模型与受控链路

[无模型预检](preflight.json) 通过，modelRequests=0；[确定性六用例](scripted.json) 全绿，modelCalls=0。[真实 DS 合并记录](model-merged.json) 覆盖三种创建和三种编辑；没有单次全量全绿。真实模型为 deepseek-v4-flash，各次参数、用量、Skill/用例 hash 在对应报告中。

| 用例 | 确定性 | 真实 DS | 页面产物 | 浏览器 |
|---|---|---|---|---|
| create-report | pass | pass | pass | 由保存后的 edit-report 产物覆盖 |
| create-dashboard | pass | pass | pass | 本轮未单独复验 |
| create-complex-report | pass | pass | pass | 本轮未单独复验 |
| edit-report | pass | pass | pass，局部差分与零取数断言 | pass，保存重开重新取数 |
| edit-dashboard | pass | pass | pass，局部差分与零取数断言 | 本轮未单独复验 |
| edit-add-data | pass | pass | pass，保留旧源和旧组件 | 本轮未单独复验 |
| 新展示条件三种编辑操作 | 产品/stdio pass | NOT_RUN | parse/差分/失败回滚 pass | 实际功能页 pass |

首次全量因600000预算阻塞后续编辑；第二轮 edit-report通过，但 edit-dashboard遇MCP Connection closed，edit-add-data预算不足。随后分别重跑dashboard与新增数据用例均通过，未删除失败报告，见 `model-first.json`、`model-edit-retry.json`、`model-dashboard-retry.json`、`model-add-retry.json`。完整脱敏轨迹、HTTP日志与 `document.json` 保留在 `/tmp/visibility-ds-*`。这证明六个既有创作主流程的回归；新增条件操作只有确定性证据，不能称为真实模型已掌握条件创作。

## 最终回归与安装兼容

Python完整回归已通过：544项，1项既有skip。详情工具栏补齐执行条件与触发复核，参考文档生成器统一结尾换行。隔离安装矩阵正在基于最终提交运行；其余已通过类型检查、产品/Playground构建、定向行为回归、共享契约检查、2910项Bundle digest检查、ADR索引及Python复杂度检查（366函数、最大15、超限0）。全量回归首次发现旧目录/组件计数/页面身份断言，已修正并定向全绿；一次Python完整回归与契约生成并行，命中重建目录短暂不存在的测试设施竞态；冻结后完整重跑通过。首次全量TS有3项生成隔离场景在并行构建期间超过30秒，单独测量生成器为5.62秒；最终安装矩阵将顺序完成测试和构建，不扩大超时门槛。

## 外部边界

真实 CloudIOC、内网 Java、生产 DQE、Relay 身份/权限和部署验收均 NOT_RUN：本机未配置相应生产身份与可达内网端点。本地 inline、Sim、受控 HTTP、Chrome 和 DS 不能替代这些证据。恢复方式：由真实集成应用注入当前身份权限与有限事实，复用以上三页和 C01–C17，分别核验身份失效、真实候选级联、DQE重查及导出取消；不改页面增加模拟后门。本批不部署、不发布页面、不改现有权限。
