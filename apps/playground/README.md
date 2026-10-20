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

目录记住当前标签页的关键词、能力主题、布局形态、用途、运行条件与滚动位置。进入详情或相关示例后，点击顶部“页面目录”恢复最近一次目录；浏览器前进／后退分别恢复对应历史记录的条件与位置，刷新也保留目录条件。点击“重置筛选”清空全部条件。新会话默认展示全部页面；浏览器禁用会话存储时仍支持当前应用内返回，刷新后不保证保留。该状态属于开发工具，不写入页面 JSON 或业务页面 URL。

卡片先说明操作与可观察结果，单独显示数据性质、运行条件与可体验范围。页面标题仍来自运行文档；目录使用独立的能力展示名，并兼容原文档标题搜索。新页面自动显示在“待归类”，已删除页面不生成入口。

打开页面后展开“体验与配置说明”，按步骤操作，再展开关键配置查看当前文档片段，或下载完整 JSON。关联入口连接来源与目标、主示例与变体、通用功能与业务应用；协议文档链接打开仓库 main。说明在试验场外框显示，不进入页面协议、正式运行时及导出内容。

### IOC 公共页头

首页通过“你想实现什么？→ IOC 公共页头”筛选，可与“功能演示”、布局形态、运行条件和关键词组合。`/#group-ioc-header` 保留目录锚点，首页仅展示一个集合入口；页面数量仍按匹配的场景统计，避免把场景数当作入口卡片数。

统一入口为 `/ioc-header`，提供两种查看方式：

- **交互演示**：先看期间、币种、区域的常用组合，再选择时间、业务筛选、币种金额、跨页传值四个专题。专题内切换具体场景，复用原有 15 个页面声明和产品运行时；导航专题从概览串起清单及详情。可在新标签页独立体验并查看完整 JSON。
- **能力一览**：按基础呈现及四个专题列出当前能力，支持关键词与规划编号搜索；每项给出用途、适用条件、状态和演示链接。32 项使用能力与独立列出的未实施项共同追溯主计划全部 88 个编号；业务接入不等于真实业务已验收。

`?topic=time&scene=time-modes` 可直达专题场景，`?view=capabilities` 打开能力一览。不存在或不兼容的专题/场景组合回到合法场景；选择写入 URL，浏览器前进、后退和刷新可重开当前入口。此行为是开发工具导航，不提供业务来源视图恢复。

本组通过目录 `externalInputs: "ioc-header"` 显式注入**内置合成数据**、候选和固定期间事实，无需额外服务。只有这组注册页面使用该输入；查询仍通过产品 DQE 适配器处理，未配置查询或候选明确拒绝，不回退真实网络。页面 JSON 下载不包含这些开发工具输入；真实集成仍需数据网关、授权候选和可信期间事实。默认最新数据期为演示固定的 2026-10、完整期为 2026-09。

原始页面地址与资产保留，IOC 作战地图业务示例单独归类。B5 仅跨页传值，视图恢复不在本轮范围，B6 可选操作继续挂起。实现仅调整试验场导航和合成输入，不增加页面协议能力或改变 local-authoring 的生成契约。

验收命令：`pnpm test apps/playground/tests`、`pnpm --filter playground check`、`pnpm build:playground`；启动后运行 `PLAYGROUND_BASE_URL=http://127.0.0.1:5173 node apps/playground/tests/ioc-header-showcase-browser.mjs`。浏览器检查筛选组合、15 个场景、能力检索、真实跨页流程、390px 布局和零外部查询请求。

### 数据与启动

- 无需额外服务：`pnpm dev:playground`，如表格弹窗、PDF／PNG 导出、指标文字混排。
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
