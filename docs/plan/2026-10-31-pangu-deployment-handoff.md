# 内网执行 Handoff：盘古部署配置兼容迁移

交接日期：2026-10-31。任务是先将内网私有对话实现迁入独立部署项目，再同步公共平台源码；现有对话、身份与创作能力必须保留。本文件可直接交给内网实施人员或 Agent。详细背景见仓库 `docs/plan/2026-10-16-intranet-dialogue-sync.md`（离线包中为 `MIGRATION-PLAN.md`）；本文件提供独立执行所需的步骤和验收口径。

## 交付身份与范围

- 能力实现提交：`e3c20eb53e9dd88d0e3874a5d35ef2eaf59cd580`（GitHub 仓库 `CCharlesMeng/MetricCanvas`）。这是包含实际代码的固定提交；后续纯交接文档提交不改变此能力。
- 最终推送 SHA、精确 SHA 的 CI URL/结论、离线包摘要见同批 `DELIVERY.json` 或交付消息。必须验证最终目标包含上述实现提交，不能只凭 main 分支名称或默认版本 `1.0.0-rc.1` 判断版本。
- 本批声明 SHA-256：`f0ad32a07eefd7be9796044cd9da67156bd40c4d3ef4a453add739b074c2f893`。从所选平台原始归档复制 `portal-contract.d.ts` 到部署项目，禁止使用旧缓存声明或深导入平台源码。
- 公开增量：可选同步函数 `props.readPanguDeployment: () => ({resourceUrl, version} | null | undefined)`。优先级是完整 `dialogueAdapter` → 显式配置读取函数 → 仅在没有函数时读取旧全局配置。返回空值/抛错不回退，SDK URL/版本改变仍须整页重载。
- 本批不提供或推断真实 SDK 方法、用户字段、凭据、门户登录入口、Relay/Java/DQE 接线。平台的既有单参数 mount、旧全局配置与独立 adapter 均继续兼容；新增配置函数本身不适配单例 SDK，也不提供 Agent 创作能力。

## 0. 接收交付并核对

联网侧可从固定提交的 CI 下载 `metriccanvas-platform-microfrontend-<最终SHA>`，将它的生产/调试归档、校验文件与本文件整体转入内网。离线交付包包含：

- `HANDOFF.md`（本文件）、`MIGRATION-PLAN.md`（详细方案）、`DELIVERY.json`、`SHA256SUMS`。
- `platform/` 内的生产/调试 `.tar.gz` 与原校验文件，以及匹配的 `portal-contract.d.ts`。
- `source-changes.patch` 是本批公开增量，仅供代码审阅/既有同步工具使用；它不包含内网私有实现，也不等于完整产品同步。不要在活动发布目录直接应用。

在解压后的交付目录验证所有文件（只需 Python 3 标准库）：

```sh
python3 - <<'VERIFY'
from pathlib import Path
from hashlib import sha256
for line in Path('SHA256SUMS').read_text().splitlines():
    digest, name = line.split('  ', 1)
    actual = sha256(Path(name).read_bytes()).hexdigest()
    assert actual == digest, f'校验失败: {name}'
print('交付文件摘要全部匹配')
VERIFY
```

若使用 Git 同步，先固定最终目标提交并验证实现提交是其祖先；不要在有冲突的目录里切换提交：

```sh
# PANGU_TARGET_COMMIT 填 DELIVERY.json 的最终提交，而非浮动的 main。
PANGU_TARGET_COMMIT=$(python3 -c 'import json; print(json.load(open("DELIVERY.json"))["commit"])')
# 在内网平台 Git 检出中核对（目标历史应先由既有同步流程导入）。
git merge-base --is-ancestor e3c20eb53e9dd88d0e3874a5d35ef2eaf59cd580 "$PANGU_TARGET_COMMIT"
git show "$PANGU_TARGET_COMMIT":apps/platform/src/lib/integration/contract.ts
```

## 1. 先保全内网现状，保持同步保护

记录当前内网提交、同步目标、已发布平台包和 Adapter 版本、SDK 类型/URL/版本、原 entry 与配置、冲突文件和同步保护清单。备份所有私有源码及未跟踪文件；有 merge/rebase 冲突时另存冲突原文和 index 各方版本，继续原合并过程，不直接选 main 覆盖。

重点盘点 `dialogue/runtime.ts` 的 `readPanguDeployment` 实现和调用、`services.ts`、`ioc-user.ts`、`withDialogueUser`、SDK loader、挂载/清理和所有传递依赖。资源 URL、用户与凭据只保留在内网备份和部署配置，不回写公共仓库或业务页面。

在迁移分支/独立测试目录实施，现有生产入口先保持可回滚；验证替代路径之前，不删除原补丁，也不取消文件保护。

## 2. 判断接法并迁移

| 当前内网事实 | 应迁移到哪里 | 平台接入方式 |
|---|---|---|
| 配置函数只返回资源 URL/版本，SDK 为 `instance/renderChat/destroy` | 部署项目的 `src/dialogue/pangu-deployment.ts`，依赖一同迁出 | `props.readPanguDeployment` |
| `setChatConfig`、共享单例、自定义 loader、用户/登录回调或 SDK 已由门户控制 | 部署项目的私有 dialogue 模块、身份与 loader 模块 | 完整 `props.dialogueAdapter` |
| 已有云宝会话、工作副本创作 | 同上，连同 Agent 与发送接管一起迁移 | 保留 `agent.openSession/send` 和 `mount(element, context?)` |

以真实源码判断。若函数还返回用户、token 或其他字段，拆出资源配置与私有装配；不能把整个对象作为公开 PanguDeployment，也不能只迁配置后丢掉身份/SDK 行为。

### A. 标准实例 SDK：注入资源读取函数

把原函数及配置映射迁入部署项目；同步返回两字段，缺失返回 null/undefined。保持原 URL 基准：平台按当前 document URL 解析相对地址，如果原函数使用其他基准，部署函数先转换为正确绝对地址。

在既有 `MetricCanvasDeploymentAdapter.connect(input)` 返回的 connection 中增加字段，保留所有原 props 和 disconnect。下面的 `connection`、`readInternalDeployment` 来自内网现有实现，不是平台新增 API：

```ts
import type { ReadPanguDeployment } from './vendor/platform/portal-contract';
const readPanguDeployment: ReadPanguDeployment = () => readInternalDeployment();
return {
  ...connection,
  props: { ...connection.props, readPanguDeployment }
};
```

不要在 connect 时先执行读取；不要在函数内等 SDK/网络。平台在每次默认 dialogue mount 时调用；异常以固定配置读取失败提示呈现。

### B. 单例/私有 SDK：注入完整 adapter

将旧 runtime 的 SDK 实现、loader、身份读取和登录回调迁入部署项目，通过闭包组装到 `PlatformDialogueAdapter`。直接赋给 `props.dialogueAdapter`；平台不会再调用配置函数或加载默认 SDK。

如果有包装层，接口必须保留：

```ts
// privateDialogue 是从内网真实实现迁出的对象。
import type { PlatformDialogueAdapter } from './vendor/platform/portal-contract';
const privateAdapter: PlatformDialogueAdapter = privateDialogue;
const dialogueAdapter: PlatformDialogueAdapter = {
  mount: (element, context) => privateAdapter.mount(element, context),
  agent: privateAdapter.agent
};
return { ...connection, props: { ...connection.props, dialogueAdapter } };
```

按目标 `portal-contract.d.ts` 补全 TypeScript 类型；有可信 authoring 时沿用现有 `PlatformDeploymentAdapter<可信创作类型>`，不得为了消除类型错误删除原能力。旧的单参数 mount 可以继续使用；需要创作的现有模式不能因此降级成 mount-only。

资源只由当前 connection/mount 的拥有者清理。将迁出模块的 disconnect 接到原 disconnect，平台先卸载、部署再清理；原清理即使抛错也不能跳过其他必需清理。connect 自己失败时清理已分配资源。

### 迁移时必须保持的不变量

- 保留原 `authoring`、`pageInfo`、displayInputs、筛选候选端口、路由、离开保护和 onEvent，不用只有新字段的 props 对象覆盖原对象。
- 私有身份由可信门户源现读；显式 null 为退出，不回退旧用户，不填默认身份。token 刷新与切换用户分开处理，旧响应和旧 401 不能影响新会话。
- `context` 只包含公开的 sessionId 与 submit；身份留在部署闭包。已有创作保留真实 openSession/send、冻结文档/hash、requestId 和结果回执。SDK 发送前回调调用并等待 submit，由它接管本轮，不能再自行发送第二次。
- connect 同步本地装配；SDK 就绪等待在 mount 内，必须有超时。共享单例有唯一拥有者，旧清理不能破坏新租约；只释放自己的实例/监听，不销毁门户共享 SDK。
- SDK 与平台共用部署登录恢复并去重，不自动重放未知写入。页面通知仍发到平台所在 window，实际 qiankun 中验证接收链路，不创建孤立事件总线。

## 3. 先接通新包，再同步平台源码

解压生产包到新的测试目录，复制其中的公开声明并比对本页声明摘要；Adapter 按内网现有构建流程编译为无外部运行时 import 的经典脚本，在平台脚本前注册 `window.MetricCanvasDeploymentAdapter`。

旧平台若只认全局资源配置，可在部署项目暂时保留 `window.__METRICCANVAS_PANGU__` 过渡桥；旧私有 runtime 可先调用迁出的同一份实现。桥接只是过渡，不以旧平台忽略新字段当作验证成功。先用独立新平台包验证替代路径；共享单例不能同时由两个挂载拥有。

新路径通过后，才执行既有内网同步流程，将公共平台同步到已固定目标。`runtime.ts` 与 `services.ts` 采用目标实现，逐项移除已被部署侧替代的补丁；其他业务变化分别核对，不整目录覆盖。保留 context/agent 的工作台与容器接线。配置模式删除全局过渡桥后再测；完整 adapter 模式确认没有默认 SDK 请求。

仅在下节关键验收全部通过后取消这些文件的同步保护，再次同步同一目标或另一个兼容版本，确认不需要补回私有平台代码。同步/合并完成后只暂存本批文件，保留无关修改。

## 4. 组合部署命令

使用 Node.js 24（与平台 CI 一致）和 tar；本步骤使用已有平台产物，不要求在内网安装公共 npm/Python 创作依赖。

```sh
# 在已验证的交付目录执行；目录必须是新目录。
mkdir platform-prod
tar -xzf platform/metriccanvas-platform-1.0.0-rc.1.tar.gz -C platform-prod

# 两个变量按内网真实路径填写。不要预先创建输出目录。
PANGU_ADAPTER_JS='/absolute/path/to/private-adapter/dist/adapter.js'
PANGU_OUTPUT_DIR='/absolute/path/to/releases/metriccanvas-pangu-new'
node platform-prod/pack-deployment.mjs platform-prod "$PANGU_ADAPTER_JS" "$PANGU_OUTPUT_DIR"
```

目录必须互不重叠。调试使用同批 `metriccanvas-platform-1.0.0-rc.1-debug.tar.gz`，按相同步骤另建目录组合，不能只替换 JS/map。组合工具验证原平台文件摘要，并记录平台和 Adapter 各自摘要；内部另记 Adapter 源码提交和 SDK 版本。

把门户 entry 指向新完整目录 `index.html`，保留正确业务 activeRule/routeBase；静态 entry 路径不是业务路由。宿主若将 props 整体换成 appList/roleList，由部署 connect 从真实可用源映射配置，不依赖被替换前的对象。

## 5. 实际内网验收与回执

| 必测场景 | 通过条件 |
|---|---|
| A 模式配置注入 | 只请求函数返回的 URL/版本；旧全局故意不同也不被读取；connect 不提前调用 |
| A 模式返回空值/抛错/缺字段 | 显示明确配置缺失/读取失败；不回退旧配置、不加载第二份 SDK、不显示原异常里的敏感值 |
| B 模式完整 adapter | 没有默认 SDK 请求；配置函数可故意抛错并确认未被调用；对话与原用户接线可用 |
| 原有创作 | context/agent 完整；真实新建/恢复会话，单次发送，回执对应冻结快照，页面按原链路更新 |
| 挂载失败/超时、先卸载后完成、反复重挂 | 有界等待、迟到清理、重复清理安全；旧回调与清理不影响新拥有者 |
| 用户切换、退出、token 刷新、并发 401 | 身份现读、旧会话失效、登录去重；不重放未知写入 |
| 同 document 更换资源 URL/版本 | 明确要求整页重载，刷新后使用新版本 |
| 再次同步与完整回滚 | 无需补回 runtime/services 私有代码；完整旧平台+Adapter+配置可恢复 |

本仓已用合成 SDK 验证公开接缝和实际 qiankun 浏览器行为；它不能证明上表真实内网链路。平台公开契约、部署 Adapter、真实 SDK/门户分别给出 PASS / FAILED / NOT_RUN，不把本仓 fixture 通过写成人工或真实 SDK 验收。

回执至少保存：原内网提交、目标平台最终 SHA、实现提交、归档/声明/Adapter/组合包摘要、SDK 类型与版本、逐文件迁移归属、所有场景结果、剩余保护项、发布 entry 与可回滚完整包。不要在回执记录 token/用户业务值。

## 6. 回滚与完成条件

任何关键场景失败，保持旧发布入口和原文件保护，修复部署映射后重新组合，不通过删平台校验或猜 SDK 方法绕过失败。已经切换时，切回记录的完整旧组合包、旧 SDK 配置与 entry，资源版本改变需整页重载；保留工作副本和未知写入记录，不自动重发请求。

完成必须同时满足：部署项目独立构建、无平台源码运行依赖；关键真实场景通过；平台私有补丁已由迁出实现替代；同步保护在验收后撤销；再次同步不用补丁；有实际回滚记录。缺字段/接口时列出具体缺口并保留原实现，不直接选择 main 覆盖。
