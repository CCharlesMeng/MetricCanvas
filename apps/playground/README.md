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

浏览器仍请求本地 `/rest/cdi/cdinl2databuilderservice/v1/dsl/execute`，开发代理将请求转发到 `https://gray.cloudioc.huawei.com` 的相同路径。Windows 开发模式将配置的 cftk 注入页面试验场的请求实现，浏览器 Network 的 Request Headers 可以看到 `cftk`；代理同时设置该请求头，以上游收到的配置值为准。该值在本地开发前端可见，静态构建不注入。浏览器请求域名仍是 local；AI 总结仍沿用现有仿真代理。

此开关只在 **Windows 的开发服务器** 生效。关闭开关恢复原有 5173 / DQE Sim；macOS、Linux、静态构建与 `vite preview` 忽略该配置。Platform 不受影响。443 端口已占用时直接失败，不自动换端口。

这仅配置开发传输，不建立登录或换取身份的流程；现有运行配置中的 `X-Auth-Token`、`X-Operator-Id`、`X-Workspace-Id` 保持原接线，不能把默认仿真身份视为 gray 的有效用户身份。gray 若需要其他有效凭据，仍须由集成应用提供；新增 cftk 本身不证明真实鉴权成功。仅 Windows gray 开发代理设置 `secure: false`，以连接使用公司内部证书的服务；其他代理保持原配置。

页面场景与证据边界见 [Windows gray 开发环境](../../pages/README.md#windows-gray-开发环境)。该配置不进入页面文档，不改变页面协议或本地创作 Skill 的声明规则。

## 按能力查找与体验示例

首页提供六个能力主题：布局与内容组织、筛选与状态联动、表格与明细、查询与数据处理、导航与页面参数、导出与分享。能力主题可与 Dashboard／Report、用途、运行条件和关键词组合筛选。用途仍区分业务示例、功能演示与验收样例；能力主题允许一页多归属，目录不重复生成卡片。

卡片先说明操作与可观察结果，单独显示数据性质、运行条件与可体验范围。页面标题仍来自运行文档；目录使用独立的能力展示名，并兼容原文档标题搜索。新页面自动显示在“待归类”，已删除页面不生成入口。

打开页面后展开“体验与配置说明”，按步骤操作，再展开关键配置查看当前文档片段，或下载完整 JSON。关联入口连接来源与目标、主示例与变体、通用功能与业务应用；协议文档链接打开仓库 main。说明在试验场外框显示，不进入页面协议、正式运行时及导出内容。

### IOC 公共页头目录

首页的 **IOC 公共页头** 是独立目录，可通过 `/#group-ioc-header` 直达，也可在“验收样例”分类中找到。15个已完成场景按以下顺序呈现：

- 基础页头与状态安全：普通页头、密集与依赖、详情单月、无标题与离散月份。
- 业务筛选：封闭枚举、结构树与候选交集、详情私有筛选。
- 金额币种：金额单位、静态货币字段及导出一致性。
- 时间选择：日/月/ISO周、日期快捷范围、可信最新期、离散月份与时间模型。
- 跨页传值：从概览进入清单、详情；从来源页开始操作可提供目标页所需参数。

目录标题直接说明可执行的功能，摘要说明操作与可观察的结果；不在卡片中使用批次编号、验收术语或重复的集成边界。配置字段及技术边界保留在各页面的展开说明中。

B5仅显式传值，B6保持挂起。场景使用合成数据；具体配置、启动条件和边界仍在各页面说明中展示。页面资产与地址保持原样，IOC作战地图业务示例仍单独归类。

### 数据与启动

- 无需网关：`pnpm dev:playground`，如表格弹窗、PDF／PNG 导出、指标文字混排。
- 本地 DQE Sim：一起启动用 `pnpm dev:dqe`；5173 已有试验场时只运行 `pnpm sim:dqe`。仅支持相应夹具，不匹配查询会显式失败。
- 对应业务服务：首屏内嵌初始行可能可预览，动态查询仍需要匹配的数据网关、数据集与权限。
- Platform 页面搭建：试验场仅展示结构，拖拽、删除和撤销需进入 Platform 页面搭建工作台；试验场地址不是搭建入口。

完整入口、操作与证据边界见 [页面示例与验收场景](../../pages/README.md)。JSON 即时预览位于 `/preview`，支持粘贴完整页面文档，实时校验并渲染。

### 报告导出

推荐 `/pages/report-png-export`：页头以 `exportButtons` 配置 PDF／PNG、按钮名称、动态文件名和清晰度，点击直接下载。`/pages/report-pdf-export` 保留 `pdfExport` 的独立 PDF 示例；长图与无效倍率从关联入口进入。编码由引擎提供，开发态高级示例复用同一实现，不需要额外 Chromium／Poppler 编码服务。

配置、运行环境与接入边界统一见[报告导出接入](../../docs/report-export.md)。真实业务、门户和终端环境分别验收。

## 维护目录说明

[`page-catalog.json`](./page-catalog.json) 是开发工具目录元数据的唯一维护入口：

- `groups`：用途分组；`capabilities`：能力主题、使用问题及协议文档路由。
- 每页的 `displayTitle`／`summary`：目录展示名和“操作 → 结果 → 作用范围”说明；`tags` 保留可搜索术语。
- `capabilities`：能力主题 id；`environment`：数据性质、运行条件与体验范围。
- `guide.steps`／`boundary`：操作、预期与边界；`configPaths` 从当前页面提取实际配置，支持 `[]` 和对象 `*`。
- `guide.related`：关联页面 id；来源与目标、主示例与变体应相互连接。

页面 JSON 保持在根 `pages/` 中，可递归读取子目录；不为能力分类迁移文件或新增页面协议字段。新增／删除页面时同步目录，自动检查页面集合、配置路径、关联入口与协议文档路径，避免说明漂移。验收见 `tests/page-catalog.test.ts` 和 `tests/page-catalog-browser.mjs`。

旧应用名为 Canvas；目录和包名现为 `apps/playground`／`playground`。边界裁决见 [ADR-0075](../../docs/adr/0075-page-playground-as-development-tool.md)。
