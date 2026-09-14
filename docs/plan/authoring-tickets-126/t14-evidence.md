# #140 / T14 S1 浏览器恢复回执

执行前置：S0正式验收#139并放行，共同SHA `04c4869444c2c5d3be6eade427bb191553fa81ec`；最终组合已合入#134正式SHA `ca8c549b05c129fd6b0d0fc155b3b7f7a86de4b1`，含已验收#143。读取#140完整正文/最新评论（无新增评论），未等待或提前消费#138/#144。

## 实现与消费接口

沿#139唯一有序队列恢复，不建立第二套保存机制。`authoring-recovery.ts/validateAuthoringRecord`校验IndexedDB记录格式、存储版本、actor/workspace/page、base、双投影、操作唯一性、command/context/outcome一致性及允许字段。未知格式、未来页面版本、损坏投影、身份不符和操作层附加凭据字段均拒绝；原记录保留，不自动迁移、不覆盖。读取失败也不覆盖无法核实的旧记录。

`restoreCanvasAuthoringDraft`从canvasDocument重新验证双投影，保留空内容分区身份/顺序，校对pageDocument与authoringSections；不经整页重建丢失空分区。恢复时不normalize已冻结command，不因为current=6.2改写原6.1命令、基线、操作标识、保留维度取值选择或描述。

协调器load先按当前身份从本地读取；有合法记录则无需远程getLatest即可显示工作副本。无记录再读已有服务。首次打开的初始工作副本也先持久化，不产生服务端修订。新精确草稿通知仅在原队列清空时以原CAS版本更新本地基线；存在未同步操作则优先保留本地工作。读取/验证异步返回仍核对身份与工作范围。

`createAuthoringSync`新增restoredVersion、online、retryDelays与start/setOnline。恢复已持久化command即使没有outcome，也视作可能已发送，先lookup原operationId；只有权威not-applied且retrySafe=true才重发完全相同的command。未创建command的队尾操作沿原顺序绑定最新确认base。原存储version继续用于原子CAS，其他窗口更新即停止写入并保留本窗口内容。

重连与瞬时未知结果使用1s/3s/10s退避，最多3次自动追加核实（初始核实+3次），不无限循环。明确校验/身份/冲突拒绝、完整性不匹配、无法保证幂等窗口、存储失败不自动重发。手动核实或离线→在线开启新的有限核实机会；已拒绝操作仍暂停。卸载清除定时器、阻止后续写入/发起请求、忽略迟到结果；已经交给transport的请求不能保证物理撤回，原command保留以便下次核实。

工作台绑定online/offline并在卸载解绑，待同步仍可手工编辑。既有readSavedDraft门禁阻止未同步语言修改；新增`requireSynchronizedRef(): DraftRef`供后续发布/语言接线消费，加载中、未保护、待同步、dirty或身份不符均拒绝，成功返回复制的已确认引用。#145/#146未实现，本票验证公共门禁，不声称真实发布流程已完成。

## 验收证据

| 场景 | 实际证据 |
|---|---|
| 断网重开/重连/原顺序 | Chromium真实context.setOffline后编辑2次、卸载并重开工作台，从真实IndexedDB恢复最新画布和2项操作；恢复联网后串行base推进，仅2次save |
| 服务已提交丢回执/整页刷新 | 外部边界替身保存receipt但中断响应；整页刷新后lookup原键取得receipt，不新增save或修订 |
| 无outcome不等于未发 | 单测恢复持久化command且没有outcome，先lookup；not-applied才允许原command逐字段相同重发 |
| 版本/损坏/空分区 | 单测拒绝format=2、6.3未来版、不一致投影、错误base/ID、附加context凭据；合法空分区完整保留、原6.1command不变 |
| 原身份与凭据 | 单测延迟读取期间alice→bob不恢复；浏览器bob重开读不到developer-1本地内容；持久化结果没有authToken |
| CAS/本地失败 | 单测其他窗口增版本后不可覆盖/不可发送；读失败仍可保留内存编辑，不能显示已保护或打开门禁；既有浏览器存储拒绝用例通过 |
| 有界重试/卸载 | 虚拟时钟验证初始+3次后不再查询、零重复save；卸载后定时器停止、迟到查询不删除原command |
| 校验/身份/冲突暂停 | 恢复AUTH_REQUIRED/VALIDATION_FAILED/REVISION_CONFLICT，即使retryable=true也不自动重发、不丢队列 |
| 门禁正反例 | 未同步与本地失败拒绝requireSynchronizedRef；受保护且清空队列、初始工作副本保护完成后返回精确引用；未同步readSavedDraft拒绝 |

## 验证命令

- `pnpm test`：135文件1009通过 / 5项既有skip，含17项authoring-recovery用例。
- Platform `svelte-check --tsconfig tsconfig.json`：0 errors / 0 warnings。
- `tsc --noEmit -p apps/platform/tsconfig.test.json`通过；Platform `vite build`通过；`git diff --check`通过。
- `node apps/platform/tests/workbench/authoring-recovery-browser.mjs`：T14通过。
- `node apps/platform/tests/workbench/authoring-storage-browser.mjs`：T13回归通过。
- `node apps/platform/tests/workbench/authoring-browser.mjs`：T01/T02/T13真实入口回归通过。
- 截图已检查：`/private/tmp/metriccanvas-s1-evidence/t14-offline-reopened.png`，画布/检查器保留第二操作标题，明确已在浏览器保护且待同步2项。脚本可重建。

## 文件所有权与界限

新增S1：`apps/platform/src/lib/workbench/authoring-recovery.ts`、`apps/platform/tests/workbench/authoring-recovery.test.ts`、`apps/platform/tests/workbench/authoring-recovery-browser.mjs`、本证据文件。既有S1修改：authoring-sync.ts、authoring-coordinator.ts、document-edit.ts、PageAuthoringWorkbench.svelte。未修改S2临时所有的RevisionPreview及专用测试，未修改S3/S4/S5文件。

真实Java稳定幂等/lookup/完整性端口仍未确认，生产stableSave=false，本票不把浏览器替身通过当成真实联调。离线重开验证前提是应用壳已加载；未新增离线静态资源缓存/Service Worker。真实完整导航仍需应用壳可访问；本地工作及操作恢复不依赖页面资产服务在线。

回退可revert本票，保留IndexedDB记录不删除。旧#139实例遇到已有version会CAS拒绝覆盖；记录不做破坏性迁移。等待S0验收后才消费正式集成SHA；#146仍需#138，#145仍需#138/#144；本票不宣布M1。
