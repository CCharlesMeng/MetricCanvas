# M2 页面元数据参考手册：S2 验收证据

状态：S2 已实现并完成本地组合验证，提交 S0 验收；本文件不自行宣布 M2 或 #126 完成。

## 固定对象与所有权

- S2 任务：`01a09f69-a06b-7703-b87b-ccdfe05d765e`。
- 分支：`codex/s2-page-reference`；工作树：`/private/tmp/metriccanvas-126-s2`。
- 作者提交：`ab8a0ccf606bda77b20a7552b11a016978abc7e2`。
- 生成提交：`388004ce09e3036899293c5e97123686ce773bf4`。
- 最终组合提交：`57b9343f153af5c2d0ec8b01f44fa66f5e571f38`；tree：`44e306d8534b5cda01289095ac2e3e1f7da107be`。
- 正式父基线：`a2d82f3d81e12418729775aaba4d226d19137dfd`，产品/Bundle 实现等同 `c69aa28a03bddfc9567b82daadabac3fe40066d6`。合并只冲突 `bundle.lock.json`，使用组合后的作者输入重新生成；保留 #137 工具、输入 Schema 与摘要。请消费最终组合，不单独回退到早期生成提交的锁。
- 范围：总览、29 个作者模块及索引、参考映射、新生成器、导出器、两份参考/隔离测试、3 个合法夹具、CLI 测试的动态夹具计数、产品/Bundle/独立 Skill 参考投影及锁。Skill 主文只增加阅读入口和完整目录安装说明；验收后归还 S3 临时所有权。

## 交付与覆盖

当前页面协议为 **6.2**，发布包保持 **1.0.0-rc.4**。方案文件中的 6.0 是制定时历史基线；本册同时说明 6.0/6.1 读取兼容，不新增协议或工具行为。

| 项目 | 最终结果 |
|---|---|
| 结构目录 | 940 个局部节点、86 个可达定义、29 个模块、17 类组件 |
| 允许值 | 54 个 enum 节点、89 个 const 节点；属性和 enum 解释无缺口 |
| 组件示例 | 53 个组件/显式 variant 条目，均有完整合法页面和提取位置 |
| 联合分支 | 110 个 anyOf/oneOf 分支：109 个合法页面见证，1 个已验证语义拒绝反例 |
| 规则 | 74 条产品 conformance 不变量全部归入模块，169 个错误向量核对 type/path |
| 独立参考目录 | 每份 271 文件，其中 67 个完整示例、169 个错误向量 |
| 来源与分发 | 29 个语义来源文件记录摘要；产品 → Bundle → Skill 单向生成 |

`allOf` 引用包装、数组项、动态键与递归引用保留在结构目录，不把引用包装冒充独立行为分支，也不合并各分支 required。`Schema default` 与运行时/装配默认分开说明。新增字段缺解释、enum 缺解释、缺组件/分支示例、失效反例、坏链接或 JSON Pointer 都不能作为成功导出。

新增源夹具为 `reference-text-page.json`、`reference-variants-page.json`、`reference-branches-page.json`。产品合法夹具共 19 个，均通过 TypeScript CLI 与 Python 预检。生成示例裁剪时每步重新完整验证，保留必要数据源、参数和筛选依赖；Markdown 短片段从生成 JSON 的 Pointer 提取。

### 唯一语义拒绝分支

- Schema 路径：`#/definitions/textComponent/properties/props/properties/links/items/properties/query/additionalProperties/oneOf/0`。
- 含义：文本链接使用 `source: row`。共享导航结构允许该分支，但 text 没有数据槽；`packages/page/src/navigate.ts` 的 `navigationErrors` 解析当前行字段时无法取得数据源，必须报错。
- 规则：`url-navigation-source-contract`；向量：`navigation-text-row-source`。
- 预期：`SCHEMA_ERROR`，路径 `/sections/0/components/1/props/links/0/query/project/field`。
- 生成器确认该反例实际命中该 Schema 分支，并验证完整错误 type/path 与既有向量一致；反例消失、失配或出现合法见证都要求重新审视登记。此项**不计入合法示例覆盖**。

## 实际验证

以下检查在最终组合上通过；原始日志均在本机 `/private/tmp/`，不作为可移植分发依赖。

| 检查 | 结果 | 本机日志 |
|---|---|---|
| `pnpm check` | 通过；Svelte 0 errors / 0 warnings | `s2-reference-final-check.log` |
| `pnpm test` | 141 文件；1062 passed、5 既有 skipped | `s2-reference-final-tests.log` |
| Python unittest 全量 | 222 tests，OK；含共享正反向量和公开 stdio | `s2-reference-final-python.log` |
| 导出器 `--check` | current：469 product、4 authoring、1 interface | `s2-reference-final-export-check.log` |
| `check_bundle.py` | 1330 digest checks | `s2-reference-final-bundle.log` |
| `git diff --check` | 通过 | 命令退出 0 |
| 作者文档链接检查 | 35 个 Markdown 的相对文件链接均存在；64 个旧标题锚点保留 | 本地脚本检查 |

Python 使用 `/private/tmp/metriccanvas-126-delivery-python/bin/python`。完整 Node/Python 回归涉及本地 HTTP 监听，初次沙箱执行分别出现 EPERM 和 PermissionError；重新在允许本地监听的环境全量通过，没有删除或跳过相关断言。

`tests/page-reference.test.ts` 真实复制整体 Bundle 与独立 Skill 到临时目录，检查投影数量、相对链接、锚点、全部完整示例；三份投影逐字相同。`tests/authoring-export-isolation.test.ts` 不复制 apps/server，保留必要产品语义来源，检查干净导出、作者文档漂移、冻结历史篡改、产品 Schema 漂移和版本漂移。缺文件、缺锚点、坏 Pointer、未登记定义另有负向检查。

## 可观察边界

本文不把 Schema 表达能力、确定性装配能力、外部服务可用性视为同一件事。组件索引和交互模块已按 S3 确认的 #135/#136/#137 实现区分构造 recipe、类型转换、删除范围、可信 SSE 配置，以及本地 HTTP/SSE 与外部 DQE/认证的差异。

本次没有新增 UI 实现或逐 variant 视觉验收。新增示例仅证实结构和语义合法；每个新示例的外观仍明确待验证。模块引用既有运行时与浏览器测试，t09/t10/t11 的本地协议证据也不替代外部服务连通性验收。先前 rc.4 双 Svelte/Chrome/Edge 矩阵证据沿用其固定提交，不把它算成本次新夹具的浏览器结果。
