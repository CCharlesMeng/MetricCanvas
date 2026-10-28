# Platform 本地调测

运行 `pnpm dev:platform`。Windows、macOS/Linux 均使用 `https://localhost:5174`，无需配置特殊域名或 hosts。可运行 `pnpm --filter platform dev --port 5188` 指定其他端口；端口被占用时启动失败。服务前缀 `/rest/cdi/cdinl2databuilderservice/` 默认代理到 `https://ioc.cloudbu.huawei.com`。

## 正常 Platform 的本地体验

运行 `pnpm dev:assets` 启动已有本机页面资产服务，再运行 `pnpm --filter platform dev:local`，打开 `http://localhost:5175/manage`。与默认开发服务共用 index.html、standalone/main.ts 和正常 `/manage`、`/create` 路由；没有验收横条、悬浮日志或合成 Chat。

此模式只把页面资产接口代理到 127.0.0.1:8080，修改持久保存在 `.scratch/platform-page-assets/store.json`，原 pages 文件不改写。保留默认 5174 HTTPS 服务和 CloudIOC 代理行为。查询演示需另启动 DQE Sim；本地数据不证明真实 Java/DQE 接入。

管理列表只保留“基本信息”和“可视化编辑”两个入口。可直接进入画布，调整组件和布局、修改页面标题、保存草稿，或从“基本信息”进入独立表单。默认本地资产服务未声明可访问路径维护，路径字段如实禁用。未配置真实云宝 SDK 时，Chat 显示未接通，不用替身冒充真实发送。

## Windows 连接 gray CloudIOC

在已被 Git 忽略的 `apps/platform/.env.local` 中追加以下配置，或从 `.env.example` 复制后填写：

```dotenv
PLATFORM_CLOUDIOC=true
PLATFORM_CLOUDIOC_CFTK="粘贴 gray 站点 localStorage.cftk 的原始值"
PLATFORM_CLOUDIOC_COOKIE=""
```

登录 `https://gray.cloudioc.huawei.com` 后，从开发者工具 Application → Local Storage 复制 `cftk`。需要登录 Cookie 时，从 Network 中一次成功请求的 Request Headers 复制完整 `Cookie` 值，填入 `PLATFORM_CLOUDIOC_COOKIE`，不含 `Cookie:` 前缀。Cookie 可选，留空保留浏览器 Cookie；填写时覆盖整个上游 Cookie 头。凭据更新后重启服务，不提交真实值。

1. 确保 Node 可访问 gray，无需修改 hosts。
2. 运行 `pnpm dev:platform`，访问 `https://localhost:5174`（或 `--port` 指定的端口），处理开发自签名证书信任。
3. 进入 `/manage` 查看页面目录，或在工作台加载业务页面；页面资产与 DQE 请求均以同源路径转发至 gray，路径、查询参数与请求体保持原样。

该模式与 Playground 共用代理策略：`changeOrigin: true`、`secure: false`，配置的 CFTK 和 Cookie 由 Vite 发往 gray。它们不注入 Platform 浏览器脚本；浏览器 Network 展示发往本地的请求，无法显示代理追加的头。`/api/ai/conversations/` 仍代理到本机 DQE Sim，不附加这些凭据。服务端 401 或查询错误沿现有诊断呈现，不回退到仿真数据。

该配置只在 Windows `vite dev` 生效，关闭开关恢复原 IOC 代理；macOS/Linux、构建（含微前端与 debug 包）及 preview 忽略。启用时 CFTK 必填，Cookie 或 CFTK 含非法 HTTP 头字符时启动失败，错误只显示配置键。两个应用分别读取各自 `.env.local`；Platform 使用 localhost 普通端口，Playground 的 gray 模式仍使用原有域名和 443，可以同时启动。

请求须使用上述同源服务前缀，绝对 URL 会绕过 Vite。此配置不改变集成门户运行配置、身份或页面协议；默认 `local-dev` 身份也不代表 gray 的有效用户。配置测试与本地上游替身仅验证转发，真实 Windows、证书及 gray 鉴权另行验收。Playground 的页面场景和证据边界见 [pages/README.md](../../pages/README.md#windows-gray-开发环境)。
