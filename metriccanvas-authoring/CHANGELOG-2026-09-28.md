# 2026-09-28 内部同步变更说明

升级基线：`fd98a71ea061f799640a8d6a883e937e356a473b`（2026-09-23 Relay 产物所有权与契约说明）。目标：包含本文的本次整改提交，以交付回执的完整 Git SHA 固定。本文覆盖基线之后与公司内部 Authoring 服务相关的累计变化，以及本次预算和反馈整改；不要求公司同步平台 qiankun 等无关目录。

**采用最终快照，不逐条重放中间接入形态。** Bundle/Python 包版本仍为 `0.3.1`，平台工具协议仍为 `2.0`，可信轮次为 `authoring-turn/1.0`，页面 Schema 为 `6.11`；新内部工厂接口为 `authoring-adapters/1.0`，可选增强发现声明 `discovery/1.0`。不能只凭相同版本号判断源码相同。

## 1. 相对 fd98a71e 的累计变化

| 来源 | 最终变化 | 内部服务同步动作 |
|---|---|---|
| `fd98a71e` 的原交接 | 当时采用固定发行包及包外 `create_host_adapters()` 入口；文档中的 ZIP 哈希仅对应历史本地产物 | 历史包哈希不能验证本次代码；采用下述现行目录与工厂 |
| `3d20c6d2` 接入收拢 | 唯一交付目录为 `metriccanvas-authoring/`；`ownership.json` 与公共 lock 划分所有权；公共入口调用内部 `create_adapters()` | 迁移旧包外装配逻辑到内部 factory。中间出现的 `integrations/relay/` 独立扩展已经退役，不再安装额外 Relay 包 |
| `3260725d` 治理诊断 | 增加配置装配 helper、字段治理诊断；空声明保持显式语义，不从 aggregator 推断可加性 | 对照公共参考薄 Adapter，保留真实 HTTP/鉴权；显式注入 projection，使用 `check_data_context.py` |
| `e90a9a2c` 查询整改与增强发现 | 公共语义投影；默认 relaxed 查询预检；规范业务域/维度/粒度；可选增强发现、可信交互及持久任务 | 按[查询校验迁移](QUERY-VALIDATION-MIGRATION.md)和[发现接入](SEMANTIC-DISCOVERY-HANDOFF.md)更新内部消费与可选依赖 |
| 本次预算整改 | `Limits.calls/query_rounds/mutations/seconds/total_evidence_bytes` 和 `DiscoveryLimits.model_calls` 默认改为 `None` | 保留持久计数；检查内部 factory 是否显式注入旧上限，显式值仍生效。单次证据、超时、TTL、租约及授权门禁不变 |
| 本次发现修复 | fallback 的 `kind=metric` 匹配项新增规范 `businessDomain=Schema.name`；保留嵌套 metric 结构 | 查询直接使用返回的规范域名；不要用 schemaId、modelId 或短名称替代，也不要假定两条发现路径原始结构完全相同 |
| 本次保存诊断 | 参考 `KnownLifecycleHttp` 增加可选 `diagnostics` 回调，定位传输或回执校验阶段 | 定向合并到内部 Adapter 并接程序日志；公共同步不会覆盖内部实现 |
| 本次 Skill / 回归 | 逐需求核对 supported/unknown/unsupported 与来源；补齐绑定变化、交错轮次、取消/恢复及单次保存回归 | 同批升级完整 Skill；真实地域、时间与指标维度组合仍须内部验收 |
| 本次部署指纹 | 新增 `scripts/deployment_fingerprint.py` | 用实际服务 Python/PYTHONPATH 记录导入位置、公共/Skill 摘要、查询模式、内部源码摘要 |

完整增强发现变更另见 [2026-09-26 changelog](CHANGELOG-2026-09-26.md)。其中“模型有预算”的旧默认描述以本次 `None` 为准；显式配置上限仍受执行。知识库、解释模型、检索均为可选依赖；生产不得自动回退示例 mock。

## 2. 文件所有权与首次迁移

| 范围 | 所有者及同步方式 |
|---|---|
| `bundle.lock.json` 记录的公共文件 | 固定上游提交单向同步；包含公共 Tool、完整 Skill、契约、脚本、参考模板和本文 |
| `tool/metriccanvas_authoring/adapters/` | 公司内部独立维护：factory、Relay 事件/身份、HTTP、存储、配置与测试；不整目录覆盖 |
| `examples/adapter_template/` | 公共参考代码；只供初始化或定向移植，不证明真实接线完成 |
| 凭据、运行数据库、未知保存记录 | 部署方管理，升级前按公司策略留存；不进入公共源码或 Skill，不因升级/回滚删除 |
| Relay 的 MCP 注册、SkillLoader、进程内插件部署 | 公司内部维护。公共入口替换旧装配入口不代表可以删除进程内轮次和产物桥接职责 |

如果公司仍在 fd98a71e 形态，先清点包外入口、旧 `adapters/`、进程内插件和存储地址。同步脚本保留已存在的整个内部 adapters，不会替它补 factory 或新方法。因此首次迁移需要在保留真实认证、端点、映射和状态的前提下实现 `factory.py:create_adapters()`，返回 `AuthoringAdapters`；旧 `create_host_adapters()` 不能直接当作同名替换。

工厂必需的 current_turns、read/CAS、analysis_authorization、data_context/DQE、lifecycle_service/identities、relay_preview 及可选能力，按[现行接入说明](RELAY-HANDOFF.md)与[接口契约](contracts/authored/adapter-interface.md)接线。源码部署到 Relay 进程的插件仍需保留可信通道；不修改 Relay 核心。

## 3. 固定源码同步与重新安装

以下命令中的目录和 SHA 由内部实施者填入。`PUBLIC_REPO` 是已经取得目标提交的公共仓库，`INTERNAL_BUNDLE` 是公司工作区的 metriccanvas-authoring 目录。先用公司 Git 保存内部改动；对运行状态按既有备份策略留存。同步期间暂停对目标公共文件的并发编辑。

```sh
PUBLIC_REPO=/path/to/MetricCanvas
INTERNAL_BUNDLE=/path/to/company/metriccanvas-authoring
SYNC_REF='<本次交付回执中的完整 Git SHA>'

# 使用目标提交对应的同步器。默认只预览，不写文件。
python3 "$PUBLIC_REPO/metriccanvas-authoring/scripts/sync_upstream.py" \
  --source "$PUBLIC_REPO" --ref "$SYNC_REF" --target "$INTERNAL_BUNDLE"

# 核对 write/delete 清单后执行。
python3 "$PUBLIC_REPO/metriccanvas-authoring/scripts/sync_upstream.py" \
  --source "$PUBLIC_REPO" --ref "$SYNC_REF" --target "$INTERNAL_BUNDLE" --apply
```

源快照来自 `--ref`，不会把上游未提交内容带入公司。目标公共文件与旧 lock 不符时脚本停止，先将内部定制整理到自有 Adapter 或提出公共修复，不强制覆盖、不手改 lock。没有旧 lock 的历史目录可能触发同名冲突，应先按实际部署内容建立迁移副本；不要把干净的新目录误当作已经迁入内部逻辑。

整个内部 adapters 不存在时，同步会从模板初始化；已有目录保持原样。初始化后的 factory 仍会 `ADAPTERS_NOT_CONFIGURED`，必须接线。同步前后对内部文件做摘要比较，任何预期外改变都停止部署。

在完成内部定向合并后：

```sh
cd "$INTERNAL_BUNDLE"
# Python >=3.12；首次安装才创建虚拟环境。
python3.12 -m venv .venv
.venv/bin/python -m pip install ./tool
.venv/bin/python -m pip install -r tool/metriccanvas_authoring/adapters/requirements.txt
.venv/bin/python scripts/check_bundle.py
.venv/bin/python scripts/check_adapters.py
```

已有虚拟环境可直接从安装步骤开始。同版本 0.3.1 也须从本次本地源码重新安装，并核对实际导入摘要；不要复用历史 wheel/sdist。将完整 `skill/metriccanvas-platform-authoring/` 安装到实际 SkillLoader 目录，保持 workflows/references 同批；平台 MCP 服务名使用 `metriccanvas-platform-content`，命令指向本次安装环境。普通问数 Skill 不替代平台九工具入口。

## 4. 内部必须定向核对的行为

### 可信轮次与持久状态

同一用户指令的 query→compose/edit→save→preview 必须保持完整 binding 稳定；不按每次工具调用生成 turnId。不可变绑定和可变工作版本分开保存，调用按请求关联，不能通过共享 JSON 最后写入槽位或父进程共享环境切换用户。

新指令/澄清答复创建新轮；取消与状态消息仍指向原轮。重启后若 runId 改变，旧 resultRef 不能继续用，应重新取证；语义 taskRef 续接不授予跨轮查询权限。读工作稿不重置轮次或保存状态。保留真实持久数据库，取消累计预算不修复上下文竞态。

### 元数据、查询与能力覆盖

采用公共 `data.lab_projection`，内部只处理实际接口信封、鉴权和明确字段转换。若需宽松查询，提供可选 `current_for_query(policy)`；旧 `current()` 仍可用，但其提前治理拒绝不会被公共开关绕过。当前查询默认 relaxed，不免除执行环境、身份、授权、结果字段或保存校验。

同源发现/查询版本应一致，权限/元数据/治理变化需失效。规范化后的精确请求用于授权摘要；`M → month` 不等于内部接口 `yyyymm` 的自动映射。请求维度名、结果 queryField、显示标签分别核对，不机械互换。从 aggregator 推断可加性、缺省单位或中国区范围均不成立。

原始月报逐项检查整体、月度趋势、代表处、模型占比、区域×模型明细，并共同核对中国区/2026 上半年。相关业务域有维度不等于某指标支持组合；未命中和信息缺失保持 unknown。核心范围无法证明时说明缺口，由用户选择可接受范围后重新授权，不能静默替换全域数据或以纯文本页冒充完整报告。

### 单次保存与诊断

将本次 `examples/adapter_template/firstparty/lifecycle_http.py` 的诊断改动定向移植到内部实现，保留真实认证与 HTTP 契约。可注入 `diagnostics=record_event`，回调应快速写程序日志，不能写 MCP stdout。

- `send_started` 只证明发送尝试开始；`response_received` 带 HTTP 状态。
- `saved` 是验证过的回执；`rejected` 沿用现有明确拒绝状态。
- `transport_unknown` 区分 TIMEOUT/TRANSPORT_ERROR；`receipt_invalid` 指向固定响应字段路径，并可带受限格式业务码。
- 所有事件以 operationId 关联原冻结提交；不输出 URL、凭据、正文、SQL 或原始异常。诊断回调异常不改变保存结果。

unknown 可能已经落库。保留原 operationId 和工作稿，Java 对账当前记录；不重发、不更换轮次绕过、不将 unknown 认定为失败或成功。保存成功但交接失败只重试同一 artifactRef 的交接。ready 仍不证明前端实际显示。

## 5. 内部验收与回传

```sh
# 使用实际启动服务的 Python 和原有 PYTHONPATH；不要临时指向新源码来掩盖旧安装。
.venv/bin/python scripts/deployment_fingerprint.py \
  --bundle-root "$INTERNAL_BUNDLE" \
  --adapter-root "$INTERNAL_BUNDLE/tool/metriccanvas_authoring/adapters" > deployment-fingerprint.json
.venv/bin/python scripts/check_adapters.py --context-ref '<实际可信轮次引用>'
.venv/bin/python scripts/check_data_context.py
```

指纹脚本记录公共 Python 的实际导入路径、lock/Skill 摘要、查询策略及内部 Python 源码摘要。退出 0 只证明公共一致性/导入检查；adapter 未提供或无 Python 文件会显式报告，内部能力仍需独立验收。另记录 Relay 真正加载的 Skill 目录与摘要；Bundle 内摘要不能证明 SkillLoader 已更新。独立部署的 Relay 插件也应另采集版本。`check_data_context` 可能访问实际元数据服务，但不执行 DQE/保存。

按[内部验收清单](INTERNAL-VALIDATION-0.3.1.md)执行创建、编辑、跨子进程、授权拒绝、并发 CAS、未知保存、预览恢复和公共升级；再补充：

| 场景 | 通过依据 |
|---|---|
| 默认预算取消 | 至少 4 批独立合法查询不因旧默认 3 轮阻断；显式上限仍按配置生效 |
| 两会话交错/取消/重启 | 完整 binding 无串线；旧轮 resultRef 拒绝；未取消轮可恢复 |
| 两条发现消费 | 实际使用分支返回的 canonical businessDomain 能用于查询；SemanticCatalog/fallback 输出按 kind 分辨 |
| 保存回执未知 | 一次发送、保留冻结记录，关联诊断与 Java 当前记录，无自动重发 |
| 需求覆盖 | 每项有来源与能力结论；地域、时间、指标维度组合及实际页面内容一致 |

回传公共完整 SHA、内部提交/dirty、Bundle lock 摘要、实际导入/Skill 摘要、查询模式，各场景 pass/fail/blocked/not-run，DQE/Java/产物接收次数及脱敏关联 ID。不得回传凭据或完整业务数据。

## 6. 验证边界、未实施事项与回滚

本次本地完整 Authoring harness **463 项通过（45.278 秒）**；保存诊断最终定向复验 **11 项通过**；两份 Skill 静态校验与契约检查通过。新增本文会由生成器重新纳入 Bundle lock；逐文件摘要以最终提交为准。本地模型评测为 scripted-no-model，不能作为真实 DS 验收。

真实内部 Relay/Java/DQE、DS 模型及浏览器未运行。实际可信事件与重启 runId 语义需内部核对；元数据重试/缓存尚未实施。A2 稳定标识迁移、A3 统一发现就绪协议仍为待裁决提案，没有随本次交付启用。

若需回滚，固定公司上一份已验证的公共与内部提交，重新安装对应 Tool 和完整 Skill，保留状态库及未知保存记录，再验证工厂和兼容性。`sync_upstream.py` 不能把 fd98a71e 这种所有权迁移前的提交直接作为新式同步源；回到旧形态须恢复公司已审定的完整部署快照，不能仅退公共包而保留不兼容的新 factory。Git push 不代表已经构建、发布或部署发行包，CI 状态另见交付回执。
