# 直接注册宿主的部署交付收口

日期：2026-09-29。延续 ADR-0093/0094，不新增部署契约版本。

## 目标和事实

宿主从 moduleInfoList 注册应用，并把每个 app.props 整体替换为 appList/roleList。原始平台包需要标准配置；默认交付对象应为包含内部 Adapter 的完整子应用包。主应用无需增加 readConfig 等 props，也无需另写加载器。

## 执行计划

- [x] 发布工具：归档附带独立可执行的 pack-deployment.mjs，组合平台和外部 Adapter，生成新部署目录、tar.gz 与 SHA-256；保留两方摘要，拒绝覆盖已有输出。
- [x] 正式接入说明：优先说明直接注册模式，区分路由前缀和资源 entry，说明 afterMount SDK 时序、身份配置和静态托管责任。
- [x] 确定性验收：仅 appList/roleList 的实际覆盖行为、当前凭据现读、归档解包一致性、下载包独立执行和输出保护。
- [x] 真实产物：构建并打包平台，用合成 Adapter 检查完整交付链；合成接线不作为可部署到真实门户的 Adapter。
- [ ] 内部接线与门户验收：待内部项目路径、真实模块注册记录、身份读取源和角色切换行为后实施。

## 内部部署要求

内部 Adapter 固定配置与 activeRule 对齐的 routeBase，不从浏览器深链接猜测；读取真实 Java/DQE 地址、凭据、用户和工作空间，不把凭据写进静态包。身份原地变化需真实订阅；只有保证整页重载才选择 reload。平台 mount 不等待宿主 afterMount 才初始化的共享 SDK。菜单授权数据不能替代服务端身份与鉴权。

入口资源相对 entry 解析。业务深链接返回宿主 HTML，缺失静态资源返回 404；发布和回滚以完整不可变目录为单位。实际 loader 补丁、CORS/CSP、SDK 和 Java/DQE/Relay 验收由内部部署负责。

## 验证记录

2026-09-29 本地验证：

- `pnpm exec vitest run apps/platform/tests/microfrontend/compose-deployment.test.ts apps/platform/tests/microfrontend/deployment.test.ts`：2 个文件、12 项通过。首次发现 macOS 临时目录符号链接导致 CLI 入口比较失败，compose/pack 均改为比较真实路径后通过。
- `pnpm --filter platform check`：通过，Svelte 零错误、零警告，测试 TypeScript 检查通过。
- `pnpm --filter platform pack:microfrontend`：通过，生成 HTML、UMD、CSS、契约和两个独立部署脚本。
- 真实平台 tar.gz 解压到仓库外，调用包内 pack-deployment.mjs 和合成 Adapter，再以 shasum 校验归档、解包核对全部 7 个文件摘要；原平台 release.json 与 JS/CSS 未改变。临时合成部署目录已清理，不交付为真实门户包。
- 本次上游归档 SHA-256：`ff98a27d5d1c7598e9ab841dbce46a751f517c43ffce8fd4166e1ae51dbaf75c`。基线 `6954c77d035d2c10548e51ba6e8b1e1c6412be12`，`sourceDirty: true`；包含工作区其他未提交改动，不是干净提交的正式发布。

未执行浏览器测试、CI、推送、真实门户、真实 Java/DQE/Relay/SDK 验收。内部接线仍缺项目路径与实际身份/配置来源；已向用户请求资料。下一步在内部项目实现真实 Adapter，再用本文命令交付完整包并完成门户验收。

## 提交前隔离验证

2026-09-29 用户要求提交并推送。远端 main 已前进到 `f9fbd4b1771a099334d9594059c0929d6f429329`，其图表改动与原工作区未提交文件重叠，因此从该远端基线创建独立工作树，只迁入本次 9 个文件，保留原工作区。隔离工作树重新执行上述 12 项测试、platform check 和 pack:microfrontend，全部通过；不依赖原工作区未提交的 IOC 改动。此阶段生成归档 SHA-256 为 `f0a8bc5cf62eaeef8ead97d0c49b2f778c47b3cce415545af087c25f97f5ab0f`，构建发生在提交前，仍记录 sourceDirty。推送和 CI 结论以远端提交及 Actions 为准，不由本地验证推定。
