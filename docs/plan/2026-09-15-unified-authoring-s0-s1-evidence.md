# S0/S1 实施证据

实施基线：`9d4f4444efc43f47d039d882b141207b915c8e9e`，独立 worktree `/private/tmp/metriccanvas-unified-s1-20260915`，分支 `codex/unified-authoring-s1`。日期 2026-09-15。本文件记录代码/确定性验证、真实模型行为、真实服务接入，互不替代。

## S0 来源与环境

[来源清单](2026-09-15-unified-authoring-s0-sources.json)逐项记录 275 个参考的来源路径、SHA-256、行数与字节数。两旧目录的每个参考都与来源逐字节一致：每份 91,888 行、2,963,378 字节；含主文的旧部署合计 552 文件、183,812 行。完整产品参考仍由 packages/page、docs/page-metadata、page-reference.ts、page-conformance-vectors.ts 生成，快照不变。

退役的 skill-shared 三份作者原文按字节保留在 [历史资料目录](2026-09-15-unified-authoring-retired-shared/platform-authoring.md)，仅作溯源，不参与部署。当前有效语义作者改为统一 Skill；历史规划和历史资料不成为另一套执行入口。

原始基线检查：

| 检查 | 结果 |
|---|---|
| python3 scripts/check_bundle.py | pass，1928 次摘要校验 |
| node --import tsx tools/scripts/export-authoring-contracts.ts --check | pass，474 product / 4 authoring / 1 interface |
| 系统 Python 完整回归 | blocked，缺 jsonschema 等依赖，52 项发现、32 import error；不是产品失败 |
| 锁定依赖 venv 完整回归 | 282 项，279 通过，3 项沙箱本地监听 PermissionError；未发生内容断言失败 |
| pnpm authoring:contracts:check | 首次缺依赖/网络；安装后 tsx IPC listen 被沙箱拒绝，改用等价 node --import tsx 成功 |

依赖使用锁定 pnpm install --frozen-lockfile 与 uv pip install -r tool/requirements.lock，后者安装于 work/venv。原始命令日志在 work/，不进入 Bundle；可复现命令见下文。

历史 14 例不是当前统一 Skill 成绩；TB2 独立核对旧 run_local.py、真实原始结果及 163 文件 hash。当前真实模型发送请求被自动审批拒绝，尚未发送，不能填写模型准确率或 token 改善。授权缺口及具体发送内容由 TB2 交付记录。

## AR0 决策差异

已读 ADR 索引及 0060/0061/0064/0077/0078；索引开头仍称 77 份/下一编号0078，而实际已包含0078。后续新增前必须扫描编号，不能据该旧计数覆盖文件。

| 决策 | 当前职责 | 统一规划差异 / 最晚裁决 |
|---|---|---|
| 0060 | 静态 Platform；Java 页面资产；Relay 模型循环；Python 装配 | 保留；S2–S4 增可信轮次协调，不把模型循环迁到 Python |
| 0061 | 独立 Bundle；产品作者单向导出；Skill 与 Tool 平级 | S1 registry 按生成子树所有权收敛；普通问数完整投影继续保留，未改运行接口 |
| 0064 | 内容不保存；摘要/产物双通道；Relay 会话，Java 修订 | 普通问数继续显式沉淀；Platform 自动草稿提交由0078允许，但可信协调、候选存储和持久操作职责须在S3/S4实现前补ADR |
| 0077 | 盘古对话；保留工作台；每轮结果与流程完成分离 | S2 需轮次/同步/迟到隔离，不能从旧聊天推断本轮最新；UI职责保持 |
| 0078 | Platform/Relay可发起草稿保存；精确候选确认发布；外部Java权威 | S1内容工具仍无保存/发布；S3/S4须冻结候选与操作所有权，不能用token文件假装持久执行系统 |

S1 不改变状态所有权或公开内容接口，因此本片不新增 ADR；上表未决项不能在后续仅以文档约定替代裁决与代码。

## F1–F17 迁移台账

内部来源统一为架构文档引用的调查 HEAD `aef4400d`，不是直接访问内部代码的证据。Java/前端、MetricCanvas原始来源与内部真实行为均未直接核实；所有内部迁移状态保持 pending/提供方待验证。表中目标是后续消费接口，不代表已迁移。

| ID | 职责与目标 | Slice | 验证场景 |
|---|---|---|---|
| F1 | define-report 同一作者部署别名 | S1/S7 | 注册唯一、别名与来源锁一致 |
| F2 | recall-report 页面消费入口 | S7 | 列表/打开/执行发布页保持 |
| F3 | compose/Spec 创建内容；旧Spec退出已有页基线 | S5/S6 | 新建和已有页新增都经公开内容路径 |
| F4 | metadata CRUD 收口生命周期 Adapter | S3/S4/S7 | 精确引用、冲突、草稿/发布，无模型写旁路 |
| F5 | 数据发现 Adapter/共享快照 | S5/S7 | 时间、权限、字段和真实源版本 |
| F6 | 组件选择算法/受控扩展 | S5/S6 | 硬门控，不支持类型明确失败 |
| F7 | 产品契约及校验 | S1/S7 | 全量正反例与跨语言错误分类 |
| F8 | 业务词汇扩展 | S7 | 公司词汇与通用规则分离、冲突拒绝 |
| F9 | 业务词汇/组织规则扩展 | S7 | 替换扩展不改主流程；具体内部划分待核实 |
| F10 | 缓存/预览占位符 Adapter | S4/S7 | 按轮次/候选/修订回读，拒绝旧预览 |
| F11 | 工具可见性 manifest | S1/S7 | 注册与list_tools一致，缺能力明确失败 |
| F12 | 对话 Adapter 工具投影 | S7 | 真实工具集合与诊断集合分开评测 |
| F13 | 历史删除测试资产 | S7/S8 | 恢复审查H1–H15，不能机械恢复过时断言 |
| F14 | 错误阶段/Adapter归一化 | S2–S4 | 参数、配置、冲突、取消、未知写入区分 |
| F15 | 生命周期操作身份/后端幂等 | S4 | 回执丢失查询原操作、重复恢复零重复写入 |
| F16 | 布局共享算法/受控扩展 | S1/S6 | 显式形态、旧手工布局保持、合法组合 |
| F17 | 业务时间规则扩展 | S5/S7 | 稳定版本与未知规则拒绝；具体内部划分待核实 |

## S1 作者与分发

- 唯一 Platform 作者：metriccanvas-authoring/skill/metriccanvas-platform-authoring；主文路由、两个流程按新建/修改加载，只读问答无需流程。
- 工具与加载协议由 references/tools.md 维护；布局分别在 references/layouts/；错误与例子按需。工具输入 Schema/运行校验持有完整机器契约。
- registry referenceProjection 为 none 的作者目录不被生成器写入。普通问数仅 references/page-metadata 是生成器可清理子树；其他作者文件保留。
- 完整契约快照、普通问数 Skill 及全部正反例逐字保持；退役两个 Platform 部署目录，不改生产服务。
- 当前没有公开 latest/配置补读，也没有候选链自动提交。配置不足、缺分流 Adapter 或可信基线时明确阻塞。工具发现能力不等于已有页新增查询能力。

## 外部能力缺口

| 能力 | 状态/责任 |
|---|---|
| 实际模型9类×3，全工具诊断/生产集合分离 | blocked；TB2已准备runner，外部发送审批待明确授权 |
| latest、精确补读、每轮输入同步 | pending S2；真实提供方保证另验 |
| 候选存储、最终自动提交、持久恢复 | pending S3/S4；本片不承诺 |
| Relay产物分流、身份、盘古路由 | blocked 外部 #105–#108 实证；本地fixture不能证明 |
| 内部字段协议、113规则等价、H1–H15 | blocked 提供方调查/向量；不复制敏感资料 |

## 复现命令与最终结果

从本 worktree 执行，Python 使用 work/venv/bin/python；涉及临时本地HTTP监听的完整回归需允许回环监听。

```sh
node --import tsx tools/scripts/export-authoring-contracts.ts --check
python3 metriccanvas-authoring/scripts/check_bundle.py
PYTHONDONTWRITEBYTECODE=1 work/venv/bin/python -m unittest discover -s metriccanvas-authoring/test-harness/tests -p 'test_*.py'
node node_modules/vitest/vitest.mjs run tests/authoring-export-isolation.test.ts tests/page-reference.test.ts
```

最终 S1 部署为 **8 文件、174 行、14,310 字节**；主文49行、create9行、edit8行，均低于预算。行数不用于推导token或成功率。

- 完整 Python 回归：283项通过（17.857秒）；随后新增来源/注册与例子门禁，受影响 Skill/Bundle 测试分别7/6项通过。
- TS 导出隔离/页面参考：最终21项通过，包含独立复制、来源保留、作者文件不被生成覆盖、缺链接/锁漂移/错版本反例。
- Bundle：1381次摘要校验通过；导出check通过；skill-creator quick_validate通过；git diff --check通过。
- 普通问数 Skill 与完整 contract-snapshot：git diff为空，现有问数测试保持通过。
- S0代码/确定性验证 pass；S1代码/分发 pass；真实模型行为 blocked；真实服务接入 blocked。S1整体尚未完成，后续独立代码可继续，但生产切换禁止越过这些门禁。

## 集成验收

S1作者提交 `2a52f438e441c49e51043e71eab56a6c895f54c8`；TB2来源提交 `5bdc2f20f2c0226e5d794e0f59693bfd1afd7135` 已 cherry-pick 为 `9ac7b23`；集成锁版本 `4fcb581`。本地完整回归295项通过，TS21项通过，契约导出与Bundle校验通过。新增[统一预检](2026-09-15-unified-authoring-s1-preflight.json)固定8文件hash、工具Schema hash和冻结用例hash：真实stdio四工具齐备，统一注入源缺失0，历史163文件hash匹配，模型请求0。旧入口仅在基线checkout评测；本worktree旧注入源缺失是预期退役。

规则覆盖通过主文路径、独立包链接闭合、实际受控示例Schema、现有公开内容创建/编辑/布局/部分成功/无保存副作用测试共同保留。缺参考停止、文字目标优先、明确另建、只读回答和结果措辞仍须真实模型审阅，不能从这些确定性检查推断通过。当前runner未动态补读errors/examples，诊断与生产均同四工具；这两项限制和0新模型成绩继续明确保留。
