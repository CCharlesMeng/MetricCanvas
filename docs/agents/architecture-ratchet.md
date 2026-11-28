# 源码依赖门禁

`pnpm architecture:check` 对基准提交和候选源码使用同一套规则，**当前已锁定在 0 存量**：只要候选源码存在任何循环依赖或跨层依赖（`current.size > 0`），检查即退出 1 并打印从导入者到被导入者的文件路径。CI 的 `architecture` 任务参与总门禁。PR 比较目标分支 SHA 与候选合并结果，推送 main 比较推送前的 SHA 与推送结果。本地默认比较 HEAD 与工作树，包括维护目录里的未跟踪源码。复验已提交的分支时可指定基准：

```sh
METRICCANVAS_ARCHITECTURE_BASE=origin/main pnpm architecture:check
node tools/architecture/check.mjs --list
```

## 检查范围

日常改动只需处理本次新增的违规边。例如候选读取已有循环，修改返回文案、依赖关系保持原样时，可在行为回归通过后交付。若新功能把第三个模块卷入循环，优先调整这次新加的调用方向，已有循环可以以后再拆。若局部方案也需要大范围改造，就在当前评审中权衡缩小需求、单独安排重构或修正规则。当前 CI 对新增违规仍会失败，单写延期理由不会使检查通过。

扫描 `page`、`data-execution`、引擎的 `runtime`、`data-gateway`、`runtime-ui`、`widgets`，以及这些层共用的 `ui` 的 src。页面校验 CLI 和原型目录在产品图之外。模块身份按实际源码文件归一化，包括相对路径、工作区包的源码 exports、TypeScript paths、重导出、字面量动态 import 和脚本中的字面量 require。Svelte 包含模块脚本、实例脚本和模板中的动态 import。无法解析的受检源码路径或动态表达式使扫描失败。

循环按**有向边**比较。新建循环、让第三个模块进入已有循环，或在相同成员之间增加一条成环边，均会失败。删除边之后，后续比较以新的目标分支为准。显式 `import type`、`export type` 和类型位置的 `import()` 单独统计。仓库启用了 `verbatimModuleSyntax`，`import { type X } from './x'` 会保留空的运行时导入，因此仍作为依赖边。

跨层检查从下列各层的每个源码文件出发，沿值依赖逐层检查：

- `page` 只可进入自身。共享取数 `data-execution` 还可进入 `page`。
- 引擎的 `runtime` 可进入共享取数和页面领域层。`data-gateway` 还可进入 `runtime`。
- `widgets` 可进入组件库 `ui`、共享取数和页面领域层。视图编排归 `runtime-ui`。
- 对前四个纯逻辑层，Svelte、图表和已列出的显示及文件编码依赖也形成禁止边。普通第三方包作为终点，不展开其 node_modules。跨出受检源码到其他工作区代码时同样以终点处理。

跨层违规按起点层、禁止目标和途经的有向边记录。因此在已有路径旁边加一条通往同一目标的绕路也会失败。该门禁检查静态模块依赖；构建产物隔离仍由打包与独立消费者检查负责。动态模块注册、CSS 和资源引用不在源码图内。

## 首次盘点与清零收口

在 `e8ce59f70` 首次实测 531 个模块时存在 21 条存量违规边，现已全部清零，门禁永久锁定在 0 违规（`current.size > 0` 即失败）：

- 共享取数 `source-program/session` 与 `source-candidates` 之间的 2 条成环边已消除：核心执行下沉至 `source-program/core.ts` / `read.ts` / `read-sources.ts`，`source-candidates` 仅单向调用 `createCoreSourceProgram`。
- 页面领域层的查询、参数引用与表头参数之间的 7 条成环边已消除：筛选绑定纯函数抽离至叶模块 `packages/page/src/query-bindings.ts`，`query.ts` 保持兼容重导出。
- `ComponentRenderer.svelte` 的 1 条自引用边已消除：改用 Svelte 5 递归 `{#snippet renderComponent(...)}` 渲染嵌套组件。
- 柱图、折线图和共享展示代码直连 `runtime/src/chart-series-state.ts` 产生的 11 条 `widgets -> runtime` 路径边已消除：移除 10 个 `runtime` 单行转发壳及 3 个 `data-gateway` 内部转发壳，统一改为直连 `@metriccanvas/data-execution/runtime` / `@metriccanvas/data-execution/dqe`。

分层依据见 [ADR-0076](../adr/0076-formal-architecture-contract-scope-and-enforcement.md) 和[当前包边界](../adr/topics/domain-modeling-and-package-boundaries.md)。
