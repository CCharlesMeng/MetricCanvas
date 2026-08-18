# IOC 数据开发工作台 — 可视化插件设计(原型收敛稿)

> 版本:0.1.0-draft · 2026-08-18 · 状态:已与用户确认原型(grilling + 3 轮 UI 原型迭代)
> 对应插件:`dsh-plugin-ioc-data-dev`(本仓库)
> 目的:把 IOC 数据开发的长流程、复杂数据结构与确认逻辑可视化,让多人接力的每个接棒人一眼看到"现在卡在哪、等谁、缺什么"。

## 0. 设计原则(来自用户确认)

1. **单机视角 + git 共享**:每个接力人各自 checkout 仓库,工作台读自己本地的 feature 目录。多人通过 git 同步,工作台显示的是本地磁盘真实状态。
2. **一个 feature 多会话接力**:数据源是磁盘而非会话内存,所以会话 A 推进到一半,会话 B 打开工作台看到同一份进度。
3. **流程很长(一轮 ≥1 天,来回 n 次,线下沟通多)**:可视化首要回答"卡在哪、等谁、缺什么"。
4. **A 流水线胜出**(比看板直观),但看板的"阻塞/接力"信息融合进流水线(卡点标注)。
5. **血缘图必须保留,且方向是 页面组件字段 → ADS 层 → DWS/DWD → 贴源表(最多四层)**,随进度演进逐渐丰富。

## 1. 总体架构

```
┌─ 本地电脑 ─────────────────────────────────────────────┐
│  DSH 进程 (Node)                  浏览器页面 (GUI)       │
│  ┌──────────────────┐            ┌──────────────────┐  │
│  │ host 半(现有)     │            │ client 半(新增)   │  │
│  │ · ioc_stage_gate │            │ · tool 卡片       │  │
│  │ · ioc_validate   │            │ · 侧边栏工作台     │  │
│  │ · 新增:只读接口  │◀──fetch───▶│ · feature 切换     │  │
│  │   /ioc-api/*     │   JSON      └──────────────────┘  │
│  └────────┬─────────┘                                    │
│           │ 读磁盘                                        │
│  codespec/changes/<version>/<feature-id>/                │
│  (manifest / 产物 / 澄清项 / SQL / 证据)                  │
└──────────────────────────────────────────────────────────┘
```

- **数据通道**:host 半新增只读 HTTP 端点(等效"浏览器读本地文件"),client fetch 同源接口(DSH 无 CSP 限制)。
- **生命周期**:跨会话一致,因为数据源是磁盘。

## 2. 数据接口(host 半)

| 端点 | 方法 | 参数 | 返回 |
|------|------|------|------|
| `GET /ioc-api/features` | GET | — | 自动发现 `codespec/changes/<version>/<feature-id>/`,返回 feature 列表(含 manifest 摘要) |
| `GET /ioc-api/feature?path=<feature目录>` | GET | feature 目录绝对/相对路径 | 该 feature 完整状态 JSON(见 §3) |
| `GET /ioc-api/feature/tables?path=...` | GET | 同上 | 血缘节点/边数据(从 manifest+设计+绑定解析) |

实现:`ctx.webServer.register({kind:'prefix', path:'/ioc-api', handler})`,注入 `['webServer']`。路由 handler 只读解析文件,不写磁盘(只读原则,CORE-AX10 工具失败禁止落盘不涉及本接口,但保持只读)。

## 3. feature 状态 JSON(核心数据契约)

```jsonc
{
  "feature_id": "fw-2026-0818-001",
  "feature_name": "客户洞察地图月报 ADS 表",
  "main_path": "data",               // data | subject
  "engine": "hive",
  "version": "0.1.0",
  "gates": {                         // 12 门禁
    "data_design": "pass",
    "ads_clarification_applied": "not_started",
    "...": "..."
  },
  "artifacts": {                     // 13 产物
    "delta-design-ads.md": "done",
    "...": "..."
  },
  "stages": [                        // 主路径阶段(带状态推导)
    {"id": "ads-design", "status": "done", "gates": ["data_design"]},
    {"id": "ads-clarification-apply", "status": "current", "gates": ["ads_clarification_applied"]},
    "..."
  ],
  "clarifications": [                // 澄清项(CORE-AX8)
    {"id": "CL-001", "question": "客户活跃口径:月内成交还是访问?", "status": "closed", "priority": "P0", "owner": "张工", "closed_by": "张工"}
  ],
  "indicators": [                    // 指标生命周期 v0→v1→v2→v3
    {"name": "区域客户活跃数", "stage": "v2", "ads_binding": "ads_db_marketing.ads_dm_customer_active_m.cust_active_cnt", "bound": true}
  ],
  "lineage": {                       // 血缘(§5)
    "nodes": [{"id": "ads_active", "name": "ads_dm_customer_active_m", "layer": "ADS", "grain": "月/客户/区域", "engine": "hive", "fields": [...]}],
    "edges": [{"from": "consume_active", "to": "ads_active", "kind": "bound|agg|map", "phase": "ads-design|sql-generate|job-create"}]
  }
}
```

阶段状态推导规则:`gates.pass` 计数 + 产物 done 集合,推导每阶段 done/current/todo;当前阶段 = 第一个存在未置位出口门禁的阶段。

## 4. 视图 1:流水线主视图(默认)

- 16 阶段纵向流水线(data 主路径;subject 13 阶段同样支持),节点三态:done/current/todo
- 关键阶段旁标注出口门禁 + 状态(✓ pass / ◌ 未置位)
- 卡点阶段标注 `🔴 等人工`(当出口门禁未置位且依赖人工,如澄清闭环)
- 顶部横幅:当前卡点摘要(卡在哪、等谁、缺什么,来自澄清项 open + 门禁未置位)
- 顶部统计:阶段完成数 / 门禁通过数 / 产物完成数 / ADS 表数
- feature 切换:列表(自动发现) + 目录选择(B+C 组合),切换后整个工作台数据源切换

## 5. 视图 2:血缘演进图(消费端反向追溯)

- **方向**:页面组件字段(消费端)→ ADS 层 → DWS/DWD → 贴源表(最多四层,封顶)
- **三层布局列**:消费端 / ADS 层 / DWS-DWD / 贴源表
- **演进阶段**(切按钮看血缘"长出来"):
  - `ads-design`:指标字段 → ADS 字段(虚线=字段绑定)
  - `sql-generate`:+ DWS/DWD 源(实线=聚合 SUM/COALESCE),✦ 标记新增
  - `job-create`:+ 贴源表(最深一层)
- **表节点下钻**:表级视图默认(只列字段名),点击节点 → 详情面板显示字段级绑定表(字段/类型/来源/分层/状态)+ 高亮该表上下游边
- 消费端节点可点:显示指标口径(如 CL-001 裁定记录)与绑定目标

## 6. 视图 3:工具调用卡片(tool.call.toolview)

| 工具 | 卡片内容 |
|------|----------|
| `ioc_stage_gate` | 门禁结果卡片:阶段名、所需门禁逐项 PASS/BLOCKED、阻塞原因;BLOCKED 时红色横幅 |
| `ioc_validate` | 校验矩阵:每个校验器(PASS/FAIL 数)、失败项摘要(文件+规则) |

注册方式:`ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({name, key:'<tool>', ...}, Component))`。
keyed 命中替换通用工具行,未命中回退通用行——零侵入。

## 7. 插槽与打包

- client bundle 手写 `window.__ModuleLoader__.load({id, factory})` 格式(tsdown 仅生成器,可手写)
- 依赖仅用平台 seed:react / react/jsx-runtime / ui-slots / ui-primitives;其余内联
- package.json 增补:`dsh.client: {platform:'web', inject:[...]}` + `exports["./client"]`
- slot 注册:
  - `tool.call.toolview`(keyed: ioc_stage_gate / ioc_validate)
  - 侧边栏入口(待定:sidebar.footer.action 或自定义 workspace 视图)

## 8. 分批计划

- **第一批(实现中)**:host 只读接口 + package.json client 声明 + tool 卡片(ioc_stage_gate / ioc_validate)+ 侧边栏工作台(流水线 + 卡点 + feature 切换)
- **第二批**:血缘演进图(消费端反向 + 三阶段 + 表下钻)
- **第三批(可选)**:知识库基线对照(维度注册表、规范约束叠加);澄清项在界面直接查看/跟踪

## 9. 约束与边界(不做什么)

- 工作台**只读**:不做门禁置位/澄清关闭(遵守 CORE-AX9 门禁纪律、CORE-AX8 澄清人工裁定);操作闭环仍在对话中由 AI + 工具完成
- 血缘方向固定为消费端反向,深度 ≤4 层(ADS→DWS/DWD→贴源表)
- 单机视角:只读本机 feature 目录;多人同步靠 git(不实现实时协作)
- 不修改 DSH 本体;全部改动在 ioc-data-dev 插件仓库内

---

## 10. 实现状态(第一批已完成并验证)

> 2026-08-18 实机验证通过。以下改动全部落在 `ioc-data-dev/` 插件仓库内,不碰 DSH 本体。

| 文件 | 状态 | 说明 |
|------|------|------|
| `dsh/api.js` | ✅ 新增 | host 半只读接口:`/ioc-api/features`(自动发现)+ `/ioc-api/feature`(详情)+ `/ioc-api/feature/tables`(血缘,第二批填充) |
| `dsh/client.js` | ✅ 新增 | 手写 `__ModuleLoader__` bundle:3 个 slot 注册(见 §11) |
| `dsh/index.js` | ✅ 修改 | `ctx.inject(['webServer'], (webCtx) => webCtx.effect(() => registerIocApi(webCtx)))` 挂载接口 |
| `package.json` | ✅ 修改 | 补 `dsh.client`(platform web + inject 边)+ `exports["./client"]` |

**已验证事实**(迁移后可直接信任):
- client bundle 在 `/plugins/dsh-plugin-ioc-data-dev/client.js?rev=<hash>` 正常 serve,进 `__DSH_BOOT__` 图谱
- `/ioc-api/features?root=<仓库根>` 正确发现 `codespec/changes/<version>/<feature-id>/` 下的 feature
- `/ioc-api/feature?path=<feature目录>` 返回完整状态:阶段推导(current=第一个未过门禁阶段)、澄清项(含 P0/owner)、门禁/产物统计
- 门禁/校验卡片 4 种场景渲染验证通过(PASS/BLOCKED × PASS/FAIL)
- 浏览器实测:侧边栏出现"IOCC 工作台"卡片
- 既有测试 `tests/dsh-index.test.js` 2/2 通过(用 `node --test tests/dsh-index.test.js` 单独跑;`node --test tests/` 目录收集有 runner 层噪音,非断言失败)

## 11. 关键实现契约(新环境必读,踩过的坑)

### 11.1 槽系统 inject face 的 hooks 转换(最大坑,已踩)

DSH 槽系统(`@deepseek-ai/dsh-client-ui-slots`)对注册时 `inject` 工厂返回的对象有特殊处理:

```js
// 正确(ui-cordis 同款):
inject: () => ({ hooks: { workbench: observableStore } })
// hooks 的每个键必须是 HostObservable(getSnapshot/subscribe),
// 槽系统会把它转成 use<Xxx> selector hook 注入组件:
//   hooks.workbench → props.useWorkbench(sel => sel)
// 非 hooks 字段(如 onSelect)原样透传:props.onSelect
```

**错误写法(最初踩坑)**:`inject: () => ({ hooks: { load, subscribe, select } })` 传普通函数——槽系统按 observable 契约处理,组件拿不到 `props.hooks`,UI 静默不渲染(entry 不报错,页面正常)。

**组件侧正确用法**:
```js
function WorkbenchPanel(props) {
  const snap = props.useWorkbench(s => s)   // selector hook
  const onSelect = props.onSelect           // 透传字段
}
```

数据源必须是 observable store(自带 getSnapshot/subscribe/set,见 `dsh/client.js` 的 `createObservable`)。

### 11.2 client bundle 手写格式

```js
window.__ModuleLoader__.load({
  id: 'dsh-plugin-ioc-data-dev',          // == package name
  factory: (require) => {
    const React = require('react')        // 仅允许平台 seed 词表
    // ... 组件与逻辑全部内联(不允许 require 其他 @deepseek-ai/* 非 seed)
    exports.apply = apply
    exports.inject = inject               // ['slots', 'workspaces']
    return module.exports
  },
})
```

- require 只允许:平台 seed(`react` / `react/jsx-runtime` / `ui-slots` / `ui-primitives` 等 10 个 + `@deepseek-ai/dsh-client-runtime/client` 豁免);其余必须内联,否则 require miss 抛错
- `exports` 上是 `{ apply, inject }`(无 name;entry 名取自 graph row id)

### 11.3 工具卡片 keyed 注册

```js
ctx.slots.inject('tool.call.toolview', () => ctx.slots.register(
  { name: 'tool.call.toolview', key: 'ioc_stage_gate' },  // key = 工具名
  GateCard,
))
```

- `ToolCallOwnerProps`: `{ callId, toolName, block, cwd?, openFile, inspect? }`
- `block`: `RunningToolCall | ToolResultNode`;结果文本在 `block.content[].text`,错误在 `block.error`
- gate 结果判定用 `/\bPASS\b|\bBLOCKED\b/i`(真实输出是 `[RESULT] PASS — ...` 形式,不能用 `^PASS`)

### 11.4 生效链路(改 client 代码后)

- **首次新增 `dsh.client` 声明**:必须重启 dsh(负缓存永不过期)
- **改 bundle 内容**:跑 `pnpm run dev:web`(在 DSH checkout 根)→ client-hmr 500ms 轮询 → SSE 热替换;不跑 dev:web 则需重启
- 页面持有旧 `__DSH_BOOT__` 图谱:改 bundle 后浏览器需硬刷新(Cmd+Shift+R)

## 12. 第二批规格:血缘演进图

### 12.1 端点

`GET /ioc-api/feature/tables?path=<feature目录>`(占位已在 api.js,填充解析逻辑):

```jsonc
{
  "ok": true,
  "nodes": [
    { "id": "consume_active", "name": "区域客户活跃数", "layer": "consume", "kind": "indicator", "meta": {"grain": "月", "verdict": "CL-001 成交口径"} },
    { "id": "ads_active", "name": "ads_dm_customer_active_m", "layer": "ads", "kind": "table", "fields": ["party_id","data_site_type","cust_active_cnt"], "grain": "月/客户/区域", "engine": "hive" },
    { "id": "dws_active", "name": "dws_t_customer_active_daily", "layer": "dw", "kind": "table", "fields": ["party_id","active_cnt"] },
    { "id": "src_cust", "name": "ods_customer_profile", "layer": "src", "kind": "table", "fields": ["party_id","site_type"] }
  ],
  "edges": [
    { "from": "consume_active", "to": "ads_active", "kind": "bound", "phase": "ads-design" },
    { "from": "ads_active", "to": "dws_active", "kind": "agg", "phase": "sql-generate", "expr": "SUM(active_cnt) + COALESCE" },
    { "from": "dws_active", "to": "src_cust", "kind": "agg", "phase": "job-create" }
  ]
}
```

### 12.2 解析来源

| 数据 | 来源文件 | 说明 |
|------|----------|------|
| 消费端字段/指标 | `feature-delta-indicator.md`(指标 v0→v2 表) | 指标名 + ADS 绑定列 |
| ADS 表与字段 | `delta-design-ads.md` §2(字段定义表) | 字段/类型/来源表.列/分层/计算规则 |
| 源绑定 | `sql-source-bindings.yaml`(bindings 列表) | source_table → target_table + filter |
| 级联(ADS→ADS) | `delta-design-ads.md` 多张表之间的引用 | 或后续 SQL 解析 |
| 贴源表 | `evidence/schema_*.json` / table-schema.json | 最深层 |

### 12.3 演进阶段(用户确认)

- `ads-design`:指标字段 → ADS 字段(边 kind=bound,虚线)
- `sql-generate`:+ DWS/DWD 源(边 kind=agg,实线,标注聚合表达式)
- `job-create`:+ 贴源表(最深一层,✦ 标记本阶段新增)

### 12.4 交互

- 三层/四层列布局:消费端 / ADS 层 / DWS-DWD / 贴源表(从页面组件字段往回看)
- 表级视图默认;点击表节点 → 下钻字段级绑定表(字段/类型/来源/分层/状态)+ 高亮上下游边
- 消费端节点显示指标口径(如 CL-001 裁定)
- 图例:虚线=字段绑定 / 实线=聚合 / 灰=待展开

### 12.5 实现注意

- 组件仍用 §11.1 的 observable 契约(hooks → useTables selector hook)
- 数据量控制:同 feature 多 ADS 时节点可能几十个,首批不做折叠/缩放,但数据结构预留 `group` 字段
- 布局用内联 SVG(参考 viz/ 下的原型 HTML:方向反转 + 三阶段按钮 + 下钻面板)

## 13. 迁移到新环境步骤

### 13.1 迁移内容(全部在 ioc-data-dev/ 插件仓库,git 可见)

```
dsh/index.js        (修改)  M
dsh/api.js          (新增)  ??
dsh/client.js       (新增)  ??
package.json        (修改)  M
docs/ioc-workbench-design.md (新增) ??
```

> `tests/dsh-index.test.js` 是预先存在的(非本批次产物),一并保留。

### 13.2 迁移步骤

1. **提交/推送**:在 DataDashboard 仓库提交上述文件(或直接拷贝 ioc-data-dev/ 整个目录到目标环境)
2. **安装/重链插件**:目标环境 profile 的 package.json 依赖里加:
   ```json
   "dsh-plugin-ioc-data-dev": "link:/<目标路径>/ioc-data-dev"
   ```
   并在 `dsh.profile.bundles` 数组加 `"dsh-plugin-ioc-data-dev"`(若未在)
3. **重启 dsh**(首次 client 声明必须重启)
4. **硬刷新浏览器**(Cmd+Shift+R)
5. **验证**:
   - `curl http://127.0.0.1:3080/plugins/dsh-plugin-ioc-data-dev/client.js` → 200
   - `curl 'http://127.0.0.1:3080/ioc-api/features?root=<仓库根>'` → features 非空(需仓库根含 codespec/changes/)
   - 侧边栏出现"IOCC 工作台"
   - 对话调用 `ioc_stage_gate` / `ioc_validate` → 卡片渲染

### 13.3 目标环境前提

- DSH checkout 存在(任意版本,client 插件机制自 rc.7 起稳定)
- 浏览器可访问 DSH web GUI(本设计基于 web 形态;Electron 形态需另行验证 fetch 桥)
- 工作区是 IOC 数据开发仓库(含 `codespec/changes/<version>/<feature-id>/`);工作台读当前 workspace 根

### 13.4 常见问题

| 症状 | 原因 | 处理 |
|------|------|------|
| 侧边栏无工作台 | 页面持有旧图谱 | 硬刷新;确认 dsh 已重启 |
| 工作台提示"未找到 workspace 路径" | 当前 workspace 未选中 | 新建/选择 workspace |
| 工作台提示"未发现 feature" | workspace 根无 codespec/changes | 用真实 IOC 仓库作 workspace |
| `/plugins/...` 404 | 未重启 dsh | 重启 |
| 卡片不渲染 | 工具名不匹配或 bundle 报错 | 看浏览器 console;确认 key 与工具名一致 |
