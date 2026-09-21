# T03 / #129 验收回执

S2 task `01a09f69-a06b-7703-b87b-ccdfe05d765e`；worktree `/private/tmp/metriccanvas-126-s2`；branch `codex/s2-protocol-runtime-129`；基线 `057703b1604f4937601f99534c713a4f72995c08`。提交 SHA 由包含本文件的提交及 S0 集成记录给出。

## 验收映射

| 条目 | 实现与证据 |
|---|---|
| 版本/接受/唯一写出/双字段/升级顺序 | t03-layout-compatibility.md，增量6.1，6.0保持可读，6.1旧字段也兼容；32项生成矩阵 |
| 读取规范化且旧调用方工作 | normalizePageDocument保留原始业务内容，parsePage仅输出规范布局；18项公开边界测试、127文件全量回归通过 |
| report/dashboard等价与未知版本拒绝 | Embed ESM/IIFE各覆盖新旧两种布局、文字/宽度/组件占位等价、双字段拒绝；既有版本拒绝/事件/恢复测试，共6项浏览器用例通过 |
| 作者源与跨语言期望 | Zod/TypeScript单向生成190项产品文件、对应snapshot及锁；Python新语义缺口如下明确交#132，不加pending豁免 |

## 实际命令与结果

- `pnpm install --frozen-lockfile`：成功；offline尝试缺缓存包后安装锁定依赖，未改锁文件。
- `pnpm test`：127文件通过；936测试通过、5个既有跳过。初次直接vitest因未svelte-kit sync及沙箱本机端口限制失败，后按正式脚本及本机权限重跑；新fixture文件名/id和旧版本断言已修正后全量通过。
- `pnpm check`：成功，所有Svelte检查0错误0警告。
- `pnpm --filter @metriccanvas/embed build`：ESM/IIFE及声明构建成功。
- `pnpm exec playwright test tests/browser/layout-compatibility.spec.ts tests/browser/version-error.spec.ts`（packages/embed）：6通过，Chrome headless，本机HTTP服务。是独立HTML/ESM/IIFE消费证据，不是#103内网实证。
- `UPDATE_PUBLIC_API=1 pnpm exec vitest run tests/public-api.test.ts`：6通过，增加normalizePageDocument公开导出快照；随后全量测试正常校验快照。
- `node --import tsx tools/scripts/export-authoring-contracts.ts` 与 `--check`：190 product / 4 authoring / 1 interface，生成无漂移。使用node入口避免tsx CLI的沙箱IPC限制，调用同一作者源。
- `python3 metriccanvas-authoring/scripts/check_bundle.py`：474摘要校验通过。
- 使用现有tool/.venv/bin/python（Python3.12）执行test_page_validation.py：旧正例、新正例、其余反例通过；恰有下列3个新反例失败，记录为#132待实现。初次系统Python缺jsonschema/fastmcp不计协议失败。
- `git diff --check`：通过。

## #132 精确接续缺口

现有Python校验器尚未实现以下语义，3个反例实际返回缺少所列错误：

| 向量 | 应有错误 |
|---|---|
| layout-before-6.1.json | SCHEMA_ERROR /layout |
| layout-dual-conflict.json | SCHEMA_ERROR /layoutForm |
| layout-dual-equal.json | SCHEMA_ERROR /layoutForm |

layout-invalid-value已由新Schema在Python拒绝；未知版本既有向量继续通过type/path比对。32项layout-compatibility.json包括6.0双字段的完整两个错误、6.1旧字段成功规范化及缺省输出；Python规范化/生产写出由S3 #132实现并执行完整矩阵。不得以本票生成向量冒充Python实现已完成。

## 跨线例外与未实现范围

S1已明确临时授权apps/platform/tests/workbench/promote.test.ts唯一断言：确认载荷schemaVersion从versionPolicy.current改为document.schemaVersion。原6.0 fixture、生产promote不变；全量回归通过后归还S1。其余新增测试/作者路径已向S0登记；生成物完整清单见本提交diff。

#131浏览器生产构造/读取/示例迁移、#132 Python、#133别名清理/四交付物打包/存量迁移文档尚未完成。Page类型暂留layoutForm输入别名给旧构造调用方；parsePage运行输出已不含别名。#143/#144和页面元数据参考手册主体均不在本票。无Java/Relay代码、无外部新契约确认、无真实DQE/IOC/内网部署验收。未push、未发布、未更新main。

S0验收集成后可立即解锁S3 #132，S2消费精确集成SHA后开始#131。回退/旧数据保护规则见t03-layout-compatibility.md。
