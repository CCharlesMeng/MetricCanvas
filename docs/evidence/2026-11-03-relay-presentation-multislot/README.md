# B：呈现正确性与受控多槽表格

基线 `2172df5450a09803685773ae5bc65df766168c98`，隔离树 `/Users/moon/.codex/worktrees/relay-presentation-multislot/DataDashboard`。与主控目标 `2b6bbe` 核对本批共用字段解析/组件数据文件没有上游重叠。主目录、上一批冻结树与旧证据只读；没有 commit、push、CI 或部署。正式自有清单见 `source-manifest.json`，携入依赖另列；新生成候选不冒充作者源。

## 实际接口与兼容

- **旧 13 个入口不变**。原 Python 字段呈现函数默认 `legacy` profile，新增行为只在 `results.normalize.v2` 显式选择。B 拥有的 7 个旧 descriptor 与 r6 最终契约相同；在同一 r6 资源上下文中，10 个旧 Python 完整输出向量逐值/完整有序诊断相同，没有重录冻结期望。
- 新 `results.normalize.v2`、`page.compose.v2`、`page.edit.v2` 从 `data.presentation_operations` / `pages.multislot_operations` 装配。新 compose/edit 同时支持原单源和 tableSlots，并沿用同一有序批处理/单操作回滚；不把新呈现能力只绑在多槽名字上。
- Node 新 `page.presentation` 由 `core/presentation/contract.ts` / `operation.ts` 单一维护描述、4 个自检向量、解析和检查；A 只注册与分派。仅 inspect，不擅自改用户显式格式。C 只执行可信 POSTPROCESS 元数据指定的真实 Node 操作，再由 B 纯 `apply_postprocess` 合并。新数值发现保留候选并标 partial；审计本身 error 时不返回合格候选，document 为 null。旧入口没有 hook。
- `page.edit.v2` 可提供 `presentationIntent.rawValuePaths`，只对对应最终绑定的非缩放 **number 族**承认明确百分比原值意图；compact/cny 等不会获豁免。标题、列宽、纯组件重排、JSON 对象键重排不重报旧未触及冲突；真正新增绑定或数值源契约改变仍检查全部真实消费者。保留当前 JSON pointer 作定位，差分身份用稳定组件/绑定角色和多重集，不把旧 pointer 当永久身份。

新受控多槽块最小形状（不是 PageDocument 新字段）：

```json
{
  "id":"comparison", "type":"data", "component":"table", "title":"期间对比",
  "purpose":"reconciliation", "source":"current", "fields":["region","amount"],
  "rowKey":"region", "tableSlots":{"prior":{"source":"prior","fields":["amount"]}},
  "periods":{
    "main":{"start":"2026-01","end":"2026-01","granularity":"month"},
    "prior":{"start":"2025-12","end":"2025-12","granularity":"month"}
  },
  "pagination":{"mode":"local","pageSize":5}
}
```

每槽 `source`、列字段归属、共同 rowKey、实际 request.time 与明确期间分别核对。只要求各槽稳定行键同 ID/类型；不要求所有度量字段集合相同。辅助 query 须 complete 且实际行集已证明完整；0/0 正常空结果。缺匹配留空、额外辅助键不生成主行，覆盖报告只针对本次返回主键。重复/空/错误类型键、失败槽、unknown、期间不匹配明确拒绝受影响块。主 partial 只有单维稳定行键与可信第一 query 窗口时启用查询分页；不退成本地过滤或将当前页当全集。所有原始行/字段 ID/查询保持，核心没有第二份 join 行缓存。

编辑新增 `add_multislot_table` 与 `extend_multislot_table`，后者保留既有组件 ID、布局、人工列/列组/列宽/交互，追加明确的新槽列；不静默删旧消费者。既有 set_table_column 等操作继续按 slot 定向编辑。新操作完整 request Schema 在自己的 descriptor 内，外层校验之后由块/操作维持独立失败和有序诊断。

## 单真源与闭包

`core/presentation/policy.json` 是共享规则表：可信单位类别、已缩放标记、百分比刻度、百万/缩放格式族、除数与精度安全条件；不新增 format 枚举。`authoringPresentationPolicy(root):Promise<string>` 通过既有 canonicalizeJson 生成唯一规范文本，供官方 OutputMap 登记 `exported/authoring-presentation-policy.json`；写文件 wrapper 委托同一 reader。Python 运行时只读 `bundle_root()/contracts/exported/authoring-presentation-policy.json`，没有开发路径回退。

两种职责明确区分：Python 从明确执行覆盖与可信描述选择默认值；Node 检查已有页面最终绑定的适用性，不重新推断分布或发明单位。`conformance.json` 的重叠边界由两条路径复用；格式文本仍用现有引擎 formatter，未复制格式器。完整基础 Tokens 可按既有阈值选择百万；partial/unknown 不按样本猜 scale，已缩放值不再缩放，相容显式格式保留，来源建议冲突仅新 profile 可调整。金额/其他单位仍按原 number/万/亿选择；合法金额百万页面仍通过原产品解析，仅新 AI 创作政策报告适用冲突。

字段消费扫描复用 A `scanPresentationBindings` 真正 Schema walker，包含 badge 数组、changeField、secondary、pinnedTop、byFilter 叶和准确转义路径；不维护另一份组件属性名单。子表复用现有 rowExpansionPage 的私有作用域。泛用 `resolveField` 原算法原样下沉至 `packages/page/src/field-resolution.ts`，引擎旧 API 导入/重导出同一函数与类型；audit 只依赖 Page 纯源，没有 engine/dist、Svelte、ECharts、DOM 或网络闭包。真正 axis/labels/Tooltip 选项构造器仅用于测试证据。

本地工具由 A 已存在的 Node-only `associate-data.mjs page.presentation --page ... --input ...` 委托相同核心。没有新增独立 Python/local 流程，也没有第二个 presentation CLI。PageDocument 字段净增减 **0**。

## 验证

- Python **124/124**：新 profile、完整/部分/unknown/已缩放/显式覆盖、旧单源、多槽创建/扩展/原子回滚/缺键多键空集重复/失败/期间/分页、自检向量、原 query/edit/平台兼容。见 `python-tests.json` / `.log`。
- TypeScript **30/30**：新审计（含局改稳定身份、raw 意图负例、真实 Schema 消费位置和子表）、既有 component-data、chart-format-consistency、axis-formats；全部类型检查通过。测试使用明确 source alias，使泛用 resolver 的新来源生效，未把旧 dist 当作新源证明。
- 7 个旧 Python descriptor 全同、10 个完整旧输出与 r6 同资源逐值/顺序全同，见 frozen-*。直接无 Node 资源的旧 Python 预检本来有重复诊断，与 Node 产品不是同一证据层；没有据此重录任何旧消费者。
- Node 独立 bundle target **node22**，实际运行 **Node v24.11.1**，关闭 fetch/DOM 后对合成 Dashboard 成功；模块图没有 engine/Svelte/ECharts/外部导入。实际 Node 22 二进制未单独运行，不能据 target 声称已测特定 22 小版。见 `node-operation-probe.json`。
- CC：同口径 TS AST 与 Radon 6.0.1，修改及全部新增函数/回调 ≤15。原 resolver **6→6**；block_component **16→5**，提取的单源职责 **13**。未修改 `validate_plan` 的存量 **24** 单列保留；固定 authoring Radon 门禁通过。见 complexity-* 与 fixed gate。

场景 `/pages/relay-multislot-presentation` 是完整 Dashboard 内联合成页面，真实 parsePage 与 Node 新操作通过；README 给出缺匹配、额外键与百万轴/标签/Tooltip 的预期。浏览器、主控官方生成/独立 Skill 安装、C 新发行真实 POSTPROCESS 仓外回验、packages/Embed 重建及真实 Relay/保存/部署由集成层分别验收。本证据不把这些未运行层级标绿；所属元数据文档独立片段为 `page-metadata-fragment.md`。
