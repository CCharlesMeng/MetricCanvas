# 本地预置页面 · 2026-10-12

按用户要求从 `pages/` 装入五份完整页面到本机开发页面资产服务。入口 `https://127.0.0.1:5174/manage`；启动 `pnpm dev:assets`。修改持久化到 `.scratch/platform-page-assets/store.json`，原始页面文件无修改。开发服务说明见 `apps/platform/scripts/README.md`。

`result.json` 记录脚本类型检查、目录/发布草稿筛选及 HTTP 新建/保存/过期修订冲突/持久化验证；临时验证资源已移除，保留五份预置页面。`all-previews.json` 为当前 Chrome 155 的五页实际预览：图表或明细行可见，无页面运行时错误或预览 alert。`management.png` 和 `tokens-preview.png` 保留实际画面。

这是独立于上一批 UI 的后续开发数据增量；root package.json 仅新增 dev:assets 启动命令。上一批兼容矩阵和 review-final 指纹对应其当时源码范围，不宣称它们覆盖此新脚本。没有调用真实 Java 服务、改页面协议或部署产物，也不将开发夹具当作真实提供方验收。
