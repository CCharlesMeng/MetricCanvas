# Platform 本地调测

运行 `pnpm dev:platform`。默认 macOS/Linux 使用 `https://127.0.0.1:5174`，Windows 使用 `https://local.cloudbu.huawei.com:443`；服务前缀 `/rest/cdi/cdinl2databuilderservice/` 代理到 `https://ioc.cloudbu.huawei.com`。

## Windows 连接 gray CloudIOC

在已被 Git 忽略的 `apps/platform/.env.local` 中追加以下配置，或从 `.env.example` 复制后填写：

```dotenv
PLATFORM_CLOUDIOC=true
PLATFORM_CLOUDIOC_CFTK="粘贴 gray 站点 localStorage.cftk 的原始值"
PLATFORM_CLOUDIOC_COOKIE=""
```

登录 `https://gray.cloudioc.huawei.com` 后，从开发者工具 Application → Local Storage 复制 `cftk`。需要登录 Cookie 时，从 Network 中一次成功请求的 Request Headers 复制完整 `Cookie` 值，填入 `PLATFORM_CLOUDIOC_COOKIE`，不含 `Cookie:` 前缀。Cookie 可选，留空保留浏览器 Cookie；填写时覆盖整个上游 Cookie 头。凭据更新后重启服务，不提交真实值。

1. Windows hosts 添加 `127.0.0.1 local.cloudioc.huawei.com`，确保 443 空闲且 Node 可访问 gray。
2. 运行 `pnpm dev:platform`，访问 `https://local.cloudioc.huawei.com:443`，处理开发自签名证书信任。
3. 进入 `/manage` 查看页面目录，或在工作台加载业务页面；页面资产与 DQE 请求均以同源路径转发至 gray，路径、查询参数与请求体保持原样。

该模式与 Playground 共用代理策略：`changeOrigin: true`、`secure: false`，配置的 CFTK 和 Cookie 由 Vite 发往 gray。它们不注入 Platform 浏览器脚本；浏览器 Network 展示发往本地的请求，无法显示代理追加的头。`/api/ai/conversations/` 仍代理到本机 DQE Sim，不附加这些凭据。服务端 401 或查询错误沿现有诊断呈现，不回退到仿真数据。

该配置只在 Windows `vite dev` 生效，关闭开关恢复原 IOC 代理；macOS/Linux、构建（含微前端与 debug 包）及 preview 忽略。启用时 CFTK 必填，Cookie 或 CFTK 含非法 HTTP 头字符时启动失败，错误只显示配置键。两个应用分别读取各自 `.env.local`，两端 gray 模式均占用同一域名和 443，须择一启动。

请求须使用上述同源服务前缀，绝对 URL 会绕过 Vite。此配置不改变集成门户运行配置、身份或页面协议；默认 `local-dev` 身份也不代表 gray 的有效用户。配置测试与本地上游替身仅验证转发，真实 Windows、证书及 gray 鉴权另行验收。Playground 的页面场景和证据边界见 [pages/README.md](../../pages/README.md#windows-gray-开发环境)。
