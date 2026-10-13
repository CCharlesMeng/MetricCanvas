# 平台 UI 与管理实施证据 · 2026-10-12

本批 W0–W6 前端代码已实施；验收仍部分完成。两份独立聚合摘要和逐声明账本位于 `docs/plan/platform-ui-management/{ui-components,platform-management}/`，它们是判定真源。本目录保留实际输出，日志使用 `.txt` 避免仓库的通用 `*.log` 忽略规则。

- `compatibility/summary.json`：验收树 b6c855feb90adb47816c384817ea36faeebb91f9 的仓外当前/最低 Svelte，产品 Chrome 每版 96 项通过，完整浏览器矩阵为 false。
- `compatibility/manifest.json`：两版源码每版 1772 通过、4 跳过，UI-only 每版 20 项通过，五包真实 tarball 摘要；UI-only 不可达页面协议、引擎或 ECharts。
- `compatibility/final-input-comparison.json`：543 个包/构建/公开面/CI 输入与验收树逐 Git blob 对照，无差异。
- `logs/`：最新 UI check/Chrome 20 项、平台两版 check、Chrome HTTP 工作台旅程、生产微前端 build/fixture、契约与 Bundle 检查；最后新增 manualSave 两项由两版语言套件 55/55 和测试类型检查验证，未宣称最终树全量重跑。
- `browser-result.json`、三张平台 PNG：真实当前 Chrome 155.0.8059.39，1440/390 管理目录、同页阅读、本地保护、明确保存、异步目录滚动/焦点、unknown 保存禁用及导航/刷新不重发。仅 HTTP fixture，写入 2 次（第 2 次已应用但回执丢失）。网络只记录鉴权头名称，无凭据。
- `ui-boundaries/`：390×700，普通根与 ShadowRoot 的长文案、空、selected、键盘焦点、Select/Dialog 浮层原始几何与截图。冻结的 UI 7 项、平台 8 项还原报告保留在各 Story 的 evidence 中。

实际 Edge 155.0.4283.45 从 Microsoft 官方包解压并验证摘要/签名，在本机静态页面可启动，动画帧、截图及点击稳定性挂起；因此 Edge 未通过。生产 qiankun 2.10.16 fixture 使用 bundled Chromium 151.0.7922.34，与当前 Chrome 记录分开。

未通过或未运行：完整源站逐状态像素对照、若干完整 F3 S3 组合、Edge、远端 CI、实际 Java/Relay/身份/门户及 W7 高级生命周期。单测、契约 fixture、源码主题资源和本机浏览器均不替代这些证据。未提交、推送、发布或部署；前置 43 个过程文件仍在带说明的 stash。
