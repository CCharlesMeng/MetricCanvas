# 云宝创作流程：MC 侧实施验收

日期：2026-10-24。独立工作树 `/Users/moon/.codex/worktrees/agent-authoring-flow/DataDashboard`，基于 `abf35e983fa57e9cb9ef0f521a1d4de6d04a6325`。原工作区的并行修改未搬入、未覆盖。本记录为提交前的本地验收；最终交付提交与远端 CI 以交付回执为准，不声称生产或内网部署完成。

## 本批行为与对应产物

| 能力 | 实现与行为证据 | 文档与知识同步 |
|---|---|---|
| MC / 云宝聚合 | 无仓内依赖的 DialogueAgentPort、mount context；既有单参数 dialogue 兼容 | ADR-0118、pangu-agent-authoring.md、dialogue/README |
| 前端最新工作副本 | 输入收齐、全文/hash、执行锁；未保存修改不触发额外远端保存或 latest 查询 | PAGE-METADATA、page.md；从真源生成 local-authoring / MC 内容 |
| 双身份 URL | 页面/会话独立；缺失会话新建、指定会话恢复；删会话保留页面；首次生成回填 page | pages/platform/README 与同一 flow-page.json |
| 标题直接接口 | 仅更新 meta.title，回执合入当前副本，其他未保存组件与布局保留 | PageInfoPort、标题基线回归与实际浏览器 |
| 管理直调 | 独立表单修改标题/描述/路径；目录仅基本信息与可视化编辑，无 Chat；错误保留输入 | 共用 PageInfoForm / 验证器；实际浏览器 |
| 旧接入兼容 | mount-only 和 Relay v1 保持原行为；注入 agent 才启用新模式 | 独立契约打包及仓外 TypeScript 消费检查 |

页面协议版本保持 6.58，不将会话、锁或管理路径塞入页面参数。`flow-page.json` 显式 Dashboard，实际 MC 夹具直接读取这份完整 JSON；Playground 展示同一内容，完整创作行为由 Platform 验证。

## 浏览器验收

入口：`pnpm --filter platform dev:agent-flow` → `http://127.0.0.1:5178/?pageId=flow-page`。真实 MC 界面、合成服务；没有连接真实云宝、Java、DQE、Relay 或门户。

- 手工修改组件标题，再直接修改左上角页面标题；对话输入同时包含两个最新标题。infoWrites=1，sendCount=1，assetWrites=0；现有组件通知更新画布，无二次应用界面。见 [截图](latest-working-copy.png)。
- 创建 → 发布 → 手工修改 → 确认保存，使用同一 sessionId；lastIntent 先为 publish，后为 confirm-save；sendCount=3，MC 直接整页写入计数为 0。见 [截图](create-publish-confirm.png)。发布链接生成与确认 UI 由真实云宝/现有组件提供，本夹具不伪造其接入成功。
- 删 sessionId 后获得另一会话，page/resource 与画布保留；仅会话时空画布、无任何 ID 时自动新建会话；生成初版后 URL 补上 page/resource，原会话保留。
- 暂停创作轮次时，标题和检查器禁用；重复发送不增加计数；管理导航及删除会话参数被阻止。完成后恢复，见 [截图](execution-lock.png)。
- 暂停云宝会话准备时页面已可预览；指定会话 broken 恢复失败时页面仍展示。见 [准备期间](page-before-session.png)、[失败仍读页面](session-failed-page-visible.png)。
- 管理表格直接保存三字段，Agent 计数不变；独立表单拒绝错误 pageId 路径并保留输入，正确保存回目录。返回同一工作台会读取新修订，手动组件内容保留；同时修复重复激活导致的恢复提示。见 [表格](management-inline.png)、[表单](management-form.png)。
- Playground：`pnpm --filter playground exec vite --host 127.0.0.1 --port 5179 --strictPort`，`/pages/flow-page` 正常展示标题和合成文本。见 [截图](playground.png)。最终工作台与 Playground 控制台无 warning/error。

夹具服务数据在内存，刷新重置；云宝新会话替身返回唯一 ID，消息按会话分开。截图与复杂度 JSON 是本地原始证据，遵循仓库 evidence 忽略规则；本结论页随实现交付。

## 已执行检查

| 检查 | 结果 |
|---|---|
| `pnpm exec vitest run apps/platform/tests` | 47 文件、479 项通过；含失败、unknown、错配回执、重复发送、销毁取消、身份变化、迟到结果与交错会话准备 |
| `pnpm --filter platform check` | Svelte 0 错误、0 警告；测试 TypeScript 通过 |
| `pnpm --filter platform pack:microfrontend` | 生产构建及归档通过；不包含验收夹具或内网私有 SDK |
| 归档解包后的独立契约消费者 | 仓外只导入 portal-contract，TypeScript strict 编译通过；包含 dialogue 与 pageInfo 实现 |
| `pnpm validate pages/platform` | 2 页通过，含 flow-page |
| `pnpm exec tsc --noEmit -p tests/tsconfig.json` | 通过 |
| `pnpm authoring:contracts` / `authoring:contracts:check` | 真源生成与一致性通过 |
| `pnpm authoring:check` | 5 文件、175 项通过，含仓外安装、链接闭合与导出隔离 |
| 仓外独立 Skill 手工校验 | 整目录复制后仅用 Node 校验 flow-page，通过；知识入口可独立读取 |
| `pnpm mc:content:coverage` | 来源覆盖对账通过 |
| `pnpm mc:content:test` | 30 项通过 |
| `python3 tools/scripts/mc-content-fixtures.py --check` | 诊断及可观察夹具一致 |
| `pnpm adr:index:check` / `git diff --check` | 通过 |

Python 检查使用已安装锁定依赖的 Tool venv；初次系统 Python 缺依赖后切换该环境，没有修改测试门禁。知识正文变化带来的 MC 诊断哈希已从当前内容包重新生成，未修改诊断算法或页面协议。

## 复杂度

`metriccanvas-ts-ast/1`，TypeScript 5.9.3，与本工作树 HEAD 使用同一口径实测。32 个 TS/Svelte/脚本文件，共 611 个当前函数（含测试、原型、闭包及模板回调）；Svelte 单独解析 script 与每个模板函数，不将模板 if/each 当作 TypeScript 函数。完整原始结果为本地 complexity.json。

| 函数 | 前 → 后 selfCC |
|---|---|
| resolvePlatformRoute | 39 → 12 |
| 新 createRoute | 无 → 14 |
| coordinator.beginLanguage | 8 → 10 |
| coordinator.beginPreparation | 4 → 4 |
| 新 applyDocument / applyRevision / rebaseTitle | 无 → 12 / 6 / 6 |
| 新 sync.rebase | 无 → 8 |
| 新 working-copy-agent.send | 无 → 10 |
| 新 sessions.open | 无 → 9 |
| 新 commitPageTitle / canNavigateDuringCloud | 无 → 4 / 6 |
| workSession.bind | 4 → 4 |

新增和修改函数均 ≤15；本批触及文件中的存量超限是未修改的 workSession.restore，17→17（整份本地恢复记录的原子验证），以及未修改的本地资产 handle，41→41。本次只在其外层已有来源校验中加入正常本地入口 5175，保留现有行为，不扩大为存储和服务分发重构。没有执行外部 CodeCheck，不能据本地指标声明外部复扫通过。

## 外部剩余项

真实云宝 openSession / 发送前接管 / 结构化上下文传递 / 现有组件回执时序、真实路径 DTO、发布生成链接和用户确认、Java/DQE/Relay/门户部署均为 NOT_RUN。默认 SDK Adapter 继续仅使用已核实的挂载方法；只有内网实现 agent 端口后才启用新模式。路径接口未注入时只提供标题/描述更新，路径输入明确禁用。

MC 侧已提供完整接缝和可运行场景；内网逐项联调按 [交接说明](../../pangu-agent-authoring.md)，不以本地替身代替服务证据。保留当前工作树供继续接入与评审；原离线原型是评审材料，不作为生产入口。

## 本地产物标识

生产归档：`apps/platform/dist/metriccanvas-platform-1.0.0-rc.1.tar.gz`。

- archive SHA256：`c308948327096d3f0f4b9f94fb73d7aafe1fd59cd9e39ccb1173685d04a37701`
- sourceTreeSha256：`2481840614223c713fa159401cb7dc23c0b2801119775bfde02253a4d6908917`
- baseCommit：`abf35e983fa57e9cb9ef0f521a1d4de6d04a6325`，sourceDirty=true；这是本地构建标识，不是远端提交或 CI 证明。


## 正常 Platform 入口补验（用户要求后）

上一轮入口是测试夹具，不是用户日常运行的 Platform。已将本批应用源码与测试同步到主目录 `/Users/moon/Documents/Code/公司项目/DataDashboard`，保留其他工作区修改和独立工作树，未同步原型进生产入口。

正常入口为 `pnpm --filter platform dev:local` → `http://127.0.0.1:5175/manage`；与默认 Platform 共用 index.html、standalone/main.ts、PlatformRoot 和正常路由。已有本地资产服务8080持久保存数据，DQE Sim18228提供本地查询演示；没有验收横条、悬浮面板或合成 Chat。5174 默认 HTTPS/CloudIOC 行为保留。

实际操作已验证：从目录进入 demo，在检查器改组件标题，再改页面标题。资产 R2 只有页面标题变化，组件标题仍为旧值，前端保留未保存修改；正常保存草稿得到 R3；从独立表单改描述得到 R4，返回目录显示新值。没有连接真实云宝；访问路径维护缺接口时禁用，未冒充全链路接通。

同时修复管理列宽合计超过100%导致操作裁切，使用现有 Grid 的列宽与换行，保留主题。主目录平台479项测试、Svelte与测试类型检查通过，正常构建通过。新增 developmentServer CC=8，配置工厂14→14，来源校验外层回调6→6；原服务 handle41保持未改。

正常入口证据记录在主目录 `docs/evidence/agent-authoring-flow/normal-platform-preview.md`，截图为实际 Platform。旧生产归档标识属于上轮构建，尚未为本次入口补验重新发布。

## 最终界面收敛

后续用户调整已落实：移除目录行内编辑与预览入口；基本信息表单铺满内容区域并使用“< 返回”；右侧组件清单支持上下拖动与画布同步、列表外取消及撤销。早期夹具中的行内编辑截图仅为历史检查。最终正常 Platform 验收见同目录 management-actions.md、normal-platform-preview.md 和 component-list-order.md。
