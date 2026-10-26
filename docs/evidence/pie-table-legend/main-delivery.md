# main 整合验收（2026-10-26）

实施分支 `codex/pie-table-legend` 从原始基线 `ea40f6641e41e974dd3f1801c4613c5a1a7fcd45` 整合到 `85144cb3ead6b61e859ab0ef8df43da43b29e7f5`。原始验收和 unit/align 验收保留为当时记录；本页补充最新 main 上的交付输入。原工作区的并行未提交修改未带入。

## 整合

- 能力版本改为 6.63，保留 main 的全部 6.52–6.62 能力、常量来源与空态协议。新增图例、排序和百分比投影复用 `resolveComponentValue`，常量与字段来源都与扇区保持一致。
- 表格式图例的 `type: table` 暴露了用数扫描器按 type 单独识别组件的歧义。识别时要求组件根结构同时有 id/props；补充真实 table 字段扫描回归，避免把内部图例当作表格组件。没有改变表格业务协议。
- 合并产品真源后，重新生成产品契约、local-authoring、MC 内容和 MC 场景夹具，不手工合并派生 JSON。

## 复验

- Page 与 widgets、local-authoring Skill、page-reference 回归：119 文件、1286 测试通过。
- 扫描器补充后，local-authoring-tools、local-authoring-skill、mc-content-coverage：3 文件、58 测试通过。
- Page、引擎、Playground 类型检查通过，Svelte 0 errors / 0 warnings；工具/测试 TypeScript 检查通过。
- Playground 静态构建通过。最新 Schema、模板知识及 MC 导出：1234 product / 4 authoring / 1 interface outputs。
- 真实浏览器重载 `/pages/pie-table-legend` 后确认首图 `96 家`、缺省右对齐，第二图数量居中/占比左对齐，数量变化图左/右对齐，旧缺省列无单位。窄卡片实际宽约 253px，图例位于 plot 下方。截图 [main-browser.jpg](main-browser.jpg)。
- 导出需要新版 MC 的 Python 依赖，使用已有 `/tmp/mc-content-completeness-venv` 的 Python 3.14.7 / FastMCP 3.4.7，未修改环境或依赖锁。远端 CI 使用仓库锁定依赖独立验证。

补充检查结果在完成后追加，远端 SHA 与 CI 以交付答复为准。

## 复杂度与边界

口径仍为 `metriccanvas-ts-ast/1` / TypeScript 5.9.3。基于最新 main：`pieOption` 9→9、`pieRows` 1→4、`checkPieChart` 1→9、`scanPageData` 13→13（组件查找回调 1→3）；新增 `projectColumn` 3、`pieLegendData` 3。其他本批函数及回调均未超过 15；原始及 unit/align 记录中的其他结果仍适用。Svelte 脚本/模板函数分开提取，原始测量见 [main-complexity.json](main-complexity.json)。本批无未关闭的复杂度问题。

真实 DQE、Relay、权限服务、模型与端到端导出未复验。原型快照 `f6fd243c` 留在本地 `codex/pie-table-legend-prototype`，作为设计裁决的可恢复记录；不会混入 main。实施工作树在远端提交与 CI 核对后归档。

## 最终 6.64 输入

并行的筛选工具栏能力占用 6.63 后，本批顺延至 6.64，并整合基线 `c92ef51dc158ad31f7b016606c54b85c69262162`；其后 `d1e6c172f417422d8d208e951dde8b3d4deb8a73` 仅补充其他任务的验收文档，不改变验证输入。上述第一次整合结果保留为过程记录。

最终输入复验：122 文件、1316 测试通过；Page/引擎/Playground/工具 TypeScript 检查及 Playground 静态构建通过；1236 product / 4 authoring / 1 interface 导出一致，MC 覆盖检查、30 项 Python 测试和诊断夹具检查全部通过。浏览器重载 6.64 页面后仍显示正确单位、列头与顺序。代码执行分支和复杂度结果与前次整合相同。

仓外隔离回归中的一次 knowledge.json 漂移拒绝场景在本机 90 秒上限超时（没有错误回执），其余 8 项通过；此项需单独重跑，不放宽时限。首次 6.63 输入的 9 项隔离检查曾全部通过，不能用该旧结果替代最新输入。

最终隔离复验：使用仓库已有 Python 3.12.13 / FastMCP 3.4.7 环境（与 CI 的 Python 次版本一致），对 `无旧链时可运行|生成内容漂移：references/knowledge.json` 两项定向重跑，2 项通过，28 项未选中，耗时 36.28 秒；超时问题已以原时限下重跑关闭。此前在 Python 3.14 环境单独重跑 knowledge.json 漂移拒绝场景也通过，不能据此断言超时根因为 Python 版本。未修改依赖锁或检查超时阈值。
