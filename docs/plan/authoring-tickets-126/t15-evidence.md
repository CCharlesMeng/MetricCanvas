# #141 / T15 S1 撤销与页面历史回执

前置#140正式验收，共同SHA `155346f2eae7c5dc8d9e35c8613f69ffa15de22a`已合入。已读#141正文/评论（无新增评论）与T04保存/历史提案。本票UI直接消费生命周期端口，不等待生命周期MCP，不修改S2临时精确预览路径。

## 撤销边界

“撤销上一步”针对最近一次完整页面操作，持久化该操作前的双投影`undoDraft`；重开后仍可撤销。撤销本身新增反向操作并清除此单步撤销目标，不实现多步撤销栈或重做。原操作/已存修订一律保留。未发出的离线操作保留原键，反向操作追加队尾，联网时原操作和反向操作按序各自保存新修订。

已发操作结果未知时先query原键，未核实/正在发送/冲突都不能跳过或删除队头。已确认后才追加反向操作；并发新编辑使撤销失效，用户需重新选择。反向操作使用当时“保存时保留维度取值”选择，仍为manual来源，description说明撤销，不扩大T04来源枚举。原格式记录的undoDraft为可选扩展，恢复会校验同页面双投影；旧记录无撤销目标时按钮禁用。

## 历史端口与恢复

新增内部`ListRevisions(pageId,cursor,limit,signal?) -> RevisionHistoryPage`拟议消费边界。返回固定snapshot、revisions及不透明nextCursor；条目ref必需，base/description/origin/createdAt/revisionNumber未提供时不补造审计事实。后续页要求原snapshot，校验页面/资源、重复修订、快照漂移、循环/重复游标。UI为页面修订历史，独立于盘古会话历史。

`AuthoringPort.listRevisions`可选且受history能力门控；恢复要求exactRead能力，按所选完整ref调用getRevision，经既有精确预览校验读取结果（不改RevisionPreview组件）。未开放能力明确提示，不构造生产URL、不以当前修订列表冒充历史。

`restoreRevision(ref)`先核实待确认保存，再经过requireSynchronizedRef；读取历史期间新编辑、取消或身份变化均丢弃迟到结果。目标通过页面校验后作为新完整操作入原队列，以当前确认base保存，不把head倒退到旧ref。显式恢复即使内容相同也创建新操作/新修订，普通无变化属性操作仍不保存。只用save端口，不调用发布/删除/历史改写接口，已发布版本不受影响。

## 逐项证据

| 场景 | 证据 |
|---|---|
| 撤销未同步完整操作 | 单测重开后保留原operationId并追加不同键反向操作，联网后2次save与顺序base；Chrome真实offline改标题→撤销→已保护2项→online保存R2/R3 |
| 未确认与冲突 | unknown保存后undo先lookup，不新增save/删command；lookup冲突仍保留原命令；历史恢复在未知结果未核实前不调用getRevision |
| 恢复旧修订 | 精确old-1读取→当前r3为base创建r4，保存文档等于选定历史文档；相同内容再次显式恢复也新增操作 |
| 重开后继续编辑 | 真实IndexedDB整页刷新恢复r4内容，继续编辑以r4为base保存r5 |
| 历史分页 | Chrome固定snapshot加载两页；重复跨页条目停止加载并显示错误；单测重复条目、快照漂移、错误资源拒绝 |
| 错误引用/身份/迟到 | 精确读取错修订拒绝不覆盖；读取期间新手工操作不被覆盖；身份变化后历史返回丢弃，零队列跨身份操作拒绝 |
| 能力不可用 | 生产history/exactRead仍false，真实入口明确显示尚未开放页面历史；不展示伪历史、不猜接口 |

## 验证结果

- 本票与同步/恢复/协调器/document-edit定向5文件60项通过，含7项history用例。
- Platform svelte-check：0 errors / 0 warnings；测试tsc、vite build、diff检查通过。
- T15历史/撤销、T14恢复、T13同步、T01/T02对话工作台浏览器均通过。
- 开发页增加“启用历史替身”开关后旧T01脚本无名checkbox定位变为歧义；已收窄到“嵌入工作台”并复验，不放宽断言。
- 截图已检查：`/private/tmp/metriccanvas-s1-evidence/t15-history-restored.png`，列表保留old-1/old-2、画布及检查器显示历史内容，服务端回执为新R4。脚本可重建。
- 首轮全量：136文件1019项通过/5skip，1项失败为共同基线地图导出隔离测试缺失china.json输入，已报S0并等待所有者修复；S1未跨改该测试或导出器。最终组合结果在后续补记。

## 文件与外部边界

新增S1：workbench/authoring-history.ts、workbench/AuthoringHistory.svelte、tests/workbench/authoring-history.test.ts、authoring-history-browser.mjs及本文件。既有S1：authoring-sync/recovery/coordinator、PageAuthoringWorkbench、authoring-sync-fixture、routes/dialogue/+page.svelte及authoring-browser.mjs定位修正。

开发替身仅显式开关注入，list/read/save通过浏览器route提供，不是生产路由或真实Java能力。真实历史分页、任意修订精确读取、强保存仍待提供方确认，替身通过不宣布真实联调或M1。

回退revert本票，保留IndexedDB，不删除旧修订。回退至严格#140恢复器时带undoDraft的记录会拒绝读取并保留原数据，需要恢复本票或显式迁移，不自动删除扩展字段。#146仍等#138，#145仍等#138/#144；等待S0逐票验收后再消费正式集成。
