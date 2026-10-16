# 内网对话模块与 main 兼容同步方案

日期：2026-10-16。采用已确认的 B 最小方案：平台统一默认 adapter 策略，内网通过独立部署 Adapter 注入本地对话实现，结束对 `services.ts` 的共同维护。

本仓基线为 `3489a267eacbfe4468c85277243db7feeedf71cb`。这是调整前的本地 main 基线，不是本次改动的交付提交。内网源码、私有 SDK 和真实门户本轮不可访问；文中内网迁移为待执行步骤，不声明已完成兼容验收。本次是既有对话接线修复，不新增页面能力、页面元数据字段或创作工作流，因此不新增页面场景、不变更页面协议或本地创作 Skill。

## 目标与边界

平台公开接缝保持 `DialogueAdapter.mount(element): Promise<() => void>`。优先消费 `props.dialogueAdapter`，缺席时回退平台自带的 `panguDialogueAdapter`。自带实现仍使用 `pangu.instance(id).renderChat(...)` / `destroy()`，要求部署提供资源 URL 与版本；缺失时明确显示不可用，不承诺支持单例 `setChatConfig`。

`currentUser`、`onLoginRequired`、`ioc-user.ts`、`withDialogueUser` 和本地 `DialogueMountContext` 保留在内网部署项目内。它们通过闭包装配进 adapter，不增加到平台 props，不要求平台把第二个参数传给 `mount`。`events` 不恢复到平台契约：`0311c254` 已将内部页面通知统一到平台所在的 `window`。

本方案沿用 [ADR-0094 的部署边界](../adr/0094-independent-platform-deployment-adapters.md) 和[集成契约](../host-contract.md#平台-html-微前端契约)，不新增 SDK 协议或身份体系。

## 文件归属与迁移清单

| 内容 | 平台 main | 内网部署项目 |
|---|---|---|
| `integration/services.ts` | 默认回退自带盘古 adapter | 恢复为 main 内容，停止私有身份和 SDK 装配 |
| `scripts/pack-microfrontend.mjs` | 允许公开的 `__METRICCANVAS_PANGU__` 资源配置标识进入产物；保留私有用户源、开发身份等检查 | 不往平台包写入实际门户用户变量或开发默认身份 |
| `integration/contract.ts`、公开 `dialogue/port.ts` | 维护通用契约，保持 `mount(element)` | 消费归档内 `portal-contract.d.ts`，不深导入平台源码 |
| `dialogue/runtime.ts` | 保留实例 API 实现及资源加载保护 | 抽出本地单例实现为部署自有模块，不覆盖 main 文件 |
| `ioc-user.ts`、身份全局源映射 | 不读取门户私有变量 | 与真实门户字段、空身份及变化通知对应 |
| `withDialogueUser`、本地 `DialogueMountContext` | 不依赖其类型或函数 | 包装本地 adapter，并在闭包内传入上下文 |
| `PanguDialogue.svelte`、`lifecycle.ts`、工作台 | 继续使用通用挂载、异步销毁与 window 通知 | 去掉仅为上下文传递而加入的平台源码补丁 |
| 部署 Adapter 脚本、私有 SDK/loader 补丁 | 不构建或代管 | 独立发布，以经典脚本组合固定的平台静态产物 |

不直接复制内网 `services.ts` 到 main，也不 cherry-pick 整个内网对话目录。本地单例实现若引用平台源码类型、组件、CSS 或运行时函数，须逐项解除运行依赖；部署项目可以维护其 SDK 专用类型，公开挂载接口则以归档声明为准。

## 部署侧装配

以下是待内网实现的结构模板。`deployment`、`connectDialogue` 是建议的内网接口名称，不是平台已提供的 API；本地 `withDialogueUser` 的真实参数名需按其源码映射。不要把示意代码中的部署 API 当作已有接口直接调用。

```ts
import type { PlatformDeploymentAdapter } from './vendor/portal-contract';
// 其余 import 均来自内网部署项目自身，打包为无外部 import 的经典脚本。

const adapter: PlatformDeploymentAdapter = {
  contractVersion: '1',
  connect(input) {
    const host = deployment.connect(input);
    const dialogue = connectDialogue({
      readCurrentUser: () => host.readCurrentUser(),
      onLoginRequired: () => host.requestLogin(),
      // 按实际 qiankun 沙箱验证 SDK 发送端和平台监听端为同一事件目标。
      events: host.platformWindow
    });
    return {
      props: {
        routeBase: host.routeBase,
        readConfig: () => host.readConfig(),
        subscribeConfig: changed => host.subscribeConfig(changed),
        registerLeaveGuard: guard => host.registerLeaveGuard(guard),
        dialogueAdapter: {
          mount: element => dialogue.mount(element)
        },
        onEvent: event => {
          if (event.code === 'login-required') host.requestLogin();
          if (event.code === 'session-invalidated') {
            dialogue.invalidate();
            host.schedulePlatformRemount();
          }
        }
      },
      disconnect: async () => {
        try { await dialogue.disconnect(); }
        finally { await host.disconnect(); }
      }
    };
  }
};
Object.assign(window, { MetricCanvasDeploymentAdapter: adapter });
```

`connect` 只做同步本地装配，不发请求、不等待共享 SDK。SDK 等待发生在 `mount` 内，设置有限超时；若门户在 `afterMount` 才初始化共享 SDK，不得让平台 mount 等待该初始化。不能伪造空配置订阅；仅部署确实保证身份/目标变化整页重载时，改用正式的 `configChanges: 'reload'` 模式。

若内网还有可信创作程序接线，继续把现有 `authoring` 传入 props；不要用本次 adapter 迁移替换既有创作回执和页面校验链路。

### 身份读取与退出

`host.readCurrentUser()` 每次读取当前可信源，不捕获启动时用户对象。规则为：

1. 门户显式提供 `currentUser` 时优先；字段值为 `undefined` 才允许读取已确认的全局注入源。
2. `null` 表示已退出，不回退全局旧用户。显式源结构非法时明确失败，也不能回退绕过错误。
3. 若门户提供读取函数，每次调用；若门户提供对象，部署侧须在真实变化通知时更新读取源。只捕获 qiankun 初次 mount 的 props 对象不能证明支持原地切换。
4. 对话身份与 `readConfig()` 的 `operatorId/workspaceId` 必须来自同一门户作用域；用户变化先停止旧对话操作，再通知配置变化并重挂平台。只有对话用户改变但配置不变时，部署侧也须主动终止并重挂旧平台，不能假装平台现有配置比较能检测它。
5. token 刷新按需现读，不作为切换用户处理；退出、用户/工作空间切换后的迟到成功与 401 回调都应丢弃。失效后的旧闭包不得重新读取新用户并继续旧会话。

不要补默认用户，不把用户或凭据写入页面文档、事件文本、错误日志或浏览器持久存储。

### 401 与登录恢复

对话 SDK 的未登录回调和平台 `onEvent({code:'login-required'})` 共用同一个 `host.requestLogin()`。部署侧在登录进行期间复用同一次登录流程，涵盖来自 SDK 和 Java/DQE 的并发通知；所有调用路径都要处理异步失败，避免未处理的 Promise rejection。

`input.onLoginRequired` 存在时调用它，否则调用已确认的门户登录入口；这是内网部署接口，不是本次新增的平台 prop。保留现有平台事件通知，不额外从对话回调再次合成同一平台事件。登录失败或结束后释放去重状态，允许后续真实 401 再触发。平台及 adapter 不自动重放失败请求、不重新执行未知写入。

### 单例 SDK 与卸载

公开返回值必须是清理函数。`connectDialogue.mount` 在内部调用本地 adapter，向其传入本地 `DialogueMountContext`；即使该上下文有第二个参数，向平台暴露的接口仍只收 `element`。

- 单例同时只允许一个平台挂载拥有会话；冲突时明确失败，不能静默覆盖另一实例的配置或会话。
- 卸载/失效使本次租约不可再用，移除自己注册的 SDK/window 监听和容器内容。清理可重复调用，不调用门户共享 SDK 的全局销毁函数。
- 挂载完成晚于卸载时，立即清理迟到实例；等待 SDK 时取消或超时应解除本次等待监听。不得无限等待而依赖平台容器兜底。
- 重挂建立新的租约，不接受旧挂载的消息、保存通知或身份回调。释放单例只释放自己当前持有的租约，不能释放后续挂载者。

## 内网首次迁移顺序

1. 固定并记录当前平台基线、内网实现提交、受保护文件清单和当前可回滚的完整发布包。先在独立迁移分支进行，保存私有源码后再解除保护，不直接覆盖工作目录。
2. 将本地单例 `runtime`、`ioc-user`、`withDialogueUser` 和上下文类型抽到内网部署项目；列出并迁移其传递依赖。以归档的 `portal-contract.d.ts` 类型检查公开 adapter，不依赖 GitHub 平台源码目录。
3. 实现上面的同步装配、身份失效、单例租约与登录去重，把包装后的 adapter 注入 `props.dialogueAdapter`。应用页面通知仍走平台 window；不能恢复 `services.events` 或把事件发到孤立的 `new EventTarget()`。
4. 合入本次 main 修复；内网 `services.ts` 恢复为目标 main 的内容。逐项检查 `port.ts`、工作台、容器及独立入口上的私有传参补丁，只移除已由部署侧替代的部分，不丢弃其他业务功能。
5. 构建独立 adapter，按[平台打包说明](../platform-build.md)组合完整静态包。宿主若整体替换 props 为 `appList/roleList`，在 `connect(input)` 中从实际门户来源映射，不依赖被替换前的 props，也不从权限记录猜用户。
6. 通过下表内网验收后，删除同步工具中 `services.ts` 的受保护排除。`git diff <目标-main提交> -- apps/platform/src/lib/integration/services.ts` 应为空；同步配置本身的路径由内网实际工具确定，本仓未修改它。
7. 将内网同步规则收敛为“通用平台源码正常同步，部署项目及私有实现独立维护”。再次同步一个固定 main 版本并重跑关键验收，确认不用重新补回 `services.ts`。

首次迁移可以在内网工作分支完成代码抽离，最终交付仍应使用仓外 adapter 加固定平台产物。不要长期依赖保护平台源码文件来维持单例实现。

## 后续版本同步与回滚

每次升级固定目标 main 提交和平台归档摘要，核对归档 `release.json`、`portal-contract.d.ts`、部署契约版本 `1`、当前集成契约及对话接缝变更。契约不兼容时停止组合，显式适配，不能忽略字段或退回默认实例 SDK 来掩盖单例接线失败。

先在新的输出目录组合平台与 adapter，再验收和切换 entry：

```sh
node /downloaded/platform/pack-deployment.mjs \
  /downloaded/platform \
  /private-adapter/dist/adapter.js \
  /private-release/metriccanvas-dialogue-new-version
```

路径是示例，输出目录必须不存在。记录平台 Git SHA、源码树摘要/dirty 标志、adapter 源码提交、adapter 摘要、组合包摘要及 SDK 版本。回滚切回原完整组合目录和对应配置；资源版本变化按既有规则整页重载，不只替换 JS，不把组合目录反向同步到 main。兼容版本升级无需新增受保护的平台源文件。

## 验收与完成条件

| 场景 | 预期 | 验证位置 |
|---|---|---|
| 未注入 adapter、资源配置合法 | 平台调用自带实例 SDK，卸载只清理自己的实例 | 本仓合成 SDK 测试 |
| 未注入 adapter、未配置 SDK | 平台服务可创建，对话挂载明确显示缺少资源配置 | 本仓测试；真实浏览器待内网复验 |
| 注入内网 adapter，缺少自带 SDK 配置 | 调用内网单例实现，不触发实例 SDK 的资源加载 | 本仓注入边界测试 + 内网真实 SDK |
| props 用户与全局源冲突/未提供/null/非法 | 显式源优先；未提供才回退；null 退出；非法明确失败 | 内网单元测试与门户 |
| token 刷新、退出、用户/空间切换 | 凭据现读；旧会话停止，迟到结果及旧 401 不影响新身份 | 内网门户 |
| Java/DQE 与 SDK 并发 401 | 一次登录流程；失败后可再次登录；不重试未知写入 | 内网门户与真实服务 |
| 共享 SDK 在 afterMount 就绪或永不就绪 | 平台 mount 不被阻塞；对话有限等待，失败明确 | 内网 loader |
| 同时双挂载、卸载早于挂载完成、重挂 | 单例冲突受控；迟到清理；新挂载不被旧清理破坏 | 内网 adapter 测试与真实 SDK |
| SDK 发页面应用/草稿通知 | 平台 window 收到通知；既有校验与身份保护继续生效 | 实际 qiankun 沙箱 |
| 去掉保护后再次同步、组合升级与回滚 | services 无私有差异；对话可用；完整包可回滚 | 内网同步流水线 |

本仓定向检查命令：

```sh
pnpm exec vitest run apps/platform/tests/microfrontend/dialogue-services.test.ts apps/platform/tests/microfrontend/session.test.ts apps/platform/tests/microfrontend/deployment.test.ts apps/platform/tests/workbench/pangu-runtime.test.ts apps/platform/tests/dialogue.test.ts
pnpm --filter platform check
pnpm --filter platform build:microfrontend
node apps/platform/scripts/pack-microfrontend.mjs
pnpm --filter platform pack:microfrontend:debug
DEPLOYMENT_ADAPTER_TEST=1 pnpm --filter platform test:microfrontend
```

2026-10-16 本轮本地结果：上述 5 个测试文件共 47 项通过；平台类型检查 0 错误、0 警告；生产构建与归档、独立调试构建与归档均通过。生产归档在移除公开资源配置标识的旧禁止项后重新验证，其他产物边界检查保留。部署 Adapter 模式的真实 qiankun 2.10.16 + Chromium 151 浏览器回归通过，覆盖 HTTP fixture、无 props 事件总线的 window 通知、导航/保存、token 刷新、身份失效、卸载重挂及失败挂载清理；4 份关联文档的本地链接检查通过。归档来自本地未提交工作区，不代表已推送版本。

本仓测试使用合成 SDK，不代表单例 SDK、内网门户、真实 Java/DQE/Relay 验收。内网完成条件是迁移清单与真实环境适用场景全部通过，且受保护排除已撤除、重复同步与完整包回滚均有记录。本仓提交与推送不代表已发布内网包。
