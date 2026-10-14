# 页面试验场（Page Playground）

开发态页面工具：浏览仓库 `pages/` 样例，粘贴或修改页面 JSON，立即校验并通过正式 `RuntimeView` 渲染。它不保存页面资产，不接旧平台 API，也不作为产品交付物。

在仓根按需运行：

```sh
pnpm dev:playground   # 只启动页面试验场，端口 5173
pnpm dev:dqe          # 页面试验场 + DQE HTTP 仿真
pnpm build:playground # 独立静态构建，输出 apps/playground/build
```

默认 `pnpm dev` 和 `pnpm build` 不包含页面试验场，CI 不上传其静态产物；全仓测试和类型检查仍覆盖它。动态查询经共享运行配置模块注入端点与身份，内联页面不需要 DQE。页面文档的编辑只影响当前预览，持久化操作由平台承担。

## 时间筛选与级联查询示例

首页先提供 Dashboard（看板）与 Report（报表）布局形态筛选，再按业务示例（经营分析、IOC 作战地图）、功能演示和验收样例组织页面，支持按名称、页面 ID、说明与功能标签搜索。卡片显示布局形态，直接从页面文档读取，并与预览外框使用同一读取规则；未声明时按协议默认归为 Report。预览页顶部提供返回页面目录的入口。

目录分组、顺序、短说明与标签由 [`page-catalog.json`](./page-catalog.json) 维护，只属于开发工具，不进入页面协议。页面标题仍来自页面文档；未配置的新页面自动显示在“待归类”中，已删除的页面不会留下目录入口。新增样例时，在该文件的 `pages` 数组中补充对应记录即可。

页面结构与版本入口见[页面元数据规范](../../PAGE-METADATA.md)，时间输入及筛选配置见[参数专题](../../PAGE-PARAMETERS.md#时间参数与顶部筛选)，结果绑定配置见[级联查询专题](../../docs/cascading-queries.md)。运行 `pnpm dev:dqe` 后，从首页选择样例，或直接打开：

| 场景 | 预览入口 | 完整页面JSON |
|---|---|---|
| 报告顶部月份范围与查询、期间文字联动 | [报告页头时间筛选示例](http://localhost:5173/pages/report-date-filter-example) | [report-date-filter-example.json](../../pages/report-date-filter-example.json) |
| Top5主查询驱动阶段明细查询并关联展示 | [商务SDT报告](http://localhost:5173/pages/business-sdt-report) | [business-sdt-report.json](../../pages/business-sdt-report.json) |

[JSON即时预览](http://localhost:5173/preview)允许粘贴上述完整页面文档。开发态另有[日期筛选验收演示](http://localhost:5173/preview?prototype=report-date)，支持四种月/日单点与范围形态、日期参数提取和PDF导出；该演示使用本地合成数据，完整样例查询使用本地DQE仿真。

## PDF下载演示

运行 `pnpm dev:playground`，打开[PDF下载演示](http://localhost:5173/preview?prototype=report-date)，提交期间后点击“导出 PDF”。浏览器下载 `经营分析报告.pdf`，页面展示实际PDF第一页并提供再次下载和打开链接。报告包含全部内容分区组、Tabs和捕获查询范围内的完整表格行；“准备完整导出视图”按钮只展示静态DOM。

下载范围、编码服务的Chromium/Poppler依赖及接入方法统一见[报告完整导出与PDF下载接入](../../docs/report-export.md)。此编码服务仅在开发态提供；集成应用提供生产下载入口与编码器。

旧应用名为 Canvas；目录和包名现为 `apps/playground` / `playground`。搭建画布组件 `MetricCanvas` 与渲染引擎的名字保持原义。边界裁决见 [ADR-0075](../../docs/adr/0075-page-playground-as-development-tool.md)。
