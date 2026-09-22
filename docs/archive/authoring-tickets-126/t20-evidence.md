# #146 / T20 语言保存引用交接验收回执

S1 task `01a09f69-8346-7e91-9c66-9e091d3f6e77`；工作树 `/private/tmp/metriccanvas-126-s1`；分支 `codex/authoring-126-s1-next`。开工正式基线 `9dcb2b8539fd4597fdd6816928e0fbffa0486b89` 已含 #138；作者提交 `a0ac309`，随后合入 S0 双 Skill 正式共同基线 `812ad98241e31a1e24ebd6b739a9e3844ef9e5e6`，组合 HEAD `ce10734afb5e75612d46cb410282a126cdec244c`。浏览器最终断言/本证据另行提交，不影响公共契约或生成物。

## 实现和公开接缝

`apps/platform/src/lib/workbench/authoring-language.ts` 为本仓内部可信程序消费端口；不是新 Java/Relay HTTP DTO。`LanguagePort.run(context,prompt,signal)` 只返回状态、操作摘要及保存通知引用，`lookup(context,signal)` 查询原操作，`read(draftId,signal)` 在鉴权、精确定位和原文完整性验证后返回可信 binding 与 SavedDraft。context 固定 actor/workspace/runId/operationId/base/retainDimensionValues，完整页面不进入 run/lookup 模型结果或通知事件。

`authoring-coordinator.ts` 提供本地语言轮租约：同步及浏览器保护就绪后才获取；阻止手工修改、撤销、历史恢复、旧通知接收和并行保存/加载。工作台通过可选 `languagePort` 与 `onLanguageReady` 注入组合，既有 DialogueAdapter.mount→cleanup 及 window `metriccanvas:draft-saved` detail **仅 `{draftId}`** 保持原样。S5 两文件与 port.ts 未修改。

读前、读后及接纳前核验本地租约/身份/范围；可信 binding 必须精确等于原操作上下文。来源 base 及接收 ref 的 page/resource 必须一致且不能把同一来源修订当作新结果，不解析不透明 ID。复用 #108 的本地页面轮状态和 T01 通知读取/去重；旧轮首次迟到不能因为在新 scope 收到而被接纳。成功通知早于 run 回执时，后续失败不再改写已接纳结果。

取消立即失效本地接收，不宣称停止服务事务。unknown/pending 锁定依赖操作，只查原操作、不再次 run 或换键重发。取消后查询确实 saved，会鉴权精确读取并提供“查看取消后已保存修订”；当前画布不自动替换，精确预览固定该引用。此时保持锁并给页面目录重新打开入口，避免将旧画布误当已同步 head。没有服务持久化证据时不显示保存成功。

完整原命令持久固定由可信 Relay 程序端口承担，沿 #138。当前前端轮句柄/上下文只保留于本次挂载，未实现跨刷新恢复语言轮的提供方事件映射；不把 #140 手工待同步队列恢复或聊天历史当作这一能力。真实 Relay 重新连接/操作恢复仍跟踪 #108。

## 本仓验收映射

| 要求 | 实际执行证据 |
| --- | --- |
| 内容→保存→单引用通知→精确读→校验→画布 | Python 边界替身通过 FastMCP Client 实际调用公开内容 `create_content_page/edit_page` 与生命周期 `save_draft/get_save_result/read_revision`；不是手写同名内部结果。浏览器代表页为合法 report 静态说明页 |
| 首次合法产页才建资产 | 非法创建无 artifact，服务 save_calls=0、画布仍空；合法首产页恰好一次保存后才显示正文 |
| 等待同步、期间禁用手工修改 | 单元覆盖 dirty 未保存及 IndexedDB 保护未完成/失败；run 未调用；同步完成获取租约。手工 replace/save/load/发布前置被阻止，浏览器保留值控件禁用 |
| 部分成功一次保存及真实结果 | 真实内容工具返回 applied/failed/skipped；合法子集仅新增一修订。浏览器显示各操作原状态，未保存结果不改 ref |
| 失败/文本/等待确认保留 | 单元及浏览器确认旧文档保留、无新增修订，终态释放编辑 |
| 断网/丢回执/未知 | 保存后丢回执仅查原操作恢复，save_calls不增加；提交前断网 unknown 无服务提交，查询权威 not-applied 后取消/失败收口；未知不换新操作 |
| 取消后实际已保存 | 浏览器明确等待替身完成服务提交，再取消本地回执；查询得到 saved 后旧标题保留，显式预览展示不同的新标题 slow-new，截图等待加载完成 |
| 旧轮首次迟到 | 独立单元：旧轮取消→查询→新轮→旧 ID 首次通知，binding 的 run/operation 不符拒绝；zzzz/aaaa 故意无顺序语义。浏览器在新轮处理中投递旧通知后仅接纳本轮保存结果 |
| 迟到读/重复/卸载 | pending/accepted 同 ID不重复读；卸载后的 unsettled 读不更新；成功早通知后的 run 迟到失败不覆盖成功 |
| 身份/权限/完整性 | actor/workspace/run/operation/base/resource/非法页独立负例；读取进行中身份变更不更新或跨身份查询；读取失败保留，原操作查询后可重读。#138 的真实端口层鉴权/hash负例沿 t12 已验收证据复用 |
| 其他窗口基线冲突 | 外部服务边界返回 REVISION_CONFLICT，浏览器旧页保留、修订数不增加；不自动合并 |
| 独立对话接入兼容 | 原 authoring-browser.mjs 通过：独立/嵌入、保留外壳、失败/迟到保护、SDK v1→v2及destroy；新增组合采用同一挂载接口 |
| 开发替身不进生产 | `/language` 的 dev 条件与请求保护；生产静态构建浏览器只显示不可用说明，无执行按钮、零语言fixture请求；生成节点不含fixture请求路径 |

## 实际检查

- 新增 `authoring-language.test.ts` **22 项通过**；覆盖上述状态与关联反例。
- 新共同基线组合 `pnpm test`：**142 文件、1097 通过、5 既有跳过**。日志 `/private/tmp/s1-t20-final-test.log`。前一基线亦全量通过，最终数字以此为准。
- Platform tests `tsc --noEmit -p apps/platform/tsconfig.test.json` 通过；Svelte check **0 errors / 0 warnings**；生产 Vite build 通过（`/private/tmp/s1-t20-build.log`）。
- `authoring-language-browser.mjs` 在实际公开 MCP 组合下通过，最终同时设置生产预览地址验证关闭；没有页面 JS 错误。截图 `/private/tmp/metriccanvas-s1-evidence/t20-cancelled-saved.png` 已查看；最后版本截图包含精确预览完成的修订内容。
- 原 `authoring-browser.mjs`：T01 / T02 / T13 browser PASS。没有重复运行不受本票影响的全量 Python/发行矩阵；#138 和双 Skill 的提供方模块复用 S0 已验收证据，组合测试直接加载当前基线源码。
- diff --check 通过。本票未改 Bundle 作者/锁或公共导出，**无生成 SHA**。

复现：在工作树根以已有锁定 Python 3.12 依赖启动显式边界替身（不修改依赖环境）：

```sh
/private/tmp/metriccanvas-126-delivery-python/bin/python apps/platform/tests/workbench/language-relay-fixture.py 5192
```

在 `apps/platform` 启动 Vite dev 5181；生产 build 后另起 `vite preview --host 127.0.0.1 --port 5187`。根目录执行：

```sh
S1_PRODUCTION_URL=http://127.0.0.1:5187 node apps/platform/tests/workbench/authoring-language-browser.mjs
```

可配置 `S1_BASE_URL` / `S1_RELAY_URL`。Python HTTPServer 仅监听127.0.0.1，测试路由由浏览器拦截代理；没有新增生产服务或真实 Java URL。它使用内存程序通道模拟可信 Relay，不冒称生产 spool 持久化或实际模型执行。

## 外部确认、真实联调与回退

本仓：闭环与反例通过，交 S0 决定 M1 本仓范围放行。外部确认：本轮无新增，强幂等/原文算法/draftId权威映射/身份及运行关联仍沿 #105/#106/#108。真实联调：没有调用真实盘古、Java、Relay或模型；默认生产未注入 languagePort，强保存和精确通知读取保持不可用。不能据此宣称 M3、真实模型评测或 #107/#108 全票通过。

#145 待 S2/S4 冻结契约与工具交接后继续，既有精确预览/同步门禁可复用。本票没有参数提取、人工发布或外部服务改动。回退作者与后续证据提交即可移除新组合入口/语言消费端口；无数据迁移、远端推送或真实资产写入。

## S0 接收口复核修正

S0 发现取消后 lookup→trustedRead→recovered 不经过普通通知监听器的三标识兜底；此前使用 Object.values 只验证已存在字段，首次创建 base=null 时可能遗漏 revisionId/resourceId。现直接逐项检查 pageId/revisionId/resourceId，复用 T01 相同非空/长度/控制字符规则，不改 port.ts。新增首次创建取消后缺少三个标识各一反例，均保持 draft/ref/recovery 为 null、状态 unknown 且提示 RESPONSE_MISMATCH。

修正后针对性三文件 **43 项通过**（语言模块累计25项），tests tsc、diff --check通过。前述142文件全量及浏览器是修正前完整流程证据；本次只收紧必需字段，未冒称重新运行整套矩阵。

本票 GitHub 评论回写被自动审批拒绝，评论没有发布；本地代码与证据已交 S0，不经其他任务代发绕过。待用户明确批准具体评论发布后再回写。
