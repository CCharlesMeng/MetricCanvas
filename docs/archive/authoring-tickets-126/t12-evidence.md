# #138 / T12 独立生命周期 MCP 验收回执

S4 task `01a0a034-68fb-79e1-bfe3-cf7d3ab15d38`；独立工作树 `/Users/moon/.codex/worktrees/da9f/DataDashboard`，分支 `codex/s4-lifecycle-138`。正式产品基线 `a6e923187e124c7fd6c7f7c2e78bafd101e3dda6`，开工 fetch origin/main 核对一致，工作树原先干净；没有沿旧 #127 分支或带入原仓未提交内容。

作者提交：`7df759821ec78bcc1f38136245131ead5dc41429`，追加保存程序交付失败保护 `055a9d2301dcaa3cfc524624472c655e61b0511f`、四态兼容补正 `7444387f10fdf4a6b2eb57c50662df375eac9978`。S2 唯一生成及最终组合见下方交付记录；S0 验收集成与正式消费 SHA 仍由其另行发布。

## 公开边界

入口 `metriccanvas-lifecycle` / `python -m metriccanvas_authoring.lifecycle_server`；程序组合入口 `create_lifecycle_mcp_server(service, programs, identities)`。四项 MCP 工具 `save_draft`、`get_save_result`、`read_revision`、`list_revisions`，每项仅一个 `request_token` 输入。内容 MCP、DQE、旧 Java 保存入口不初始化，没有编辑、提取或发布算法。

自有作者契约 `metriccanvas-authoring/contracts/authored/lifecycle-request.schema.json`，`$id=https://metriccanvas.dev/authoring/lifecycle-request.schema.json`，本版 `lifecycle-request/1`；消费语义沿 T04 `authoring-lifecycle-proposal/1`。没有修改公共产品 DTO、页面协议（仍 6.2）、工作台客户端或公共导出。

- 可信程序在发送前持久固定完整 save 请求及稳定 operationId，明确 actor/workspace/origin/base/document/description/retainDimensionValues。模型不能输入这些字段。schema 拒绝未知顶层字段及缺少显式选择，完整页面经既有公开 Python 校验。
- `LifecycleIdentityPort` 单次调用前后核对身份；默认身份只接受部署注入，两服务身份头由 #105 事实消费。actor 声明不等于认证，真实 token/actor 绑定由 Java 验证。spool token 不代替鉴权，跨 actor/workspace 拒绝；凭据不写 spool、不返回模型。
- `LifecycleProgramPort` 是受信任程序交接；默认文件输入/输出目录 0700、文件 0600，拒绝路径穿越、最终路径软链、非普通文件与错误权限。Relay 拥有输入不可变性、生命周期与清理；本仓不声称真实 Relay 已会写该通道。
- 每次保存先以原完整命令查询操作结果，只有权威 `not-applied + retrySafe:true` 才提交；同键同载荷重放返回原修订，同键换载荷由服务拒绝。unknown/pending/去重失效不重发；不安全的 not-applied 在保存工具映射 unknown，not-applied 仅保留在查询结果；取消本地接收不取消服务事务，原请求仍可查询。没有本地强幂等数据库或 UUID 保证。
- 强回执验证 operationId、完整 ref、base、revisionNumber、文档 hash 与明确 canonicalization；不匹配或丢失回执保持 unknown。保存程序输出保存 receipt/context/base，供可信编排核对原轮次。没有 sessionId/runId 时不能推断轮资格。
- 精确读取核对三个独立标识及页面 id，对原始持久化文档验 hash 后校验页面，不规范化原修订、更不回退 latest。完整文档只写程序输出；MCP text 和 structuredContent 均只含状态、引用、hash、程序 token。
- 历史固定 snapshot/cursor，拒绝错页面/快照/重复项/缺游标字段/空页继续游标；历史审计原值只在程序通道，不补造未知作者/时间。恢复保存仍是新操作，模块不倒退 head。

`KnownLifecycleHttp` 仅按 #105 2026-09-10 真源适配资源 GET、两身份头、retCode string 与 definition string。current-match 只表明当前响应相符，`assurance:provider-response`，不是强 exactRead。生产组合 stableSave/exactRead/history/operationLookup 均为 false；没有强端点、默认 hash 算法或可强行打开能力的环境开关。未来服务通过显式 `LifecycleServicePort` 实现接入，须验证真正强语义后才能开放。

## 本仓测试与 T04 对应

最终作者与 S2 导出组合完整 Python 回归 **246 项通过**；新增生命周期专项 **24 项通过**。首次全量在沙箱内有 3 项既有 localhost bind 权限错误与 1 项 sdist 新契约集合失败；获 S0 登记后仅补集合项，再于允许本地服务的环境完整重跑通过。没有跳过失败项。

| #138/T04 要求 | 实际证据 |
|---|---|
| 独立入口、合法保存、不运行内容编辑 | 生产与边界替身 stdio 四工具集合；多余 document/actor 参数拒绝；非法页/缺说明/缺保留值零保存 |
| save-exact-read / retry-identical | 强保存成功、重复与lookup三次同ref且仅1次提交；程序输出保留可信origin |
| retry-different-payload | 同键改document/description/retainDimensionValues/origin均IDEMPOTENCY_CONFLICT |
| lost-ack | 替身服务提交后抛超时，工具unknown；原token查询恢复原ref，零重复提交 |
| stale-save | 两操作同base仅一项成功、另一REVISION_CONFLICT；不覆盖历史 |
| 未知/处理中/过期去重 | lookup分别unknown/pending/not-applied且retrySafe=false，零提交 |
| 身份与取消 | 缺身份/跨用户/跨工作区/服务拒绝；在途切换身份不交付回执；取消本地接收后仍可查询已提交结果 |
| historical-read-after-next-save | R2之后仍精确返回R1；6.0/layoutForm原文与原hash保留，不以规范化内容验旧hash |
| exact-read-reject-latest / reject-hash | 错revision/resource/hash/算法/非法页面拒绝；不将latest伪装旧版本 |
| 历史与不可用 | head前进期间固定snapshot翻页；错snapshot/重复/缺cursor拒绝；缺能力零服务调用 |
| #105 已知消费 | mock HTTP transport验证真实资料GET路径/资源编码/两头/string definition/retCode；错资源/修订、401/403/404/302/500拒绝；未知强端口零HTTP |
| 模型隔离 | 保存、精确读、历史的stdio text及structuredContent无完整页面、私有示例文本或凭据；完整输出留程序端口 |

`python3 docs/archive/authoring-tickets-126/t04-verify-examples.py`：21 场景 / 32 步内部自洽。上述回归按相同语义实施，不把 checker 当消费者/服务实现测试。T04 候选/发布场景留 #145，执行场景复用 #144；本票未实现这些工具。

可重跑：

```sh
PYTHONPATH=metriccanvas-authoring/tool python -m unittest discover -s metriccanvas-authoring/test-harness/tests -p 'test_lifecycle*.py' -q
PYTHONPATH=metriccanvas-authoring/tool python -m unittest discover -s metriccanvas-authoring/test-harness/tests -p 'test_*.py' -q
python3 docs/archive/authoring-tickets-126/t04-verify-examples.py
```

需要 Python 3.12 与 Bundle 锁定依赖；stdio 成功样例的 `test-harness/lifecycle_stdio_server.py` 明确为外部边界替身，生产入口不导入它。服务提交后程序输出失败同样保持 unknown + 原 operationId，恢复后查询原结果，禁止按普通不可用换键重发。`test_lifecycle_stdio.py` 支持 `S4_LIFECYCLE_INSTALLED_ROOT`，可从临时工作目录启动安装产物 CLI 并用安装后的公开组合入口验证强端口替身；它不将替身装进生产模块。

## 精确文件范围

S4 作者（下列 Bundle 路径均相对 `metriccanvas-authoring/`）：

- `README.md`：仅新增生命周期使用节。
- `tool/pyproject.toml`：新 stdio entry 与自有 schema 的 sdist 包含项。
- `contracts/authored/lifecycle-request.schema.json`。
- `tool/metriccanvas_authoring/lifecycle_server.py`。
- `tool/metriccanvas_authoring/application/lifecycle.py`、`application/lifecycle_ports.py`。
- `tool/metriccanvas_authoring/adapters/inbound/lifecycle_mcp.py`。
- `tool/metriccanvas_authoring/adapters/outbound/lifecycle_http.py`、`adapters/outbound/lifecycle_spool.py`。
- `test-harness/lifecycle_stdio_server.py`。
- `test-harness/tests/test_lifecycle.py`、`test_lifecycle_http.py`、`test_lifecycle_stdio.py`。
- `test-harness/tests/test_distribution.py`：仅 sdist 精确集合加入新 schema。

证据作者：`docs/archive/authoring-tickets-126/t12-evidence.md`。S2 独立作者/生成：`tools/scripts/export-authoring-contracts.ts` 显式登记新 schema；Bundle `contracts/manifest.json`、`contract-lock.json`、`bundle.lock.json` 统一生成。没有改公共产品真源或快照；没有混入 S3 后续双 Skill 增量。

## 外部确认与真实联调

- **外部资料事实**：沿 #105 用户提供的 HTTP 契约消费，仅资源 GET 当前匹配；没有新增提供方确认。
- **外部确认仍待完成**：强保存/幂等作用域及期限/操作查询/原文 canonicalization/任意历史精确读取与分页；Relay 按用户注入、可信程序产物和轮资格；draftId 到不可变修订的权威映射。跟踪 #105/#106/#108。
- **真实联调**：本票无 Java/Relay/盘古真实服务调用。mock HTTP、stdio成功替身及隔离安装均属本仓证据；不计 M1/M3 通过，不关闭 #95。

给 S1/#146：四个公开工具与程序端口已实现；强 Saved 字段与 authoring-sync 一致，程序回执含 origin/base/operation 关联。`programToken`、`DraftRef` 和 `draftId` 不混同；事件仍只 `{draftId}`，真实解析能力保持不可用。Relay 边界可在组合测试中登记不可变输出为通知引用，轮资格另行核验。S0 验收集成并发布正式 SHA 后才解锁 #146。#138/#140/#144 齐备后另行登记 #145 工具范围，由 S1 做整票验收。

回退：撤销本票作者与对应生成提交；没有真实资产写入或数据迁移，移除本票 stdio 配置即可停止新增入口。已有内容/compatibility入口保持原行为。

## 最终交付记录

- S2 原导出/生成 `a3a23ebfa330d08c799dc9425b69f8f55b4dd019`，本树消费为 `ffdeccc5be24ff52d3ea0cf9beee535a7de68d7e`，包含四态补正。
- S2 最终锁 `9fd7c5b8609b0c5d08d01f20793034b83202301e`，精确来源 ffdeccc；本树消费为 **`f70a2f435e8ab68a156e74cb5191c34f2fcc78c2`**。仅两个作者文件摘要变化；其余生成产物/产品快照不变，旧 a3 锁不作为最终消费。
- 本树最终组合 f70a2f4：完整 Python **246 项通过**；Bundle **1342 摘要通过**；diff --check 通过。S2 报告标准导出器 `--check` **469/4/1 无漂移**；同一导出器改动在早期固定作者树运行两文件 13 项与 tests tsc 通过，最终补正只变 Python 两文件，未冒称重跑这些 TypeScript 检查。
- 离线 sdist `/private/tmp/s4-lifecycle-evidence/dist/metriccanvas_authoring-0.2.0.tar.gz`，98,392 bytes，SHA-256 `013626956e9b5c0991fee2a6e37dbd4d9709583371a8053cf4fb1e6f0bf6cf8f`。归档内 **46 个 Python 源文件**逐字节匹配最终组合；新 lifecycle schema、产品页面 schema 与 contract-lock 匹配；test-harness 不进入发行包。sdist 构建于 ffdeccc，随后 f70a2f4 仅变更不进入 sdist 的 Bundle 摘要锁；上述逐文件对比在 f70a2f4 实际执行。
- `uv build --offline --sdist`，随后 `uv pip install --offline --no-deps --target /private/tmp/s4-lifecycle-evidence/installed <sdist>` 完成。隔离的是作者包目录与工作目录，锁定依赖复用既有 Python 3.12 环境；未修改共享依赖环境，不声称离线重新安装了所有第三方依赖。
- 安装后 stdio **2 项通过**：从临时 cwd 启动安装产物真实 `bin/metriccanvas-lifecycle`，合法可信命令明确 CAPABILITY_UNAVAILABLE；安装后的公开组合入口在显式外部边界替身下保存/查询/精确读/历史成功，检查载入模块确实位于安装目录，模型 text/structuredContent 无文档或凭据。后者是安装后端口消费验证，不是生产 Java 保存成功。
- 证据目录 `/private/tmp/s4-lifecycle-evidence/`：`python-full.log`、`installed-stdio.log`、`package.json`、`dist/`、`installed/`。源码专项测试可直接重跑；没有上传临时文件或发布 registry。

本证据文档单独提交在上述固定实现/生成组合之后；其自身完整 SHA 由交给 S0 的回执列出，不在文件内自引用。正式交验要求 S0 合入后发布可消费 SHA，才通知 S1 执行 #146。
