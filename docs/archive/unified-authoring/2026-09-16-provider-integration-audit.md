# 提供方接口与本地消费者核查

日期：2026-09-16。核查基线：main `7583d80`，CI 修复 `7f56f7a`。读取 GitHub #105–#108 的现行正文与评论，并与本仓消费者对照。没有调用真实提供方、联系提供方或执行生产写入。下表区分资料确认、本仓实现和真实环境验收，不能互相替代。

## 已有资料可以支持什么

| 范围 | 已核事实与本仓消费者 | 尚未确认的部分 |
|---|---|---|
| [#105 页面资产](https://github.com/CCharlesMeng/MetricCanvas/issues/105) | 9月10日更新明确集合 GET 的 pageNo/pageSize/needDefinition，列表携带 page_id/page_metadata_id/revision_id；详情 GET、POST、PUT、CommonRsp 已给出。`apps/platform/src/lib/page-assets-client.ts` 已消费这些路径、请求 object/响应 JSON string，透传宿主身份且不发送 X-Workspace-Id。 | page_id 唯一性及资源与修订关系、历史精确读取、实际部署及权限验收仍待联调；不能笼统记为缺目录/详情接口。 |
| Python 当前读取 | `adapters/outbound/lifecycle_http.py` 的 `KnownLifecycleHttp.current_match` 按 resourceId GET，核对完整引用与页面协议；`lifecycle_server.py` 已装配。 | `current_read=True` 只表示当前响应匹配，不代表不可变历史读取。stable_save/exact_read/history/operation_lookup 未开放；提供方事实未证实，不等于服务不支持。 |
| 旧 Python 写路径 | `adapters/outbound/java_page_assets.py` 的 `JavaPageAssetPort` 仍消费旧 `/pages/{pageId}/revisions`，`server.py` 保留旧工厂。 | 不能换 base URL 就当成 #105 新接口，也不能把新 CRUD 包装成自动重试的强保存。旧路径退役需另行消费/兼容验收；本次未删除。 |
| [#106 盘古接入](https://github.com/CCharlesMeng/MetricCanvas/issues/106) | 现行状态是事实追问暂挂，未新增提供方答复；ask 返回 void 不代表没有业务答复。 | 受控 Skill 标识/路由信号、身份回调、确认与真实轮次关系、服务端取消、历史语义仍未证实。不代发提问，不重开产品选择。 |
| [#107 对话](https://github.com/CCharlesMeng/MetricCanvas/issues/107) | `dialogue/runtime.ts` 与 `PanguDialogue.svelte` 已实现固定部署资源版本、独立实例挂载/销毁，并接入原工作台；本地 SDK 替身有测试。 | 真实 SDK 加载/升级及事件、路由、身份验收未完成。配置 resourceUrl/version 只足以加载 SDK，不足以证明统一创作已路由或可信轮次已建立。 |
| [#108 产物](https://github.com/CCharlesMeng/MetricCanvas/issues/108) | 早期 issue 评论的“无 UI 消费者”已被后续代码推进：`PageAuthoringWorkbench.svelte` 调用 `listenForSavedDrafts`；`dialogue/port.ts` 复用 `analysis-page-state.ts`；coordinator 负责工作副本/迟到结果/身份隔离。`/dialogue` 有明确的 fixture 装配。 | 生产默认 `unavailableDraftReader` 仍关闭精确草稿读取。内部 `{draftId}` 事件不是已确认的盘古 payload；当前详情不能冒充不可变产物。真实产物来源、hash/version、可信操作/轮次与恢复读取未证实。 |
| 统一作者装配 | `authoring_bootstrap.py` / `application/authoring_deployment.py` 已有受控扩展与系统依赖注入；工作台 language/recovery ports 和 SQLite 候选/执行记录已有本地消费者。 | 默认服务缺可信 current turn 时拒绝；本地存储和合成身份不证明 Relay 的真实身份、预算或生产持久化保证。 |

资料原文：`wayfinder-105-provider-api-2026-09-10.txt`。盘古源码访问及本地 SDK 适配的既有记录：`authoring-tickets-126/s5-pangu-evidence.md`。本文不把该记录中的方法名推导为更多提供方承诺。

## 本次可独立修复的消费缺口

TS 客户端原先只在 GET 核对外层 page_id；没有对当前详情或 PUT 回执核对请求 resourceId，也没有核对响应文档的 id，POST 回执也未核对目标页面。已补统一响应检查：

- GET/PUT 的资源必须与请求资源相同；POST 使用服务分配的资源，不预设其值。
- GET/POST/PUT 的 page_id 与文档 id 必须均与目标页面相同。
- HTTP 成功但内容错配归 `PAGE_ASSETS_RESPONSE_ERROR`，表示响应不可信。尤其写入可能已经发生，协调器必须保留 unknown、原引用与工作副本，不能当作提供方明确拒绝后重新发送。
- 保留 string/object 解码兼容与既有请求形状；没有新增 HTTP 路径、提升 capabilities 或把响应摘要当作完整性证明。

先用错资源/错页面/错文档的响应复现五项失败，再补校验。追加真实客户端→协调器测试，验证错回执只发送一次 PUT，原页面与原引用保留。验证结果见后续交付记录。

## 下一步按事实推进

1. 已实现的目录/详情/普通 CRUD 保留现行消费，待目标环境输入后验证真实用户态和资源关系；不能当成未实现重造一遍。
2. 原操作查询、幂等原子保存、精确不可变读取、产物完整性与可信轮次须有对应契约和实测后才接入强端口。只靠 #105 的 POST/PUT 不足以解除这些门禁。
3. 盘古可继续用已知实例接口做本地挂载兼容验证；未知消息 payload 不映射为 begin/confirm/cancel，聊天历史不冒充创作恢复。
4. 保持真实模型请求为 0，生产切换未执行。授权和提供方运行事实分别登记，不用一个总括 blocked 代替各项状态。

## 本次验证

- `pnpm exec vitest run` 定向运行 page-assets-client、authoring-coordinator、authoring-recovery、dialogue、dialogue-boundary、analysis-page-state：6 文件、78 项通过。
- `pnpm --filter platform check`：Svelte 0 errors / 0 warnings，测试 TypeScript 通过。
- `work/venv/bin/python -m unittest discover -s metriccanvas-authoring/test-harness/tests -p test_lifecycle_http.py`：4 项通过，包含已知 GET 形状、身份/重定向拒绝、错误引用与强能力无网络请求。
- `git diff --check`：通过。
- 以上提供方响应均为本地可控替身，未据此关闭 #105–#108。
