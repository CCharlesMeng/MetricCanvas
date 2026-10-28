# Report 布局、Skill 与 MC 范围交付

日期：2026-10-28。用户授权将本次布局创作、Skill 和 mc-content 相关改动提交并推送 main，保留其他并行改动。

## 基线与范围

主工作区保持原状，Git 基线为 `9ee7e6ac611e5651046dde16f9b5fc44dc0974b1`。交付在 `/Users/moon/.codex/worktrees/report-layout-delivery/DataDashboard` 从最新 `origin/main` 的 `a298e5f643734a15ea2f6d6389cedf3f755841ac` 隔离承接，共103个显式允许路径。

纳入：开发环境 Report 集中审核原型及其合成数据、六个布局／独立评测示例页及相关截图、11项章节组合与容器基本原则、预览修复流程、Skill与MC路由、同源投影及覆盖回归、生成索引／知识清单／Bundle锁／诊断夹具、交接和验收说明。

排除：Platform开发代理与端口配置、`tests/dev-server-*`、`pages/README.md`中的并行代理说明、层级表格方案和组件、其他布局原型。`docs/plan/README.md`仅纳入“本地创作页面范式”一行，没有复制并行的层级表格行。两份合成评测原始数据按精确路径加入，未放行整个忽略目录。

main已有的页头迁移、周查询和Tab修改全部保留。Skill版本号冲突采用1.5.0，同时保留main已有的页头迁移描述、路由和参考；生成分发从合并后的产品真源重建，未拷贝旧锁和旧生成身份。未修改产品渲染、页面协议或自动装配能力。

## 分发身份

- local-authoring：1.5.0，writer：6.69。
- MC：`1-a9ccefcfaec8536a`。
- MC内容SHA256：`a9ccefcfaec8536ae31cc3df80063531e5852bebdac7227aafac7ba0358e54ea`。
- 交付归档SHA256：`0b7565841648e89cf03693ed353f455fba0886b1f272f7a10fad7dd41fa2278d`。
- 四份组合正文保持同一SHA256：`002b0ad8ca21360cde57f7d9b656a285d08027252b7ce6916e77ce006934f261`。

R2与R3记录保留各自当时冻结的输入、版本及原始结论。R3测试的是交接时冻结的1.5.0内容；本次合入main后补含既有页头迁移知识，并从新基线重做确定性和分发检查，不将旧评测冒充整个合并包的新模型评测。独立归档及CI产物证明包内容，未执行真实Relay／DQE或部署验收。

## 交付复验

- 126个页面文档：全部通过。
- Playground检查：0 errors、0 warnings；生产静态构建通过。
- tests TypeScript检查：通过。
- authoring:contracts和mc:content:check：1256项产品、4项创作、1项接口文件无漂移；来源覆盖、33项MC回归及诊断夹具全部通过。
- MC覆盖负例回归：7项通过。
- Bundle：6166项摘要检查通过。
- 独立MC归档：解包后verify、完整query均成功，查询正文与单一作者源逐字节一致。
- 审核原型：1440／1280无页面或图表溢出，11项采用与C3-B留档、变化值颜色、复制、刷新和C5页签切换均通过，无pageerror；只有浏览器自动探测favicon.ico产生既有404。
- authoring:check：当前交付检出6个测试文件、219项全部通过，耗时1080.69秒。

审核原型的双视口复查使用最新保存裁决：11保留、0调整、1不采用。临时复验脚本最初沿用较早裁决与文案预期，按保存的最终记录修正后复验全部通过；没有修改页面裁决或产品来满足旧预期。

## 复杂度

使用`metriccanvas-ts-ast/1`、TypeScript5.9.3在同一工具口径下实测交付基线与最终源码：`localPagePatternOutputs` 3→3、`mcPlatformFacts` 3→4、`checkMcCoverage` 10→10。新增TS测试回调均1；新增Python查询测试使用Radon6.0.1，CC=1。新增原型model函数及回调为1–4，路由load=2，Svelte脚本函数及回调为1–3、模板事件回调均1，分别提取后实测；未把Svelte模板分支当作TS函数测量。无本次超限未关闭项，无改动存量超限函数。

## 交付与清理边界

只暂存显式允许路径，提交前审阅暂存差异。提交、远端ref和精确SHA的CI结论在会话最终回执中分别报告，不使用skip-ci。主工作区既有修改以逐文件SHA256核对，保持原状；不因本地main落后自动覆盖、暂存或重置原工作区。

本轮原始日志、允许清单、原工作区文件摘要、前后复杂度、独立MC归档及浏览器证据保存在`/tmp/report-layout-main-delivery-20261028`。完成远端与CI核验后归档本次交付工作树；其他任务工作树及其未提交内容保留。
