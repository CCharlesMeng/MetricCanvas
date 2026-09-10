# #103 发布与异构集成应用执行记录

2026-09-09。状态：已启动，发布候选已核验；真实 registry 发布与真实集成应用接入尚未完成，#103 保持 OPEN。

后续安排：用户确认本机无法继续，迁移到公司内网后执行。续跑入口为 [公司内网续跑待办](../plan/wayfinder-103-intranet-resume.md)，包含环境输入、产物迁移/重新准备命令及终点验收清单。当前不再等待本机提供内网环境。

## 已完成的切片

- 按启动交接要求，以 `gh issue edit 103 --add-assignee @me` 作为本会话第一个写操作；指派给 `CCharlesMeng`。实读 #103 正文、评论与原生依赖：#97/#98/#100/#109 全部 CLOSED，#103 无评论。
- 读取集成应用契约与 ADR-0066/0068/0069/0071。四包锁步 `1.0.0-rc.1`，页面协议独立为 `6.0`；异构集成应用使用 embed 自包含 ESM 或 script/IIFE 公开挂载入口。
- 找到 #116 原始产物与机器证据 `/private/tmp/116-matrix`。验证源码树 `316d73f7ed0609702343e7d71db5ed156df4624c` 与当前 HEAD `a860213` 仅相差 `docs/reviews/2026-09-08-release-version.md`，产品与构建输入未改变。
- 选择当前 Svelte 5.56.6 矩阵的四个 `pnpm pack` tarball 作为发布候选，逐包核对名称、同版、非 private、发布依赖无 `workspace:`。逐包重算 SHA-512，与当时仓外消费者 `package-lock.json` 中实际安装的 integrity 一致。
- 候选原样复制到本仓忽略目录 `deliverables/103-release-1.0.0-rc.1/`，含四个 tarball、`release-manifest.json`、`SHA256SUMS`、既有 `compatibility-summary.json` 与本次 `page-validation.json`。未把并发文档、原型等工作区变更打进产物。
- 使用仓外已安装的候选 `@metriccanvas/page` 执行 `parsePage`，当前 `pages/` 的 11 份文档全部通过，`supportedVersions()` 为 `['6.0']`。此项为本次执行；完整矩阵与浏览器结果沿用 #116，不冒充本次重跑。

## 发布候选

具体 registry **待提供**；dist-tag 暂拟 `rc`，未修改任何 registry 状态。版本是否已占用、权限及连通性均未核实。

| 包 | tarball | 字节 | SHA-256 |
|---|---|---:|---|
| `@metriccanvas/page` | `metriccanvas-page-1.0.0-rc.1.tgz` | 125926 | `ee145084f70397a400b419f53fab9a1499f26849a44ca4c1a684698f320d3877` |
| `@metriccanvas/engine` | `metriccanvas-engine-1.0.0-rc.1.tgz` | 268949 | `83eae3768b459ddc2a4e3d51ccdf395d729cb7457b6e01dc31a7f7c50152d57f` |
| `@metriccanvas/metric-canvas` | `metriccanvas-metric-canvas-1.0.0-rc.1.tgz` | 8077 | `65f3d9c38a5724be3c37251e0d020a877ded65efa026f6d639e9e457cf6e9812` |
| `@metriccanvas/embed` | `metriccanvas-embed-1.0.0-rc.1.tgz` | 1362955 | `9d9581d492521418aa493195cf77152b83f65f5b06f8653ab11a5fe0a8ba4a1e` |

完整发布入口、依赖与 SHA-512 在本地 manifest 中。embed 两种运行文件为 `dist/metriccanvas-runtime.es.js` 与 `dist/metriccanvas-runtime.global.js`；经典脚本全局名 `MetricCanvas`。从 tarball 发布应使用这批已核验字节，不能临发布再从共享工作区重新打包。

## 外部输入核实

本仓和用户目录没有 `.npmrc`，检查的系统位置 `/opt/homebrew/etc/npmrc` 与 `/usr/local/etc/npmrc` 也不存在；当前进程未发现 npm registry/认证相关环境配置键。配置检查未输出任何凭据。仓内文档及已有调查报告未找到可用 registry 配置；Code 目录的有限文件清单未确认 cdi-portal 的 checkout，不能将 `IOC原型` 或其他邻接项目擅自认定为目标。

#95 最新正文已经明确「#103 的内网具体地址与真实集成应用入口仍需提供」。已向用户集中索取：

1. 内网 registry URL 与认证配置位置（不通过对话发送 token）。
2. 真实集成应用仓库路径/地址、运行环境入口及必要启动方式。
3. 若环境另有要求，给出四包版本与 dist-tag；当前候选为 `1.0.0-rc.1` / `rc`。

没有向默认公开 registry 发包，也未以本机测试消费者替代真实接入。尚无目标应用代码改动，实际集成胶水代码量未测得。

## 接续验收

取得外部输入后，先确认 registry 连通、身份与四包目标版本状态。已有版本不覆盖；若已存在，逐包对比 registry integrity 与候选，确认能否直接消费。只有明确新版本选择后才推进版本及中立契约同步。发布按 page → engine → metric-canvas → embed 顺序，核对每包版本、dist-tag、远端 integrity；部分发布失败须逐包记录，重试前先重新读取状态。

真实集成应用从该 registry 安装精确版本，由它的部署链路提供 embed JS 地址，再以公开 `mount` 接线；不使用 workspace 别名或 tarball overrides 证明 registry 安装成功。按目标项目既有规范实现接线，不先新建假定的 Vue/React 项目。

| 验收 | 已有基线（#116） | #103 仍须取得的真实证据 |
|---|---|---|
| 安装与渲染 | 四 tarball 仓外安装；ESM/IIFE 浏览器通过 | registry URL、版本/完整性、应用仓库及提交、JS 请求与真页面渲染 |
| 生命周期 | `embed.spec.ts` 更新、重复挂载保护、幂等销毁；`navigation.spec.ts` 省略接管恢复默认 | 完整输入替换、destroy 后重挂载、应用卸载及不同容器宽度 |
| 导航 | `navigation.spec.ts` 绝对/相对链接、三种绑定、复制/新标签、IOC 跨页与返回 | 部署基址下的链接与显式传参；实际接管策略及浏览器前进/后退 |
| 筛选与数据 | 示例 `navigation.html` 用 replaceState 同步 filter-change，不立即回灌 | 应用路由接线不产生 update 循环，明确 inline 或 HTTP 边界仿真范围 |
| 失败与恢复 | `version-error.spec.ts` 两格式版本失败、停止查询、更新恢复；数据错误分类既有回归 | 真实应用中的可行动版本错误、页面加载失败重试与相关数据失败恢复 |
| 创作隔离与成本 | 既有依赖图/实际产物隔离门禁通过 | 接线文件、胶水职责、代码量和浏览器实际版本 |

#116 两个 Svelte 版本分别 86 项浏览器测试通过，无失败/跳过/重试，Chrome 152.0.7977.76 / Edge 152.0.4191.66。该历史证据只证明已验证候选的能力，不构成真实集成应用验收。

页面选择以实际集成应用为准：`pages/ioc-project-overview.json` 等仓库真页面含明确标注的合成演示数据；真页面不等于真实生产数据。DQE 不可达时按 ADR-0069 使用已定义的 HTTP 边界仿真，不能为完成截图在运行组件内造成功响应。

完成真实终点后再按 issue tracker 约定发布结论、关闭 #103 并同步 #95。#105/#106/#107/#108 及平台静态化不由本次接管。
