# 创作期数值格式修复与验收

2026-09-29，基线 `6954c77d`，独立工作区 `authoring-value-formats`。

## 结果与实现

默认查询执行链现在为数值度量生成可覆盖的 `defaultFormat`，两条创作入口共用。Skill 要求核对业务单位与呈现策略，缺少业务单位时报告未知。普通折线图及柱状图的数值轴消费同一字段格式。

- 明确的人民币基础单位（元、人民币元、CNY/RMB 等受支持写法）采用现有 `cny-adaptive`。不由“流水”“收入”等指标名称判断金额。
- 完整结果中，普通数量按最小非零绝对值选择固定量级：全部非零值至少一亿时用 `compact-yi-1`，至少一万时用 `compact-wan-1`。
- 小值、跨量级、已有万元/亿元/千等单位、提供方未知缩放、结果不完整时保留原值；人民币不足一元时避免现有金额预设将其舍入为零。
- 已有 `defaultFormat` 原样保留。查询体、原始结果行、字段身份和业务单位不变。
- 同一数值轴上的系列格式不一致时保留原始刻度；双轴各自判断，避免把首个系列的单位套给其他系列。

实现使用已有字段和格式枚举，无页面协议、权限、保存或 Relay 通道变更。金额识别只用于呈现，不把普通 number 字段升级为未经治理的 money 字段。

## 验收矩阵

冻结输入与排除项见 [acceptance.json](acceptance.json)。完整聚合结果与首轮记录见 [results.json](results.json)。

| 层 | 最终结论 | 证据 |
|---|---|---|
| 无模型预检 | pass | 9 个工具，modelRequests=0；`/tmp/value-formats-preflight-final.json` |
| 确定性主流程 | pass | 金额、Tokens 数量、已按万元计量 3/3；`/tmp/value-formats-20260929-scripted-v2/report.json` |
| 真实模型 | pass | `deepseek-v4-flash`，3/3；最终同次运行 16 次模型调用、379618 tokens；`/tmp/value-formats-20260929-model-final/report.json` |
| 页面产物 | pass | 三份最终 document 经 Python 评分器与 TypeScript `validate` 校验；数据行与查询证据一致 |
| 浏览器 | pass | 三份真实模型保存产物分别重开，1440/640 两种视口；每页记录 5 次 DQE 请求，零 pageerror，无横向溢出或组件重叠 |
| 定向回归 | pass | 37 项 Python 定向测试；17 项图表测试 |
| 完整 harness | pass | 509 项，1 项既有跳过；`/tmp/value-formats-regression-stable.log` |
| 类型检查 | pass | engine、platform 的 svelte-check 与 TypeScript 检查 |
| Skill 校验 | pass | 两份 Skill 的 quick_validate 通过 |
| 分发一致性 | pass | authoring:contracts:check；Bundle 1674 项摘要校验；diff --check |
| sdist | pass | 构建成功，归档中新模块与源码字节一致；从解包目录导入成功并解析内嵌 Bundle |
| 内网生产集成 | not-run | 本次没有内网 Relay/Java/DQE 身份、部署和实际服务联调证据 |
| CI/发布 | not-run | 本次本地修改与验收，未推送或部署 |

真实模型参数沿用既有 runner：temperature=0，max_tokens=4096，thinking=disabled。模型只接收 Skill、工具 Schema、用户请求、已确认取数需求和工具有界证据；格式断言与预期页面不进入模型提示。最终三个场景注入的 Skill SHA256 均与最终工作树一致。

### 页面与人工查看

- [人民币金额](cny-document.json)：11030729.634093193 → **1,103万**；29729963.32342134 → **2,973万**。
- [Tokens 数量](quantity-document.json)：11358989639011.566 → **113,589.9亿**；23518208780053.55 → **235,182.1亿**。
- [万元原值](scaled-document.json)：保留 **1103.1 / 2973**，模型在图表和表格标题注明万元。

已实际查看三个场景各自的 `main-flow-1440.png` 与 `main-flow-640.png`，轴刻度与表格值可读，无单位二次缩放。截图位于 `/tmp/value-formats-20260929-browser-final-{cny,quantity,scaled}/`。金额轴采用现有自适应规则，因此零刻度为 `0元`、其余大值刻度为万；数量轴统一为亿。

左侧“公共 Chat 暂不可用”是本地工作台未连接对话服务的状态，不作为生产集成通过证据。此处验收的是保存页面重开、正式数据网关重新取数与渲染。

## 首轮与重试记录

1. 初始 3/3 模型运行保留于 `/tmp/value-formats-20260929-model`。模型指出金额夹具仍沿用了“请求次数”的定义；该轮不能作为完整业务口径验收。
2. 修正夹具指标名、定义和单位后，`/tmp/value-formats-20260929-model-v2` 3/3 通过。
3. 补齐完整性保护，并在 Skill 中说明小值/已有缩放保留原值是合法策略后，以最终 Skill 全量运行 `/tmp/value-formats-20260929-model-final`，3/3 通过。
4. `/tmp/value-formats-regression-final.log` 有一次失败：契约生成器重建目录与测试读取并发，出现 Schema 文件暂时缺失。停止生成后顺序重跑 `/tmp/value-formats-regression-stable.log`，509 项完成、1 项跳过，退出码 0。失败轨迹保留，未计为通过。

## 交付与边界

源包：`/tmp/value-formats-20260929-dist/metriccanvas_authoring-0.3.1.tar.gz`。

SHA256：`6d5d64dd7384457e4048b1e60039f073a7e661439f4ddeebcc37e9769866e20e`。

内网接入时需同步工具包与 Skill；图表轴修复需要部署相应渲染引擎。版本号仍为 0.3.1，核对精确包摘要，不能仅凭版本号判断新代码已生效。现存页面不会自动改写，需重新生成或显式调整字段格式。单位元以人民币基础单位约定处理；其他币种不会自动套用人民币格式。

真实 DeepSeek 调用已经发生，但 Java、DQE 与 Relay 仍是本地受控替身。不能将本报告表述为“内网生产联调通过”。
