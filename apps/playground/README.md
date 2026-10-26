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
PLAYGROUND_CLOUDIOC_COOKIE=""
```

先在同一浏览器中登录 `https://gray.cloudioc.huawei.com`，从开发者工具的 Application → Local Storage 中复制 `cftk` 的值，替换上面的占位内容。配置值不包含示例占位文字；不要提交真实凭据。更新或重新登录后，重新复制并重启页面试验场。缺少 cftk 时开启此模式会明确拒绝启动。

gray 需要登录 Cookie 时，在开发者工具 Network 中找到一次成功的服务请求，将 Request Headers 中完整的 `Cookie` 值复制到 `PLAYGROUND_CLOUDIOC_COOKIE`，例如 `"session=example; route=example"`（不含 `Cookie:` 前缀）。该项可选：留空时保留浏览器原有 Cookie；填写时覆盖该代理请求的整个 Cookie 头，不与本地域 Cookie 拼接。Cookie 只由 Vite 代理发往 gray，浏览器 Network 中看到的是发给本地服务的请求，不能据此检查上游配置 Cookie；它不注入浏览器脚本或静态构建。配置包含换行或非法 HTTP 头字符时拒绝启动，错误只显示配置键。

Windows 首次使用还需：

1. 在 `C:\Windows\System32\drivers\etc\hosts` 添加 `127.0.0.1 local.cloudioc.huawei.com`。
2. 确保 443 端口可用，并允许 Node 访问 gray 所需的公司网络；系统策略要求时使用相应权限运行。
3. 运行 `pnpm dev:playground`，访问 `https://local.cloudioc.huawei.com:443`。开发服务器使用包含该域名的自签名证书，首次访问需处理浏览器的证书提示。此模式不需要启动 DQE Sim。

浏览器仍请求本地 `/rest/cdi/cdinl2databuilderservice/v1/dsl/execute`，开发代理将请求转发到 `https://gray.cloudioc.huawei.com` 的相同路径。Windows 开发模式将配置的 cftk 注入页面试验场的请求实现，浏览器 Network 的 Request Headers 可以看到 `cftk`；代理同时设置该请求头，以上游收到的配置值为准。该值在本地开发前端可见，静态构建不注入。浏览器请求域名仍是 local；AI 总结仍沿用现有仿真代理。

此开关只在 **Windows 的开发服务器** 生效。关闭开关恢复原有 5173 / DQE Sim；macOS、Linux、静态构建与 `vite preview` 忽略该配置。Platform 使用[自己的同类配置](../platform/README.md)，两个应用不互读凭据；它们的 gray 模式使用同一域名和 443 端口，须择一启动。443 端口已占用时直接失败，不自动换端口。

这仅配置开发传输，不建立登录或换取身份的流程；现有运行配置中的 `X-Auth-Token`、`X-Operator-Id`、`X-Workspace-Id` 保持原接线，不能把默认仿真身份视为 gray 的有效用户身份。gray 若需要其他有效凭据，仍须由集成应用提供；配置 cftk 与 Cookie 本身不证明真实鉴权成功。仅 Windows gray 开发代理设置 `secure: false`，以连接使用公司内部证书的服务；其他代理保持原配置。

页面场景与证据边界见 [Windows gray 开发环境](../../pages/README.md#windows-gray-开发环境)。该配置不进入页面文档，不改变页面协议或本地创作 Skill 的声明规则。

## 查找与预览页面

首页按「组件、数据与联动、布局」查找推荐场景。组件目录由产品能力目录生成，每个类型都有固定入口 `/catalog/components/<type>`。数据与联动的六个阶段为定义取数、条件驱动查询、数据关联与组合、交互联动与继续查数、查询结果与范围、跨页延续与输出；入口为 `/catalog/data/<topic>`。布局入口为 `/catalog/layouts/<topic>`。

数据与联动先按实际页面布局区分 Dashboard／Report，再按六个阶段选择可见功能入口，例如时间范围筛选、层级维度筛选、按键补列和跨页传值。功能只引用直接相关的演示，不整组展示某场景的全部变体；功能只有一个演示时不增加下拉层级。左侧数量是当前布局形态下的功能数，数据入口的搜索返回当前形态的功能结果。

同一场景跨目录复用。组件与布局目录保留能力场景和演示变体选择；数据入口选定功能后选择功能演示，即可就地操作，下面显示目录 README 中的操作与预期、实际文档中的数据来源和当前组件配置。搜索覆盖组件名称、产品别名、用途和原页面 id，结果显示主要归属路径。临时评测不进入默认推荐搜索。

跨页流程在原演示区域继续，所选变体、说明和配置同步到目标页，实际传入条件单独封装在开发工具的 `exampleSearch` 参数中；复制目录链接或独立打开都保留这些条件。运行页面自身的参数与筛选不被目录参数覆盖。

全部实际文件移至 `/files`，保留文件夹、组件、布局、数据来源和关键词组合过滤；`/files?scope=business` 查业务示例，`/files?scope=temporary` 查临时评测。普通页面自动发现及 `/pages/<id>` 地址不依赖推荐场景登记。场景索引位于 `scenarios/`，只描述教学组织，不定义页面协议。

文件目录记住当前标签页的查找条件与滚动位置。推荐目录的主题、场景、变体与搜索保存在自己的 URL；数据入口另用 `layout=dashboard|report` 和 `feature=<功能 id>` 保存布局形态与功能。旧场景链接按实际页面形态定位可用功能；跨页进入不同形态的目标时跟随实际目标，保留显式传值。点击“页面目录”返回最近目录，浏览器前进／后退恢复历史。会话存储禁用时仍支持当前应用内返回。

打开原页面仍可查看和下载实际 JSON。在推荐场景点击「在此基础上试改」，直接编辑当前运行文档并校验，使用该场景明确绑定的网关和输入，草稿不会写回文件。特殊演示的外层界面组合与跨页流程使用交互演示；试改只渲染正式页面文档。README 内容作为文字和代码块展示，不执行 HTML，也不从文字推断查询配置。

### IOC 公共页头

组件目录提供“IOC 页头”入口 `/catalog/components/iocHeader`，默认展示 `ioc-header-demo` 经营概览；与数据入口复用原场景，不复制页面。全部文件的组件类型筛选也支持“IOC 页头”，只识别文档中显式声明的根级 `iocHeader`；配置区展示对应根声明，正文组件协议保持原有类型。

现有专题入口 `/ioc-header` 与能力一览继续保留。15 个专题场景由 `pages/capabilities/ioc-header/scenarios/` 的实际页面发现，标题和说明取自页面文档；操作步骤和接入边界见同目录 README.md。`?topic=time&scene=time-modes` 可直达场景，`?view=capabilities` 打开能力索引。

预览适配器仅在对应演示目录接入合成数据与候选；IOC 业务确认演示位于 `ioc-header/business/`，选择回执演示位于 `ioc-header/selection/`。这不影响普通业务文件夹的自动发现，真实接入仍需网关、授权候选与可信期间事实。

### 数据与启动

- 无需额外服务：`pnpm dev:playground`，如表格弹窗、PDF／PNG 导出、指标文字混排。
- 本地 DQE Sim：一起启动用 `pnpm dev:dqe`；5173 已有试验场时只运行 `pnpm sim:dqe`。仅支持相应夹具，不匹配查询会显式失败。
- 对应业务服务：首屏内嵌初始行可能可预览，动态查询仍需要匹配的数据网关、数据集与权限。
- Platform 页面搭建：试验场仅展示结构，拖拽、删除和撤销需进入 Platform 页面搭建工作台；试验场地址不是搭建入口。

完整入口、操作与证据边界见 [页面示例与验收场景](../../pages/README.md)。JSON 即时预览位于 `/preview`，支持粘贴完整页面文档，实时校验并渲染。

### 报告导出

推荐 `/pages/report-png-export`：页头以 `exportButtons` 配置 PDF／PNG、按钮名称、动态文件名和清晰度，点击直接下载。`/pages/report-pdf-export` 保留 `pdfExport` 的独立 PDF 示例；长图与无效倍率从关联入口进入。编码由引擎提供，开发态高级示例复用同一实现，不需要额外 Chromium／Poppler 编码服务。

配置、运行环境与接入边界统一见[报告导出接入](../../docs/report-export.md)。真实业务、门户和终端环境分别验收。

## 页面目录维护

页面发现、文件夹层级和分组直接来自 `pages/**/*.json`；标题和说明读取页面文档，布局形态与正式渲染使用相同规则。组件类型读取产品组件目录及完整组件树，数据来源只区分内联／静态、包含查询与文档无效。没有逐页配置、别名、标签、用途或运行环境登记表。

新增业务只需在 `pages/business/dashboard/<业务>/` 或 `pages/business/report/<业务>/` 保存合法 JSON，文件名与 id 一致且全树唯一。目录直接展示实际路径，中文目录名原样显示。空目录不展示，根目录文件归入“根目录”。运行服务时新增、修改与删除页面自动刷新；静态部署重新构建。

目录支持文件夹、布局、实际组件类型、数据来源与关键词组合查找。返回目录、刷新和前进后退保留对应查找状态；已删除目录回退为全部页面。详情页提供完整运行输入 JSON 与下载。

体验步骤、启动条件、真实服务限制与关联页面在页面所在目录的 README.md 维护，文档不参与渲染。现有说明已迁到各主题目录；入口见 [页面目录](../../pages/README.md)。无需给普通业务页面添加其他配置文件，也不通过页面名猜测服务环境。

验收见 `tests/page-directory.test.ts`、`tests/directory-navigation-state.test.ts`、`tests/page-directory-browser.mjs`、`tests/page-folders-browser.mjs` 和 `tests/directory-navigation-browser.mjs`。

旧应用名为 Canvas；目录和包名现为 `apps/playground`／`playground`。边界裁决见 [ADR-0075](../../docs/adr/0075-page-playground-as-development-tool.md)。
