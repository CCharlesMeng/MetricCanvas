# 内网对话模块兼容迁移与平台同步实施方案

更新：2026-10-31。执行顺序为「保全内网实现 → 在部署项目接通 → 再同步平台源码 → 组合并验收」。本页更新原 2026-10-16 的方案，作为本批唯一实施入口；旧方案只写 `mount(element)` 的装配模板由当前 `mount(element, context?)` 和可选 `agent` 契约替代。

本批平台实现基线：`2133241a6`。这是修改前基线，不能当作包含本次能力的交付 SHA。实施方必须拿到包含本次变更的完整平台归档和匹配的 `portal-contract.d.ts`，固定其 `release.json`、源码提交/dirty 标记与摘要后执行。2026-10-16 的默认 adapter 改动提交为 `1f764db51`，原方案基线为 `3489a267`，仅作历史追溯。

本仓无法访问内网 `readPanguDeployment`、私有 SDK 与门户源码。下列文件归属和接入步骤可执行，实际字段映射需按内网函数保留并核对；未声称已经迁移内网或完成真实服务验收。本次只增加部署配置读取接缝，不变更页面元数据、渲染引擎、查询协议或模型 Skill。

## 1. 本次平台提供什么

- `PlatformPortalProps.readPanguDeployment?: ReadPanguDeployment`；公开声明为 `() => PanguDeployment | null | undefined`，`PanguDeployment` 只含 `resourceUrl` 与 `version`。
- 默认实例 SDK 在每次对话 mount 时执行函数，平台 connect 和服务创建不执行。只有函数未提供时才读取 `window.__METRICCANVAS_PANGU__`。函数返回空值、配置非法或抛错时明确失败，不回退旧全局、不合并两份配置；原始读取异常不展示给用户。
- 显式 `props.dialogueAdapter` 优先。即使同时提供配置读取函数，也不会调用它或加载默认 SDK。已有单参数 mount、自定义 adapter、全局配置均保持兼容。
- 所有默认实例 adapter 共用 document 级资源 URL/版本保护，资源变更须整页重载；保留共享加载、失败重试、15 秒加载超时、迟到挂载保护和实例级清理。
- 部署契约版本仍为 `1`，本次为可选增量。旧平台只收到新字段不会自动获得能力，须按下面的桥接顺序切换。

类型真源：[contract.ts](../../apps/platform/src/lib/integration/contract.ts)。发布归档内的 `portal-contract.d.ts` 无仓内运行依赖。平台内部工厂不是仓外 API，部署不要导入 `runtime.ts` 或 `services.ts`。

## 2. 先判断内网属于哪种情况

| 内网实现 | 迁移目标 | 不能丢的内容 |
|---|---|---|
| `readPanguDeployment` 只返回资源地址和版本；SDK 是 `instance/renderChat/destroy` | 将函数及其配置依赖移入部署项目，通过 `props.readPanguDeployment` 注入 | 原地址、版本、相对 URL 基准、缺失/错误语义 |
| runtime 使用 `setChatConfig`、共享单例、自定义 loader、用户或登录回调 | 将完整实现和传递依赖移入部署项目，通过 `props.dialogueAdapter` 注入 | 身份现读、登录恢复、SDK 等待与租约、监听、清理 |
| 已实现云宝会话和工作副本创作 | 在上一行基础上保留完整 `PlatformDialogueAdapter` | `agent.openSession/send`、`context.sessionId/submit`、请求回执与现有页面通知 |

如果同名函数返回用户、凭据、SDK 实例或其他配置，不直接塞进 `PanguDeployment`；按职责拆出资源配置与私有身份装配。异步读取、共享 SDK 初始化不能放进同步配置函数。

## 3. 文件迁移归属

下表的部署侧路径是建议的新路径；先盘点现有目录再落位，不假定内网已存在这些文件。

| 当前内网位置/内容 | 部署项目建议位置 | 平台同步后的状态 |
|---|---|---|
| `dialogue/runtime.ts` 的 `readPanguDeployment` 和配置映射 | `src/dialogue/pangu-deployment.ts` | 平台 runtime 使用目标版本原文 |
| 单例 SDK mount、共享 loader、SDK 专用类型 | `src/dialogue/private-dialogue.ts` | 不将私有单例实现拷回平台 |
| `ioc-user.ts`、`withDialogueUser`、私有身份上下文 | `src/identity/` 与 `src/dialogue/` | 不增加私有身份字段到公开 context |
| `services.ts` 的私有装配 | 部署 Adapter 的同步 `connect` | 平台 services 使用目标版本原文 |
| `PanguDialogue.svelte`、工作台上的私有传参补丁 | 以公开 context 和部署闭包替代 | 只在逐项替代并验收后移除对应补丁 |
| 实际 SDK 地址、版本、门户配置、用户源 | 部署配置与内部模块 | 不进入公共平台仓库与页面文档 |
| `agent`、authoring、pageInfo、筛选候选端口等现有 props | 原部署装配继续维护 | 合并 props 时保留，不以新对象丢弃 |

## 4. 内网实施顺序

### 阶段 A：固定基线与保全

1. 记录当前内网提交、待同步平台提交、冲突文件、未提交修改、同步保护清单和完整已发布包。若已经 merge/rebase 冲突，先在仓库外保存冲突原文及各方版本，再继续逐段处理；不靠 ours/theirs 名称猜来源，rebase 的含义可能不同。
2. 在迁移分支保全私有实现。记录 `readPanguDeployment` 的返回结构、读取源和全部调用点；列出 SDK 是实例还是单例、谁加载、谁拥有、何时就绪和谁清理。
3. 记录现有可用场景：首次挂载、发送、资源配置、登录/退出、重挂以及已有创作。没有这份清单，不删除代码或撤销同步保护。

### 阶段 B：先抽离并接通，暂不覆盖平台文件

**资源配置模式：** 将原函数连同依赖移动到部署项目，按公开类型返回两字段。下面展示真实新增接缝的装配方式；`connectHost` 和配置函数来自内网项目，不是平台提供的 API。`connectHost` 需返回现有 `PlatformDeploymentConnection`，保留所有原有 props 和 disconnect。

```ts
import type { PlatformDeploymentAdapter, ReadPanguDeployment } from './vendor/platform/portal-contract';
import { connectHost } from './host';
import { readPanguDeployment as readInternalDeployment } from './dialogue/pangu-deployment';

const readPanguDeployment: ReadPanguDeployment = () => readInternalDeployment();
const adapter: PlatformDeploymentAdapter = {
  contractVersion: '1',
  connect(input) {
    const connection = connectHost(input);
    return {
      ...connection,
      props: { ...connection.props, readPanguDeployment }
    };
  }
};
Object.assign(window, { MetricCanvasDeploymentAdapter: adapter });
```

配置依赖应由函数在 mount 时现读，不在模块加载或 connect 时先执行。若现有对象字段不是两字段，使用显式映射；不得从用户或权限菜单猜资源地址/版本，不补默认版本。相对资源地址按平台所在 document 的 URL 解析；如果原函数用其他基准，在部署函数中先规范化为绝对 URL，保持原访问目标。

若现有 connection 带可信 `authoring`，按原项目类型使用 `PlatformDeploymentAdapter<现有可信创作类型>`，不要改成默认 `never` 泛型或删除该字段来消除类型错误。

**单例/私有 SDK 模式：** 在 connect 中同步构造部署自己的 adapter，赋给 `connection.props.dialogueAdapter`，沿用其真实身份、登录与 SDK 接线。直接传递这个完整对象；若必须包装 mount，传递 `(element, context) => privateDialogue.mount(element, context)`，并保留 `agent`。旧的单参数实现可以继续使用，但不能因此声明拥有云宝创作能力。部署资源断开要加入原 connection.disconnect，在平台完成卸载后清理自己拥有的资源。

云宝模式必须保持：[创作接入契约](../pangu-agent-authoring.md) 的真实 openSession/send、sessionId、submit 发送接管、冻结文档与 hash、requestId 和结果回执。不能只复制 mount、丢掉 agent，也不能让 SDK 和 context.submit 各发送一次。

**让旧平台仍可运行的过渡桥：**

- 仅全局资源配置的旧平台：在旧页面要求的时机，将迁出函数的结果注入原 `window.__METRICCANVAS_PANGU__`；再运行旧平台。配置缺失照常失败，不能用旧残留值掩盖错误。桥接属于部署项目，并设置撤销条件。
- 旧平台已有私有 runtime：先把原平台文件中的私有实现改为调用部署侧同一份实现，或在已支持的 `props.dialogueAdapter` 处注入。原补丁仍保留到替代路径实测通过；不能以旧平台忽略新字段作为迁移成功依据。
- 先用固定的新平台包 + 新部署 Adapter 在独立测试入口验证，不覆盖现有生产入口。旧平台过渡桥和新包测试并行存在是允许的，不能同时挂两个共享单例拥有者。

### 阶段 C：同步目标平台，解除逐文件冲突

1. 确认部署侧已独立编译、无平台源码运行依赖，并用固定的新平台包通过下表关键验收。
2. 同步已记录的目标平台版本。`runtime.ts`、`services.ts` 原则上取目标平台实现；仅移除已经由部署侧替代的补丁。其他业务变化逐项迁移或保留，不整目录覆盖。
3. 比较这些文件与目标版本；如果仍有私有差异，列出每项职责和新归属，不能为了 diff 为空直接删代码。解决完本批冲突后，显式暂存本批文件并继续原 merge/rebase；保留无关修改。
4. 配置模式启用 `props.readPanguDeployment` 后，验证新平台不再依赖全局桥；移除桥再复验。完整 adapter 模式验证默认配置函数未被调用、没有第二次 SDK 加载。
5. 验收通过后再取消相关文件的同步保护；固定另一个兼容平台版本或重复同步同一目标，确认不需补回平台私有代码。

### 阶段 D：组合交付与回滚

```sh
node /downloaded/platform/pack-deployment.mjs \
  /downloaded/platform \
  /private-adapter/dist/adapter.js \
  /private-release/metriccanvas-dialogue-new-version
```

路径按实际填写，输出目录必须不存在。部署 Adapter 编译为无外部运行时 import 的经典脚本，在平台脚本前注册。记录平台归档与 Adapter 的 SHA-256、两侧源码版本、组合包摘要、SDK URL/版本与类型声明版本。先发布完整不可变目录，再切换门户 entry。实际宿主覆盖 props 为 appList/roleList 时，connect 从真实可用源映射配置，不依赖被覆盖前的 props。

失败时切回已保存的**完整旧组合包和旧配置**，包括旧平台、旧 Adapter 和匹配 SDK；资源版本改变时整页重载。保留工作副本与未知写入记录，不自动重发请求，不只回滚 JS，也不将部署目录反向同步到平台源码。

## 5. 身份、SDK 与生命周期要求

- 用户信息每次从可信门户源现读；显式 null 表示退出，不回退旧全局用户，不填默认用户。对话身份必须与平台 operatorId/workspaceId 属于同一门户作用域。
- token 刷新按需现读；退出/用户/空间切换先使旧会话失效，再重挂或按显式 reload 策略整页重载。迟到响应和旧 401 不得影响新身份。
- SDK 和 Java/DQE 登录请求使用同一部署登录恢复入口并去重，失败后可再次发起；不自动重放未知写入。私有 currentUser/onLoginRequired 保留在部署闭包中。
- connect 同步完成本地装配，不等待网络和共享 SDK；SDK 等待放在 mount 内并有明确超时。connect 自身失败时清理已分配资源；mount 迟到完成时释放迟到实例。
- 单例只允许一个拥有者；旧清理不能释放后续租约。只移除本挂载的监听和容器，不调用门户共享 SDK 的全局销毁。
- 页面通知继续在平台所在 window 发送，不能恢复孤立事件总线；在实际 qiankun 沙箱验证通知抵达既有页面应用链路。

## 6. 验收矩阵与回执

| 场景 | 必须观察到 | 本仓证据 / 内网责任 |
|---|---|---|
| 仅旧全局配置 | 原实例 SDK 正常挂载与清理 | 单元 + 合成 qiankun / 内网回归 |
| 新配置函数与旧全局冲突 | 只用函数返回的 URL/版本；connect 不提前读取 | 单元 + 合成 qiankun / 内网映射核对 |
| 函数返回 null/undefined、缺字段或抛错 | 明确缺失/失败，无全局回退、无异常内容泄露 | 单元 + 合成 qiankun / 内网复验 |
| 同时有完整 adapter 和配置函数 | 使用完整 adapter；不读函数、不加载默认 SDK | 单元 + 合成 qiankun / 内网真实 SDK |
| 同 document 改 URL/版本 | 拒绝新版本，提示整页重载 | 单元 / 内网复验 |
| 配置来自独立发布声明 | 仓外 TypeScript 项目可编译，无平台源码依赖 | 仓外类型编译 / 内网编译 |
| SDK 加载失败、超时、卸载先于完成 | 保留页面，清理迟到/失败实例，重复清理安全 | 单元 / 内网真实 loader |
| 单例双挂、退出、切换身份、并发 401 | 租约隔离、旧回调失效、一次登录且不重发写入 | 内网实现与真实门户 |
| 云宝已有创作 | context/agent 完整，单次发送，回执对应冻结快照 | 本仓创作回归 / 内网端到端 |
| 再次同步、升级、完整包回滚 | 不需补回 runtime/services 私有补丁 | 内网同步与发布流水线 |

本仓可执行命令：

```sh
pnpm test apps/platform/tests/workbench/pangu-runtime.test.ts apps/platform/tests/workbench/dialogue-boundary.test.ts apps/platform/tests/microfrontend/dialogue-services.test.ts apps/platform/tests/microfrontend/deployment.test.ts apps/platform/tests/dialogue.test.ts apps/platform/tests/dialogue-sessions.test.ts apps/platform/tests/workbench/working-copy-agent.test.ts apps/platform/tests/microfrontend/pangu-deployment-contract.test.ts
pnpm --filter platform check
pnpm --filter platform pack:microfrontend:all
pnpm --filter platform test:pangu-deployment
MICROFRONTEND_PROFILE=debug pnpm --filter platform test:pangu-deployment
```

本仓执行结果、复杂度口径和真实验收边界见[本次验证记录](../evidence/pangu-deployment-migration/2026-10-31.md)。内网回执需包含：原/目标提交、旧/新文件映射、公开声明摘要、实际 SDK 类型与版本、构建与场景结果、剩余保护项、完整回滚入口。未通过项明确标为 FAILED/NOT_RUN，不用本仓合成 SDK 通过代替。

## 7. 可直接交给内网实施人员的任务

> 按本方案先迁移再同步。先保全当前 runtime、readPanguDeployment、services 和全部身份/SDK 依赖，判断是标准实例 SDK 配置模式还是完整单例/云宝 adapter 模式。将私有代码移入独立部署项目，使用目标归档的 portal-contract.d.ts；配置模式注入 readPanguDeployment，完整模式注入保留 context/agent 的 dialogueAdapter，保留所有现有 props 和清理。先在独立测试入口组合固定的新平台包并验证，再同步平台 runtime/services、移除已替代补丁，最后取消同步保护。不得直接选择 main 覆盖后再补功能，不得猜私有 SDK 方法、用户或凭据。输出逐文件变更、真实场景回执、剩余项和完整包回滚方案；遇到缺失字段/接口时先列出具体缺口，保留原实现。
