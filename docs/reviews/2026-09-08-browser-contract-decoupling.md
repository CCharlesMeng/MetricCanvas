# 页面搭建工作台与契约生成解耦（#123 / #124）

实施基线为 `fbc391a27419e1de7f5d20d8cf3f269611b27b04`，决策为 ADR-0074；旧链历史索引见 [完整基线](./2026-09-08-legacy-baseline.md)。

## 已实现

- 工作台 `component-selection.ts`、`component-building.ts` 与 `promote.ts` 承接最小浏览器能力。单组件切换只重建 type/props，保留组件身份、布局、数据槽和整页筛选；不运行整页装配器。构造和目录准入共同覆盖十类，未支持类型明确拒绝。
- `metriccanvas-authoring/test-harness/fixtures/component-building.json` 给出固定字段绑定、默认属性、准入预期；浏览器与 Python 同读。包含十类正例和五类拒绝输入，源提交与人工审查规则随用例记录，不用任何一侧输出生成预期。
- 唯一运行配置读取器提取为私有 `@metriccanvas/application-runtime`，平台与 Canvas 共同消费。它不是第五个引擎发布交付物，未扩大引擎公开面；每请求读取、缺配置错误与身份注入契约保持原行为。
- 当前产品契约仍从现行 TypeScript/Zod 生成。旧编排/装配的迁移预期与旧 Java 协议复制到 `tools/fixtures/legacy-contracts`，以原始提交与摘要冻结。分析意图改由 Bundle authored 契约维护。生成命令不再导入旧 MCP/平台服务端，也不向旧 Java 工程写快照。

## 验证

- 浏览器定向回归：5 文件、48 用例通过；包含十类组件、编辑与布局保留、沉淀、注入读取与直连 DQE。
- 全仓回归：177 passed / 7 skipped 文件，1395 passed / 49 skipped 用例；随后新增的契约隔离回归 1 文件、1 用例通过。跳过项不是通过证据。
- `pnpm check` 全仓通过；平台与 Canvas 均为 0 errors / 0 warnings。新增隔离测试也通过根测试 TypeScript 检查。
- 平台生产构建通过，但仍为 adapter-node，**不表示 #104 静态化已完成**。
- Python 完整回归 153 tests 通过；Bundle 校验与契约检查通过。
- esbuild 实际依赖图：契约生成器 199 个源码输入，无 `packages/server`、平台服务端或旧 Java 输入。
- 永久回归 `tests/authoring-export-isolation.test.ts` 在不含旧服务/应用/Java 源码的临时树执行真实导出检查；正常通过，篡改历史迁移向量或当前产品 Schema 副本均失败。只复用已安装的工具与 page 第三方依赖。

## 仍未实施

#125 的旧对话/会话消费、发布治理/模板/ACL、服务包和默认启动清理；#105 新页面资产接口消费；#104 的 Node 回退消除、静态 adapter、实际部署。Canvas 最终去留仍待用户单项裁决。未触碰并发会话的 ADR-0074、ADR README 与两份迁移计划，也未将其混入提交。
