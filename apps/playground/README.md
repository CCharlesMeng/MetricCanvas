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

统一配置说明见[页面元数据规范](../../PAGE-METADATA.md)。运行 `pnpm dev:dqe` 后，从首页选择样例，或直接打开：

| 场景 | 预览入口 | 完整页面JSON |
|---|---|---|
| 报告顶部月份范围与查询、期间文字联动 | [报告页头时间筛选示例](http://localhost:5173/pages/report-date-filter-example) | [report-date-filter-example.json](../../pages/report-date-filter-example.json) |
| Top5主查询驱动阶段明细查询并关联展示 | [商务SDT报告](http://localhost:5173/pages/business-sdt-report) | [business-sdt-report.json](../../pages/business-sdt-report.json) |

[JSON即时预览](http://localhost:5173/preview)允许粘贴上述完整页面文档。开发态另有[日期筛选验收演示](http://localhost:5173/preview?prototype=report-date)，支持四种月/日单点与范围形态、日期参数提取和PDF导出；该演示使用本地合成数据，完整样例查询使用本地DQE仿真。

旧应用名为 Canvas；目录和包名现为 `apps/playground` / `playground`。搭建画布组件 `MetricCanvas` 与渲染引擎的名字保持原义。边界裁决见 [ADR-0075](../../docs/adr/0075-page-playground-as-development-tool.md)。
