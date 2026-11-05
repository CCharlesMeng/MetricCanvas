# IOC Header 子控件

入口：`/pages/ioc-header-controls`。在仓库执行 `pnpm dev:playground`，访问开发服务的对应路径，无需业务服务或额外 URL 参数。页面由真实 JSON 自动发现，使用应用级合成数据网关及合成组织树。

1. 页头仅出现年份与一个区域下拉；默认年份 2026，区域未选中。没有额外前置层级按钮或空“区域”行。
2. 打开区域树，选择“上海代表处”，页头与表格范围回显“上海代表处”，URL 写入既有 `rep-office` 参数。应用级 Adapter 收到标准 `region` 候选请求；查询仍使用既有 `levelQueryFields` 的代表处字段。
3. 清空区域后，表格回显“全球（当前范围不限）”，URL 不再包含选中组织值；不会强制把树节点设为全球。年份保持原选择。
4. 选择全球只表达既有不限组织范围语义；切年份仍使用原期间筛选。未绑定 region 的数据源不受区域变更影响。

`packages/page/tests/ioc-header-controls.test.ts` 覆盖旧声明、不显式添加 Region、冲突与版本、输入不变性；`packages/data-execution/tests/operation-map-region.test.ts` 覆盖候选路由、取消、失败及真实 SourceProgram 查询字段。非法声明还随产品契约生成反例。

本场景证明本地页头、候选、URL 与查询绑定链路，不证明真实 Operation Map 网络、权限名单、DQE 数据或部署。

Embed 公共入口复验：先执行 `pnpm --filter @metriccanvas/embed build`，在 Embed 包执行 `node tests/serve.mjs`；访问 `/examples/ioc-header-controls.html`（ES）与 `?entry=global`（global），均读取同一 `ioc-header-controls.json`，并显示 Adapter 已接入及查询回显。
