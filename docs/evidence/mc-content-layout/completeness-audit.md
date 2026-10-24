# MC 内容完整性：静态核查摘要

日期：2026-10-24。检出：`6f471f0230b276d5d217e74f8b278c79fc8f732d`。MC 实现来源：`1ba49b1742ebbed7353853cb5f82e5b692993fd4`。

本页只记录静态源码与现有生成物核查，不代表新运行回归、真实 Relay、DQE、保存或渲染验收。按当前仓库规则保留简短结论，原始 `completeness-audit.json` 留本地且被忽略，不作为 Git 交付依赖。

## 本次测得的数据

| 对象 | 核查结果 |
|---|---|
| 内容版本 | `1-e9aba00bba96353d` |
| 内容 SHA256 | `e9aba00bba96353d204bb30549fe3c0b395f290474842dd1b1487cc420662295` |
| 清单资源 | 387，不包含版本清单自身 |
| 页面 Schema | 与 `contract-snapshot/page/schema.json` 字节完全相同 |
| Schema 文件字节 | 272,713 |
| Schema definitions | 107 |
| query_content 对 Schema 内容的计量 | 121,894 UTF-8 字节；按 Python `json.dumps(value, ensure_ascii=False)` 计算，不含响应封套 |
| 默认 maxBytes | 32,768；该 Schema 超预算时不会作为完整原子返回 |
| 产品知识模块 / 节点 | 33 / 2,032 |
| 产品参考 Markdown | 36，包含索引说明，不等于 36 个知识模块 |
| 现有 local-authoring 知识主题 | 155 |
| 产品不变式 | 116 |
| 示例覆盖记录 / 分支覆盖记录 | 55 / 300；记录数不等于独立文件数 |
| reference-map 声明口径的语义缺口 | fields/enums/examples/branches 均为空；不代表真实模型或部署验收 |
| MC 是否包含 reference/knowledge 生成树 | 否 |
| 工具参考 | 9 |
| 导出完整 inputSchema 的工具参考 | 0 |
| 附有内层 requestSchema 的参考 | 1：compose_page |
| 错误原子 / 有 guidance / 无专门 guidance | 348 / 83 / 265；需分类，不能直接把无专门 guidance 全部判为缺陷 |
| 本次扫描的包内 Markdown 相对文件链接缺失 | 0；不覆盖主题与 Schema 指针语义 |

## 当前查询索引范围

- protocol：data-analysis、page-schema、version-policy。
- tool：9 个活动 MCP 工具的参考。
- layout：5 个模板文件，包含不可执行的 IOC 登记。
- runtime：contract-alignment、error-repair、execution、tool-behavior。
- snapshot：单个整体 snapshot。
- error：348 个稳定键。

包内已有但当前 query 索引未覆盖的布局正文：`layouts/dashboard.md`、`layouts/report.md`、`layouts/reading.md`。

manifest 资源分布：errors 348、tool-contracts 9、scripts 9、layouts 10、protocols 3、runtime 4，另有 snapshot、示例矩阵、索引及 README 各 1。

## 可复核来源与方法

1. 对照 MC `mc-content.version.json` 的 files、实际目录及 `index.json`，统计类别与可达键；扫描 Markdown 相对文件链接。
2. 按字节比较 MC 页面 Schema 与产品快照，解析 definitions 和真实 query_content 内容计量方法。
3. 读取产品 `page/reference/index.json`、`rules.json` 与 local-authoring 的 `authoring-knowledge/model.json`，统计模块、主题、节点、规则和覆盖记录。
4. 逐一读取工具参考，区分签名文本、内层 requestSchema 与完整工具 inputSchema。
5. 核对 `export-authoring-contracts.ts` 的 writeOutputs/assertCurrent：已有 MC 生成和漂移检查，但没有全体 MC 知识覆盖分母的独立门禁。
6. 核对 `mc-contracts.py`：AST 提取活动工具签名；literal_errors 的当前扫描范围包含内部 adapters，这一公共生成作用域风险仅由代码推导，未在本轮动态复现。
7. 核对 `mc_inspection.py` 与产品 normalize/parse：完整页面合法性调用产品实现，但专门声明检查的组件映射局限于顶层。

核查计数以这次固定检出为准。实施时应从真源动态计算覆盖，不能把这些数量写死成永久通过标准。

后续方案见[完整性审查与 Schema 同步构建](../../plan/2026-10-24-layout-standards/mc-content-completeness-plan.md)。
