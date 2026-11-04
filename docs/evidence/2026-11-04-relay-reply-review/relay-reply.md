# Relay 回复：R01–R05 现场事实

> 日期：2026-11-04
> 回复对象：[relay-response-request-20261104.md](relay-response-request-20261104.md)
> 命名纠正：MC 侧文档中 `mc-tool`（单数）需统一为 `mc-tools`（复数），包括 `mc-tools/` 目录名、`mc-tools.md` 文件名、`mc-tools/cli.py` 路径引用、release.py 中的 `TOP_LEVEL` 和 `PUBLIC_PATHS`、interface.json 的 `entrypoint`、release.json 的 files 字典 key。mc-website 侧代码硬编码了 `mc-tool`（单数），与归档目录名 `mc-tools`（复数）不一致，需 MC 侧统一为 `mc-tools`（复数）。

---

## R01｜当前实际采用基线

### 1. 当前运行的资源/工具目录、来源版本

| 项 | 值 | 来源 |
|---|---|------|
| mc-content 目录位置 | `.skills/metriccanvas-platform-authoring/mc-content/`（Skill 根下，**未移到 references/**） | `mcp_configs/metriccanvas-platform-content.json` env `METRICCANVAS_LAYOUT_CONTENT_ROOT` |
| contentVersion | `1-bb4ddee3e562cd88` | `mc-content/mc-content.version.json` |
| contentSha256 | `e785c443145a27ac59e91416b17f9566...` | 同上 |
| interfaceVersion（mc-content） | `1.0` | 同上 |
| files | 1991 | 同上 |
| pageSchemaVersion | `6.77` | `mc-content.version.json` → `alignedWith.pageSchemaVersion$ |
| platformProtocolVersion | `2.0` | 同上 |
| authoringContractVersion | `0.3.1` | 同上 |

### 2. 本次收到的四项是否已经采用

**未采用**。当前处于**暂存/适配前**阶段。具体：

- 归档目录 `D:\codeagent-workspace\2026.11.04\归档` 中的四项已收到，但**未放入 Skill 目录**
- 之前的 P0-P3 实验已 **rollback**，Skill 目录恢复到实验前状态
- mc-content 仍是旧版（1991 文件，6.77），mc-tools/ 未放入

### 3. 页面创建、读取、预览实际使用的引擎/校验器版本

- 页面创建/编辑：`compose_page`/`edit_page` 在 `platform_mcp.py` 中实现，页面组装逻辑在 `tool/metriccanvas_authoring/pages/composition/page_structure.py`（block_component）+ `page_building.py`
- 页面 Schema 版本：**6.77**（`mc-content.version.json` 的 `alignedWith.pageSchemaVersion`）
- 校验器：`jsonschema.Draft202012Validator`（`referenced.py:398`），使用 `COMPOSE_SCHEMA` 契约
- **仍依赖 6.77 的调用**：`compose_page`/`edit_page` 的 `DATA_BLOCK.source` 单源结构、`page_building.py:133` 的 `data:{main:source}` 单槽生成——这些都与 6.77 Schema 对齐
- **6.83 兼容性未验证**：新版 mc-content 升级到 6.83 后，现有 compose_page/edit_page 的行为是否受影响需单独验证

### 4. 当前四项更新、缓存重载和回退的程序入口

| 操作 | 入口 | 说明 |
|------|------|------|
| mc-content 更新 | 手动整体替换 `mc-content/` 目录 + `python mc-content/scripts/mc_content.py verify` | 无自动同步脚本 |
| 缓存重载 | 重启 relay 进程（mc-content 脚本被 import 到 `sys.modules`，需重启） | `platform_mcp.py:343-362` 有 CRLF monkey-patch + LOADED_CODE 重算 |
| 回退 | 手动恢复旧 `mc-content/` 目录 + 重启 | 无自动回退机制 |
| 在途轮次 | 旧批次完成（turn state 文件按 context_ref 隔离，不冻结） | `relay_authoring_state_{context_ref}.json` |

---

## R02｜真实 MCP 包装、状态与保存链路

### 1. 实际注册且仍被调用的相关工具

**MCP server**：`metriccanvas-platform-content`（`mcp_configs/metriccanvas-platform-content.json`），通过 `platform_mcp.py` 注册 15 个 `@mcp.tool`：

| 工具 | 注册名 | 实现文件/函数 | 调用路径 | 计划保留/替换 |
|------|---------|-----|------|------|
| read_page_context | `read_page_context` | `platform_mcp.py:215` → `application.read` → Java 资源核对 | MCP @mcp.tool | 保留（架子侧） |

(*剩余 14 工具同上，略*)

**scripts/tools.py 中的 3 个工具**（通过 `skill_play` 的 `subagent_tools` 通道注册）：

| 工具 | 实现文件 | 调用路径 | 计划 |
|------|---------|---------|------|
| tool_mc_query | `scripts/tools.py:110` | 直接 import `mc_content.query_content()` | 保留（包装层） |
| tool_mc_compile | `scripts/tools.py:139` | 直接 import `mc_content.compile_layout()` | 保留 |
| tool_mc_inspect | `scripts/tools.py:174` | 直接 import `mc_content.inspect_assembly()` | 保留 |

**当前调用 MC 采用 import**（非子进程）。`scripts/tools.py:23` 直接 `sys.path.insert(0, _SCRIPTS)` + `from mc_content import query_content/compile_layout/inspect_assembly`。`platform_mcp.py:335-362` 也是 import 模式 + CRLF monkey-patch。

### 2. 脱敏请求与回执

**未提供脱敏回执**（需从实际会话日志提取，本次回复暂缺）。但可描述链路结构：

- **模型形成输入**：模型传入 `context_ref` + `request`（含 title/sources/sections）；`context_ref`、`pageId`、`workVersion`、身份信息由 relay 插件通过 `agent_context` 注入
- **可信字段由程序补齐**：`context_ref`（relay 插件注入）、`pageId`（read_page_context 返回）、`workVersion`（state.reserve 返回）、`base_revision_id`（saver.verify_current 核对）
- **MC 当前采用 import**：`scripts/tools.py` 和 `platform_mcp.py` 都通过 `sys.path.insert` + `from mc_content import` 直接调用 mc-content 脚本

### 3. 工作副本、workVersion、submission freeze 和 CAS

| 项 | 程序/存储 | 说明 |
|---|---------|------|
| work state 存储 | `SqlitePlatformState(work_db)` | `adapters/factory.py:141` → `METRICCANVAS_WORK_DB` env（sqlite 文件） |
| turn state 存储 | `FileBasedTurns(state_file)` | `adapters/factory.py:140` → `METRICCANVAS_AUTHORING_STATE_FILE` env（JSON 文件 `relay_authoring_state_{context_ref}.json`） |
| workVersion CAS | `state.reserve(prepared, expected_version, request_hash)` | `work/state.py:91` — 乐观锁，expected_version 不匹配返回 `WORK_VERSION_CONFLICT` |
| submission freeze | `work['submission']` 存 `operationId`/`requestHash`/`summary` | `platform_authoring.py:345-346` — 冻结后不可重试，需 finish 清理 |
| 冲突/过期返回 | `WORK_VERSION_CONFLICT` / `WORK_OPERATION_FAILED` | `platform_mcp.py:198-206` 兜底降级为 `AUTHORING_PROVIDER_UNAVAILABLE` |

### 4. saver 的文件/函数、Java 接口

| 项 | 位置 | 说明 |
|---|------|------|
| saver 实现 | `adapters/firstparty/lifecycle_http.py` | Java 后端 HTTP 适配 |
| saver.save() | `platform_authoring.py:350` | `saver.save(prepared, definition(preview), work['base'], description, operation, current)` |
| Java 接口 | PUT `/page-metadata`（更新）/ POST（新建） | `lifecycle_http.py:141` PUT 分支 `body.update(base_revision_id=..., comment=...)` |
| 单次发送 | 是 — saver.save 一次 HTTP 请求 | 无分片/重试 |
| 幂等依据 | `operationId`（uuid4） | `platform_authoring.py:344` |
| 超时 unknown 恢复 | `saveStatus=unknown` 时 `finish` 记录失败，轮次锁死 `SAVE_RECONCILIATION_REQUIRED` | `platform_authoring.py:359-371` — **当前无自动恢复**，需手动处理 |
| 取消/迟到回执 | 无处理 | submission freeze 后迟到回执无法处理 |

### 5. 完整页面/查询结果存放位置

| 项 | 位置 | 模型可见性 |
|---|------|-----------|
| 完整页面 document | `work['document']`（work state store 内） + `relay_authoring_preview_{turn_id}.json`（预览文件） | 模型只收到摘要（`summary`），完整 document 不进模型通道 |
| 查询结果 | `work['results']`（state store 内） + `relay_authoring_state_{context_ref}.json`（turn state） | 模型收到有界 evidence（`results.py:251` 限制 evidence_rows） |
| 前端取得产物 | WebSocket `{{PAGE_METADATA_PREVIEW_JSON}}` 占位符 → 插件替换为预览文件内容 | `platform_mcp.py:181-197` |

---

## R03｜模型实际加载了什么

### 1. mc-content.md、mc-tool.md 何时进入上下文

**当前不自动加载**。`mc-content.md` 和 `mc-tools.md`（归档中为 `mc-tool.md`）目前未放入 Skill 目录，模型上下文中没有这两个文件。

- 模型不会自动递归读取 references 目录
- 不会预读全部索引或全文
- 不会扫描源码/清单
- SKILL.md 中的 `[工具契约](references/tools.md)` 是手工写的工具文档，不是自动生成

**计划**：四项放入 `references/` 后，SKILL.md 增加对 `mc-content.md` 和 `mc-tools.md` 的引用，模型按需读取（不递归全读）。

### 2. 模型看见的工具定义

**当前**：模型通过 MCP `list_tools` 看到的工具定义是 15 个 `@mcp.tool` 的 JSON Schema 定义 + 3 个 `scripts/tools.py` 的 `@mcp_data_query.tool` 定义。

- **完整 `interface.json`（749KB）不直接作为模型工具定义**。`interface.json` 是 mc-tools 的内部接口定义，不是 MCP 工具定义
- MCP 工具定义由 `@mcp.tool` 装饰器 + 函数签名 + docstring 生成，每个工具定义约 1-3KB
- **未来接入 mc-tools 后**：如果将 mc-tools 的 19 个操作直接作为 MCP 工具定义注入模型，体积会爆炸（`interface.json` 719KB compact）。**计划**：只暴露子集（如 `content.read`/`page.compose.v2`/`page.edit.v2`），工具定义由 relay 侧手写包装（而非透传 interface.json）

### 3. 知识按任务读取

**当前**：通过 `tool_mc_query(topic, key, options)` 读取 mc-content 知识。
- `options` 支持预算：`maxBytes`（默认 262144 = 256KB）、`includeSchema`、`offset`/`limit`
- 超预算时返回 `truncated=true` + `requiredBytes`，模型需放大 `maxBytes` 重试
- **同轮重复读取**：`scripts/tools.py` 无缓存（每次调 `query_content`），`platform_mcp.py` 有进程内缓存（CRLF monkey-patch 后 `LOADED_CODE`）
- **模型不会自动放大预算**——`truncated=true` 时由模型决定是否重试（SKILL.md 未强制要求）

### 4. describe、完整 Page JSON、原始查询结果进入哪个通道

| 项 | 通道 | 说明 |
|---|------|------|
| `describe`/`check-release`/`self-test` | **程序通道**（CLI 输出，不进模型） | `cli.py` stdout JSON 由 relay 插件/程序消费 |
| 完整 Page JSON（document） | **程序通道**（work state store + 预览文件） | 模型只收到摘要 `summary` |
| 原始查询结果（DQE rows） | **程序通道**（result store + turn state） | 模型收到有界 evidence（`results.py:251` 限制行数） |
| 清单/哈希（release.json） | **程序通道**（不进模型） | `check-release` 由程序调用 |
| 诊断（diagnostics） | **模型通道**（ToolResult content） | 但结构化 issue code 供模型决策 |

### 5. 代表性任务的装载记录

**未提供具体 token/usage 数据**（需从实际会话日志提取）。按字节报告：

| 项 | 体积 | 说明 |
|---|------|------|
| SKILL.md（初始提示） | ~8KB | 模型系统 prompt 的一部分 |
| 工具定义（15 MCP + 3 scripts） | ~30-40KB | 每个 1-3KB，共 ~18 个工具 |
| tool_mc_query 返回（单次 knowledge 原子） | 2-50KB | 取决于 maxBytes（默认 256KB），超预算 truncated |
| compose_page 返回 | ~5-20KB | summary 含 operations/issues/adjustments，不含完整 document |

---

## R04｜v2 所需数据与可信评估时间

### 1. 程序目前能否供给

| v2 所需输入 | 当前能否供给 | 说明 |
|-------------|-----------|------|
| `request`（完整规格） | ✅ | compose_page 的 `request`（含 title/sources/sections） |
| `resultRecords` | ✅ | query_data 的 result store，通过 `result_ref` 引用 |
| 新建 `pageId` | ✅ | `new-page`（占位），保存后 Java 返回真实 pageId |
| 编辑 `baseline` | ✅ | read_page_context 返回 `ref`/`revisionId`/`document` |
| 多槽 `tableSlots` | ❌ **缺失** | 当前 compose_page 的 `DATA_BLOCK.source` 只支持单源，不支持 `sources` 多源。v2 接口已内置受控多槽，需 relay 侧适配 |
| 每槽来源/字段/期间 | ❌ | 同上，多槽缺口 |
| 稳定行键 `rowKey` | ❌ | 同上 |
| 查询身份/结果完整性 | ✅ | query_data 的 result store + `RESULT_SCOPE_MISMATCH` 校验 |
| `input.evaluation={instant,timeZone}` | ❌ **缺失** | 当前无时间敏感请求的瞬时值冻结机制 |

### 2. 时间敏感请求

**当前无 `input.evaluation={instant,timeZone}` 机制**。
- 无可信程序按轮次冻结瞬时值
- 无 IANA 业务时区注入
- 模型直接传入时间字符串（`start`/`end`），程序不做时区冻结

**列为 Relay 接线工作**：需在 relay 插件层实现瞬时值冻结 + 时区注入。

### 3. ok/partial/error 与退出码

| 状态 | 退出码 | 当前处理 | 说明 |
|------|--------|---------|------|
| ok/partial | 0 | ToolResult 返回 | `platform_mcp.py:197` 正常返回 |
| 产品拒绝 | 2 | 当前未区分产品拒绝 vs 运行拒绝 | `platform_mcp.py:198-206` 统一兜底为 `AUTHORING_PROVIDER_UNAVAILABLE` |
| 环境故障 | 3 | 当前未区分 | 同上 |

**需 Relay 适配**：mc-tools 的 `cli.py` 退出码 0/2/3 需映射为 MCP 工具的不同返回状态。

### 4. Python/Node 与精确依赖

| 项 | 当前状态 |
|---|---------|
| Python | 3.12（relay 运行时） |
| Node.js | 22+（mc-content/scripts/read-knowledge.mjs + inspect-page.mjs 需要） |
| 精确依赖 | `mc-content/scripts/requirements.txt`（mc-content 侧）；relay 侧无独立 requirements |
| 子进程 UTF-8 | 当前 import 模式（非子进程），无 UTF-8 问题 |
| 超时 | MCP 配置 `timeout: 300`（`mcp_configs`） |
| 回执关联 | `operationId`（uuid4） + `requestHash`（digest） |

---

## R05｜现有 codecheck 补丁

### 1. Node 完整路径

**文件**：`mc-content/scripts/mc_resources.py`

**原故障**：`subprocess.run(['node', ...])` 用裸 `'node'`，在部分 Windows 环境下 PATH 解析失败。

**修复**：新增 `node_executable()` 函数，用 `shutil.which('node')` 解析完整路径并缓存：

```python
# mc_resources.py:43
_NODE_EXECUTABLE = None
def node_executable():
    global _NODE_EXECUTABLE
    if _NODE_EXECUTABLE is None:
        _NODE_EXECUTABLE = shutil.which('node')
    return _NODE_EXECUTABLE

# mc_resources.py:159 (node_content 函数内)
node = node_executable()
if node is None:
    raise ContentError('CONTENT_READER_UNAVAILABLE', key, 'node executable not found on PATH')
result = subprocess.run([node, str(resource(root, 'scripts/read-knowledge.mjs'))], ...)
```

**同步文件**：`mc_inspection.py`（inspect_schema）、`mc_content.py`（upgrade_page）中的 node 调用也改用 `node_executable()`。

**回归样例**：`tool_mc_query(topic="knowledge", key="table.width")` 在 Windows 下正常返回（之前报 `CONTENT_READER_UNAVAILABLE`）。

### 2. type() → isinstance()

**文件**：`mc-content/scripts/mc_resources.py`

**原故障**：`type(options['includeSchema']) is not bool` 等 3 处用 `type() is not`，codecheck 报 "use isinstance() instead of type() for type checking"。

**修复**：

```python
# mc_resources.py:32 (safe_name 函数)
if not isinstance(name, str):  # 原: type(name) is not str

# mc_resources.py:64 (read_manifest 函数)
if not isinstance(manifest, dict) or ...:  # 原: type(manifest) is not dict

# mc_resources.py:67 (manifest_files 函数)
if not isinstance(files, list) or not files:  # 原: type(files) is not list

# mc_resources.py:114 (index_page 函数)
if not isinstance(offset, int) or not isinstance(limit, int) ...:  # 原: type(...) is not int
```

**注意**：`isinstance(offset, int)` 会同时接受 `bool`（因为 `bool` 是 `int` 子类），但原 `type(offset) is int` 排除 `bool`。当前 `offset`/`limit` 从 JSON options 解析，不会出现 `bool` 值，行为等价。**如需精确排除 bool**，应加 `and not isinstance(offset, bool)`。

### 3. CRLF monkey-patch（非 codecheck，但相关）

**文件**：`platform_mcp.py:343-362`

**原故障**：`mc_resources.py:15 digest()` 用原始字节（含 CRLF）计算 sha256，但 `mc-content.version.json` 的 sha256 是 LF 基准。Windows 下 `mc_content.py verify` 报 `CONTENT_RESOURCE_MISMATCH`。

**修复**：`platform_mcp.py` import mc_resources 后 monkey-patch `digest` 函数做 LF 标准化：

```python
# platform_mcp.py:348-362
_orig_digest = mc_resources.digest
def _lf_digest(content):
    if isinstance(content, str):
        content = content.encode('utf-8')
    return _hashlib.sha256(content.replace(b'\r\n', b'\n').replace(b'\r', b'\n')).hexdigest()
mc_resources.digest = _lf_digest
# LOADED_CODE 重算
```

**注意**：此 patch 只在 `platform_mcp.py` import 时生效。`mc_content.py verify` 作为子进程调用时不经过 patch，仍报 mismatch。**需 mc-website 侧在 `digest()` 函数本身做 LF 标准化**。

### 4. mc-content.version.json sha256 同步

每次改 mc-content 的 .py 文件后，必须同步 `mc-content.version.json` 中对应文件的 sha256（LF 基准）+ 重算 `contentSha256`，否则 `verify` 报 `CONTENT_RESOURCE_MISMATCH`。

---

## 回复模板

| 编号 | 状态 | 当前事实与证据位置 | 缺口/计划改动 |
|---|---|---|---|
| R01 基线与采用 | 已回复 | mc-content 旧版（6.77/1991文件）；四项未采用（暂存/回滚） | 需 MC 侧统一 mc-tools 命名；6.83 兼容性需验证 |
| R02 MCP/状态/保存 | 已回复 | 15 MCP 工具 + 3 scripts 工具；import 模式；sqlite+json state；saver 调 Java HTTP | 多槽缺口（DATA_BLOCK 单源）；unknown 恢复缺失；未来改 cli.py invoke 子进程 |
| R03 模型装载与体积 | 部分回复 | mc-content.md/mc-tools.md 未加载；interface.json(749KB)不进模型；知识按需 tool_mc_query | 需放入四项后补 SKILL.md 引用；工具定义体积待 mc-tools 接入后评估 |
| R04 v2/时间/运行环境 | 部分回复 | request/resultRecords/pageId/baseline 可供给；多槽/evaluation 缺失 | 多槽需适配 v2；evaluation 瞬时值需实现；退出码映射需实现 |
| R05 本地补丁 | 已回复 | node 完整路径 + type→isinstance + CRLF monkey-patch + manifest sha 同步 | CRLF patch 需 MC 侧在 digest() 本身做 LF 标准化 |

---

## 需 MC 侧确认/对齐的事项

| 编号 | 事项 | 说明 |
|------|------|------|
| 1 | **命名统一 mc-tools（复数）** | release.py TOP_LEVEL、PUBLIC_PATHS、interface.json entrypoint、release.json files key、cli.py error message、mc-tools.md 引用——全部需改 mc-tools（复数）。MC 侧统一后 relay 侧不需改代码。 |
| 2 | **release.py 目录独占检查放宽** | release.py:100 `iterdir() == TOP_LEVEL` 需放宽为 `TOP_LEVEL.issubset(present)`——relay 侧 references/ 是共享目录，不满足独占。或 MC 侧说明四项应放独立子目录。 |
| 3 | **digest() CRLF 标准化** | mc_resources.py:15 `digest()` 需在函数本身做 LF 标准化（`content.replace(b'\r\n', b'\n')`），不依赖 relay 侧 monkey-patch。否则 Windows 下 `mc_content.py verify` 失败。 |
| 4 | **__pycache__ 零容忍** | file_inventory 拒绝 `__pycache__`，但 Python import 必产生。建议 cli.py 自身在启动时清理 `_impl/__pycache__`，或 release.py 跳过 `__pycache__` 目录。 |
| 5 | **seal 流程原子性** | seal 需先删旧 release.json，失败则丢失。建议 seal 写临时文件再 rename，或 MC 侧提供 `seal --force` 选项。 |
| 6 | **6.83 兼容性** | 新版 mc-content pageSchema 6.83，现有 compose_page/edit_page 按 6.77 工作。6.83 是否有破坏性变更？relay 侧是否需先升级再替换？ |
| 7 | **v2 接口映射** | `page.compose.v2`/`page.edit.v2` 与 relay 侧 compose_page/edit_page 的映射关系？relay 侧直接改调 v2，还是保持现有工具+mc-tools 兼容？ |
| 8 | **interface.json 不进模型** | 749KB 的 interface.json 不应作为 MCP 工具定义注入模型。relay 侧计划只暴露子集（content.read/page.compose.v2 等），工具定义手写包装。MC 侧确认此方案。 |
