# 本仓剩余实现与最终集成验收

批次开始2026-11-03，检查跨至2026-11-04；本记录不表示远端交付或Relay采用。

最终工作树 `/Users/moon/.codex/worktrees/relay-reference-final/DataDashboard`，基线 `e31ccd6c6`，Schema6.83。用户原工作目录未改运行源码。来源/所有权/逐SHA参见本目录 a/b/c-source-integration.json（上一集成树记录）、latest-source-staging.json 与A/B/C正式manifest；A测试Schema修复和B运行时列身份delta另有精确清单。没有整仓拷贝node_modules或派生物跨版本覆盖。

## 实现

需求到取数/结果/稳定用数身份关联、普通源原子换源、Tokens与最终有效绑定检查、单源/多槽v2装配编辑均已实现。复用产品规则，无真实网络/状态/保存；复杂不等价依赖按明确诊断拒绝，非普通换源范围不伪造支持。主控接入正式OutputMap、完整authoring core源身份、两个本地Node薄包装/既有入口投影、同源知识/文档/例子。Skill1.21.0，作者根入口7553→7209 UTF-8字节，仅源码体积，未声称Agent token收益。

发行具备build/test/core-test/pack/verify/replay六项目入口、确定归档/安全解包/真实来源回执、固定消费者、最小依赖环境和原生双平台CI接线。新增诊断资源从真实操作反索引，旧资源ID/路径/正文保持，legacy9MCP来源图与实际离线Interface分开。

## 已完成检查

- 全仓 `pnpm check` 通过，Svelte零错误/警告；后续仅测试fixture与等待方式调整，测试TS另查。
- 最终受影响产品/Node/表格/时间/隔离/CI结构10文件118项通过。
- local-authoring五文件204项、repair常规16项通过，Python配置core99项通过。
- 四项发行69项通过。6.82开发候选真实23冻结调用、35自检、9负例及POSTPROCESS通过；source drift拒绝旧候选打包正确，不能当最终6.83来源归档。
- 最终Embed261浏览器全部通过，含完整复制ES/global和Webpack；新Playground3浏览器通过（宽窄屏、同名跨槽列、真实Canvas百万/Tooltip）。此前生成器与浏览器读取共享fixture重叠的一次批次不作为全绿证据。
- Embed14JS，最大929901未压缩字节，低于1000000；check:dist通过。实际npm归档同样14JS且最大929901字节，结果见embed-archive-final.json。独立Skill1.21.0官方打包/仓外验证通过，归档SHA ad166521f956069e542362cf86d8af9f19080996a3ace0398064ea901c76c651，实际来源仍为未提交e31集成树。
- 固定Python复杂度15文件376函数max15，无超限。A/B/C及主控逐函数自身CC见complexity-summary.md，存量投影函数52→52未关闭。
- 最终837公共构建来源摘要逐字节核对零漂移。完整全仓测试最终r3使用maxWorkers=2，453文件通过、4184项通过/5项跳过，1389.82秒。前两轮发现项均已处理：历史Schema固定输入且旧预期未改、语言租约测试按实际状态等待、internal新增3符号显式登记；未放宽断言。

## 真实迁移差异与待决策

review候选 `/tmp/mc-relay-completion-schema683-review-r1`，release0.2.0/Interface1.1.0，releaseId `0866c5c1186591971c5e3a8da99344680cbe9d6d73b9feb9d20f8d1c3cb05534`。这里只是可审查候选，不是正式采用批次。两次实际导出r1/r2的全部3834个文件路径及原始字节完全一致，见repeated-export-schema683.json；没有仅用相同版本号代替字节比较。

与固定0.1/6.82消费者真实回放：23条中8条product data/升级诊断变化；defaultPageSchema和page.compose/page.edit嵌入契约改变。预检查/回放正确返回needs_migration(exit2)、automaticPromotion:false。原始stdout、纯JSON报告和命令状态见schema683-versus-frozen682文件。六精确依赖、仓外-I/-S实际运行自检和9负例均通过；不含旧消费者兼容通过声明。

2026-11-04用户明确同意首次正式基线采用6.83，保留6.82冻结样本证明迁移。C继续追加正式consumer/adoption来源记录及强制反例，严格保留旧比较器与f7。最终归档与主线CI交付随后执行。

## 未完成与环境边界

最终发行归档/双导出及原生Linux/Windows远端CI、提交/push均未完成。真实Relay聚合/MCP/权限、结果查找、CAS、Java保存与unknown恢复、原子采用及缓存/在途轮次/回退、真实DQE/模型/部署未执行。旧在线实现未提前退役。所有未合入main的任务工作树保留，等待同一范围交付后按规则清理。

## 2026-11-04最新接续

全仓r3已经实际结束并通过。用户确认6.83首次基线；可用性报告正在按这一已决口径出具。后续仅发行adoption聚合/新固定消费者/归档回执与相关CI变化，复用未改变的产品源码全仓结果，并重跑受影响的发行/CI/归档检查。

## 2026-11-04可用性报告与首次发行

[可用性报告](../2026-11-04-relay-readiness/README.md)给出初步对接结论、19个实际操作、目标端和维护端本地测试命令。用户已同意6.83首次基线；新增policy17源已逐SHA携入，新35条正式消费全通过、历史23条八处差异仍needs_migration，真实r6 --current仍exit2。发行80项带实际0.2.1候选全部通过、零跳过；CI结构8项复验。产品源码未变，复用全仓4184通过/5跳过。MC契约/覆盖/52项Python与fixture check全部通过。正式preview归档已生成，完整历史失败保存在compatibilityEvidence，源码收口前标dirty，最终交付另绑定实际commit/归档回执。

## 0.2.1 收口

最终发行0.2.1、Interface1.1.0、Schema6.83，releaseId `91096c5dc84def84073ba03e96096b19730eaf2ac1088de9a5badaa96defb020`。两次导出3834文件路径与字节一致；完整Interface及6个Node预构建文件与0.2.0逐字节相同，0.2.0→0.2.1实际current比较及正式35调用全通过，旧23的8条差异仍为needs_migration。实际候选发行80项全通过、零跳过，authoring contracts检查通过。预览ZIP45,891,229字节、SHA256 `e74ca2523083e39ae9610a09d85841cb4da9176db33064ce5c83e5e007f9a34b`；最终同字节归档另绑定提交后来源回执。上述未完成交付状态属于此前取证时点，最终提交/CI状态以发布回执及该提交的远端检查为准。
