# 平台与部署 Adapter 独立维护

日期：2026-09-28。用户确认：主应用相关实现由内部系统独立维护，与 GitHub 平台源码分别演进。本页记录通用结论；按用户后续要求，调查与历史接线资料收录在 [portal-handoff](./portal-handoff/README.md)，不参与平台构建。

## 所有权

| GitHub 平台 | 独立部署项目 |
|---|---|
| 工作台、页面管理、URL 路由、实例会话 | 主应用 props/全局变量到标准配置的转换 |
| HTML/UMD/CSS、通用 qiankun 生命周期 | 应用注册、权限菜单、静态托管和网关 |
| 版本化部署契约、静态组合工具 | 实际身份/配置通知、登录恢复、私有 SDK 接线 |
| 合成适配器与通用 loader 测试 | 私有 loader 补丁、CSP/CORS、真实门户验收 |

两方不共享需要同时修改的源文件，不通过 GitHub 内的门户条件分支或仓库深导入集成。唯一共同依赖是有版本的公开接入契约和固定平台产物。内部 Adapter 可独立发布；升级平台时先做契约/组合验收，再切换静态版本。

## 实际接入

平台保留直接 props 方式，也支持独立脚本在平台 UMD 之前注册 `window.MetricCanvasDeploymentAdapter`。存在 Adapter 时优先使用它，不在错误后退回原始 props。

正式类型见 [contract.ts](../../../apps/platform/src/lib/integration/contract.ts)，随静态归档输出 `portal-contract.d.ts`。部署契约版本为 `1`。

```ts
// 此文件由独立部署项目维护，编译为无外部 import 的经典脚本。
// 类型来自下载的静态归档，不深导入平台 GitHub 源码。
import type {PlatformDeploymentAdapter} from './vendor/portal-contract';

const adapter: PlatformDeploymentAdapter = {
  contractVersion: '1',
  connect(input) {
    // input 是该主应用真实 props；映射和校验由独立项目拥有。
    const connection = deployment.connect(input);
    return {
      props: {
        routeBase: connection.routeBase,
        readConfig: () => connection.readConfig(),
        subscribeConfig: changed => connection.subscribeConfig(changed)
      },
      disconnect: () => connection.disconnect()
    };
  }
};
Object.assign(window, {MetricCanvasDeploymentAdapter: adapter});
```

`deployment.*` 是接线示意，不是平台提供的全局对象。注册脚本不应在加载/预取阶段订阅或发请求；每次 mount 调用同步 `connect` 进行有限本地接线。返回的连接只拥有自己创建的资源。平台卸载、失败挂载或映射验证失败后调用 `disconnect`，允许异步且每个连接只调用一次。主应用共享 SDK 不得被销毁。

身份/目标会原地变化时提供真实 `subscribeConfig`。若部署保证这些变化只能整页重载，可显式选择 `configChanges: 'reload'` 并省略订阅，不伪造空订阅。这个声明不是平台自动刷新功能；平台仍在请求前后检查作用域，不提供跨服务目标恢复隔离。凭据和服务协议不得凭猜测补默认值。

## 组合与发布

```sh
node /downloaded/platform/compose-deployment.mjs \
  /downloaded/platform \
  /private-adapter/dist/adapter.js \
  /private-release/new-version
```

组合工具先检查平台契约版本及文件摘要，再复制到不存在的新目录，插入 `deployment/adapter.js`，不修改平台输入目录和 UMD/CSS。组合后的 `release.json` 记录平台源清单摘要、原文件摘要、Adapter 摘要及最终文件摘要。内网流水线另外锁定 Adapter 源码提交和最终归档摘要；回滚恢复完整组合目录。

GitHub 不构建、上传或代管私有 Adapter。组合工具可由内网流水线直接执行归档副本，无需克隆平台源码。不要把组合目录反向提交到 GitHub。双方契约破坏性变化升级部署契约版本；不支持的版本在连接/组合前失败。

## 本轮结论与待补信息

外部调查表明不能假设主应用直接提供读取函数、订阅、完整凭据或实例 SDK。具体事实保存在 [主应用交接材料](./portal-handoff/README.md)。资料与活动代码分开，通用测试继续使用合成用例。

待内网补齐：真实 Java/DQE 身份链路、准确 loader 依赖和补丁、实际子应用入口/构建、SDK 实例能力与就绪时序、注册/静态发布所有者。人工入口和生命周期可继续验证；真实服务与 SDK 不因此标记通过。

现有开发入口中门户专属模拟用户、SDK 地址、证书/域名启动脚本已从活动源码移出，通用开发服务器使用 loopback。既有历史文档和 Git 历史不在本次追溯清理范围，不把本次变更声明为全仓历史脱敏。

本轮代码、类型、产物和浏览器证据见 [独立部署验证](../../evidence/qiankun-platform/deployment-boundary.md)。
