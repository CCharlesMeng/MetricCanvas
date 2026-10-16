# 页面试验场（Page Playground）

开发态页面工具：浏览仓库 `pages/` 样例，粘贴或修改页面 JSON，立即校验并通过正式 `RuntimeView` 渲染。它不保存页面资产，不接旧平台 API，也不作为产品交付物。

在仓根按需运行：

```sh
pnpm dev:playground   # 只启动页面试验场，端口 5173
pnpm dev:dqe          # 页面试验场 + DQE HTTP 仿真
pnpm build:playground # 独立静态构建，输出 apps/playground/build
```

默认 `pnpm dev` 和 `pnpm build` 不包含页面试验场，CI 不上传其静态产物；全仓测试和类型检查仍覆盖它。动态查询经共享运行配置模块注入端点与身份，内联页面不需要 DQE。页面文档的编辑只影响当前预览，持久化操作由平台承担。

## Windows 本地连接 gray CloudIOC

在 `apps/playground/.env.local` 中配置（文件已被 Git 忽略；可从 `.env.example` 复制，已有文件则追加）：

```dotenv
PLAYGROUND_CLOUDIOC=true
PLAYGROUND_CLOUDIOC_CFTK="粘贴 gray 站点 localStorage 中 cftk 的原始值"
```

先在同一浏览器中登录 `https://gray.cloudioc.huawei.com`，从开发者工具的 Application → Local Storage 中复制 `cftk` 的值，替换上面的占位内容。配置值不包含示例占位文字；不要提交真实凭据。更新或重新登录后，重新复制并重启页面试验场。缺少 cftk 时开启此模式会明确拒绝启动。

Windows 首次使用还需：

1. 在 `C:\Windows\System32\drivers\etc\hosts` 添加 `127.0.0.1 local.cloudioc.huawei.com`。
2. 确保 443 端口可用，并允许 Node 访问 gray 所需的公司网络；系统策略要求时使用相应权限运行。
3. 运行 `pnpm dev:playground`，访问 `https://local.cloudioc.huawei.com:443`。开发服务器使用包含该域名的自签名证书，首次访问需处理浏览器的证书提示。此模式不需要启动 DQE Sim。

浏览器仍请求本地 `/rest/cdi/cdinl2databuilderservice/v1/dsl/execute`，开发代理将请求转发到 `https://gray.cloudioc.huawei.com` 的相同路径，并在上游请求头加入 `cftk`。因此浏览器 Network 中的请求域名仍是 local，手工配置的 cftk 只在服务器转发时加入，不注入前端脚本或静态构建。AI 总结仍沿用现有仿真代理。

此开关只在 **Windows 的开发服务器** 生效。关闭开关恢复原有 5173 / DQE Sim；macOS、Linux、静态构建与 `vite preview` 忽略该配置。Platform 不受影响。443 端口已占用时直接失败，不自动换端口。

这仅配置开发传输，不建立登录或换取身份的流程；现有运行配置中的 `X-Auth-Token`、`X-Operator-Id`、`X-Workspace-Id` 保持原接线，不能把默认仿真身份视为 gray 的有效用户身份。gray 若需要其他有效凭据，仍须由集成应用提供；新增 cftk 本身不证明真实鉴权成功。上游 TLS 证书继续校验，公司 CA 需由 Node 信任。

页面场景与证据边界见 [Windows gray 开发环境](../../pages/README.md#windows-gray-开发环境)。该配置不进入页面文档，不改变页面协议或本地创作 Skill 的声明规则。

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

### 引擎内置 PDF 下载

打开`http://localhost:5173/pages/report-pdf-export`，或者经营分析分组中的商务SDT月报。Report页头使用`pdfExport: {label?, filename?}`配置按钮和文件名；与日期筛选共用工具带，白底描边，状态在按钮内切换，成功后恢复原名称。编码依赖由引擎提供；Playground高级示例转发到同一实现。页面仓库递归读取pages子目录。本批次未运行测试或构建。
