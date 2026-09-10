# #103 公司内网续跑待办

状态：**待迁移到公司内网后执行，未完成**。2026-09-09 用户确认本机无法提供发布与真实集成环境，后续把仓库迁入公司内网继续。#103 保持 OPEN，不再要求当前机器补齐内网条件，不新建重复执行票。

## 迁移后给执行 agent 的指令

复制以下指令即可接续，无需依赖旧会话或 GitHub 在线访问：

> 阅读 `docs/plan/wayfinder-103-intranet-resume.md`，继续 #103。先检查当前仓库约定、源码版本和内网环境，复用已经完成的 #114–#116，不重开架构决策。按本文完成四包真实发布、真实异构集成应用接入和浏览器验收；发现必要实现缺口就修复。发布必须显式指定内网 registry，禁止覆盖已有版本。环境信息缺失时集中询问并继续独立可做的准备。GitHub 不可达时将进度和证据留在项目中，全部验收完成后标记“验收完成、待同步 issue”，不要因无法操作 GitHub 阻塞开发。

首次执行时补齐以下环境输入；认证通过公司的正常配置提供，不把 token 写进文档：

| 输入 | 内网填写 |
|---|---|
| npm 发布 registry URL（确认可写，不只是下载代理） | 待填写 |
| npm 依赖下载源与认证配置位置 | 待填写 |
| 真实集成应用仓库路径、目标分支 | 待填写 |
| 应用启动/构建命令与浏览器访问地址 | 待填写 |
| 应用中承载页面的路由、菜单或挂载位置 | 待填写 |
| 四包版本 / dist-tag | 候选 `1.0.0-rc.1` / `rc`，先检查占用 |
| 数据方式及端点/请求配置来源 | 仅内联页面，或 ADR-0069 的 HTTP 边界仿真；按实际选择 |

## 迁移材料与已有成果

- 携带本仓源码、锁文件、本文及 `docs/reviews/2026-09-09-103-release-integration.md`。通过 Git 迁移前须把这些新增文档纳入要迁移的提交；只 clone 旧远端不会带上尚未提交的本地文件。
- 四包发布代码基线为 `a860213`，页面协议 `6.0`，npm 版本 `1.0.0-rc.1`。#97/#98/#100/#109 和 #114–#116 已完成；迁移后按当前源码检查是否有新增改动，不能把旧证据直接套在新产品代码上。
- 已完成四包真实 tarball、仓外安装/构建、Svelte 5.56.6 与 5.29.0、Chrome 与 Edge 验证。具体证据与限制见上述执行记录及 `docs/reviews/2026-09-08-release-version.md`。
- **`deliverables/` 被 Git 忽略，`/private/tmp/116-matrix` 是原机器临时目录，均不会随 clone 迁移。** 如需沿用已验证的原始字节，另行携带整个 `deliverables/103-release-1.0.0-rc.1/`（四个包、manifest、校验清单与摘要），以及需要保留的原始验证日志。迁入后按清单复核摘要。
- 若只迁移源码，使用下面既有流程重新打包并验证，记录新的产物摘要与源码版本；新生成字节不能冒用旧 tarball 摘要。依赖安装要求内网源提供锁文件所需依赖；浏览器验证还需要本机 Chrome/Edge。旧机器 node_modules 不作为跨系统安装材料。

## 产物准备命令

以下为 Bash 命令，从仓库根目录执行。仅安装、校验和打包，**不会发布**。先按内网规范配置下载源与认证。原记录 pnpm 为 11.13.0；Node 与包管理器还应满足当前项目及依赖的 engines 要求。

```bash
set -euo pipefail
pnpm install --frozen-lockfile
pnpm validate
pnpm authoring:contracts:check
pnpm packages:check

# 固定当前源码，避免将正在编辑的产品代码作为发布输入。
git diff --exit-code -- packages tools/package-build package.json pnpm-lock.yaml pnpm-workspace.yaml
git diff --cached --exit-code -- packages tools/package-build package.json pnpm-lock.yaml pnpm-workspace.yaml

MC_RELEASE_DIR="$(pwd)/deliverables/103-intranet-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$MC_RELEASE_DIR"
git rev-parse HEAD > "$MC_RELEASE_DIR/source-commit.txt"
node --version > "$MC_RELEASE_DIR/node-version.txt"
pnpm --version > "$MC_RELEASE_DIR/pnpm-version.txt"
for MC_PACKAGE in page engine metric-canvas embed; do
  pnpm --dir "packages/$MC_PACKAGE" pack --out "$MC_RELEASE_DIR/$MC_PACKAGE.tgz"
done
```

`pnpm pack` 的 prepack 会构建各包，并把发布入口与 workspace 依赖写成可发布形状；不要用 `npm pack` 打包源码目录。源码有变更时先形成可追溯的提交，检查相关未跟踪文件，再从固定版本准备；上面的 diff 检查不替代工作区完整性检查。

`pnpm packages:check` 检查真实打包入口、声明、文件范围和组件编译，但它的临时包会删除。执行 agent 须对最终保留的四个包核实版本、发布 manifest、文件范围与摘要，并留下清单。构建输入或工具链有变化时按风险运行既有兼容性门禁：`pnpm compatibility:check` 的具体环境要求见 `tools/package-build/README.md`。未变化的既有能力不重复实现。

## 内网执行清单

- [ ] **确认发布目标。** 显式指定 registry，检查连通、认证/权限、四包目标版本及 dist-tag。网络/认证错误不等于版本不存在。版本已存在时先比对内容与完整性；相同可复用，不同则确定新的锁步版本并同步产品中立契约，绝不覆盖。
- [ ] **发布最终核验的 tarball。** 顺序 page → engine → metric-canvas → embed；使用显式 registry、版本和标签，逐包记录结果、远端 integrity 与 dist-tag。重试前读取状态，避免部分成功后重复发布。不从并发工作区临时重建另一批字节发布。
- [ ] **真实应用安装。** 在确定的集成应用安装精确发布版本，记录锁文件来源；用其正常部署链路提供 embed 的 ESM 或 IIFE JS 地址。使用公开 `mount` / `update` / `destroy`，不加仓库源码别名，不依赖内部 DOM，不配置引擎字体/主题。
- [ ] **真实页面渲染。** 加载 `pages/` 中一份页面，记录应用路径、部署环境、实际 JS URL、页面名称和浏览器版本。IOC 页面适合看板及跨页验收；其合成演示数据不能记作真实业务数据。仅内联数据不要求数据网关；需要维度候选等能力时按实际输入提供。
- [ ] **生命周期与宽度。** 验证完整输入替换、省略可选项不沿用、销毁/重挂载/应用卸载，以及不同容器宽度。看板使用应用交出的全部内容宽度，保持创作与渲染依赖隔离。
- [ ] **导航与筛选。** 验证 6.0 绝对/相对 URL、复制/新标签、行字段/页面参数/指定筛选值传参、必要的导航接管与返回。filter-change 可同步 URL，同次事件不原样回灌 update；真正切页或前进后退传完整输入。
- [ ] **失败与恢复。** 不支持的 schemaVersion 显示可行动错误并停止渲染/取数，更新合法文档可恢复；页面获取失败可重试。选择动态数据时再覆盖相应数据失败路径，明确真实 DQE 或边界仿真的证据范围。
- [ ] **留证与收口。** 记录集成文件、胶水职责与实际代码量、应用提交、测试结果、浏览器表现及剩余限制。真实发布和真实应用验收均完成才关闭 #103，并同步 #95；无法访问 GitHub 时先在本文记录完成证据与待同步事项。

这份清单只接续引擎发布与集成应用接入。平台纯静态部署和 #105/#106/#107/#108 仍走各自工作线；新建最小 Vue/React 示例可用于诊断，不能替代真实集成应用终点。

## 内网执行记录（迁移后填写）

- 执行日期、源码提交与工具链：待执行。
- 发布 registry、版本、dist-tag 与产物摘要：待执行；内网敏感地址只保留在公司允许的位置。
- 真实集成应用、分支/提交、接线文件和代码量：待执行。
- 浏览器版本、测试结果与证据位置：待执行。
- 剩余事项：迁移并提供上表环境输入。
- GitHub 同步状态：#103 OPEN；本次仅在项目中留下续跑待办。
