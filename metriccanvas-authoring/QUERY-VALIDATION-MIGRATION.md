# 查询校验整改与 Adapter 迁移

本批为源码整改，未发布新的固定版本制品。部署须记录最终公共提交和内部适配提交，不能仅用既有 Bundle 0.3.1 版本号区分是否已包含修复。

## 默认与快速开关

公共 `query_data` 默认 `relaxed`。关闭的仅是可选语义预检：元数据没有列出某个受支持粒度、维度值、组合关系时，在查询可确定构造且已授权的前提下交给 DQE 验证。身份、确认授权、上下文版本、输入结构、预算、结果字段验证和保存规则始终保留。

设置可信配置文件位置：

```sh
export METRICCANVAS_QUERY_VALIDATION_CONFIG=/absolute/path/query-validation.json
```

文件内容：

```json
{"queryValidation":{"strict":false}}
```

改为 true 开启严格预检。内部配置管理程序以临时文件加原子替换更新该文件；每个新查询批次读取一次，当前批次保持既定策略。文件路径由进程启动环境提供，内容可热更新；不用修改模型参数、删除状态库或重新打包。文件最大 16 KiB，非法值、不可读或错误结构返回 `QUERY_VALIDATION_CONFIG_ERROR`，不静默切换模式。

未设置文件时读取 `METRICCANVAS_QUERY_VALIDATION_STRICT=true|false`，缺省 false。修改外部环境变量需要重启常驻进程；需要热切换使用文件。配置文件优先于环境布尔值。

两种模式均规范化 `M → month`，并解析唯一可信业务域 ID 与指标/维度别名。不会删除时间或地域筛选，也不会猜测歧义业务域。结果包含 `validationMode`、`warnings`、`normalizations` 和规范化后的实际 `scope`。严格失败与宽松执行使用不同 resultRef；模式或规则版本变化后旧结果不能直接用于当前页面装配，返回 `RESULT_VALIDATION_POLICY_CHANGED`，但仍可读取带原模式的历史证据。

## Adapter 协议变化：必须核对

| 接口 | 本批变化 | 内部需要做什么 |
|---|---|---|
| `AuthoringAdapters` / `create_adapters()` | 保持 `authoring-adapters/1.0` 和既有必需方法；没有新增必填字段 | 不重写工厂，不覆盖身份和真实端点 |
| `DataContextPort.current()` | 保持中立 Schema 1.1 的严格快照 | 现有实现可继续使用；它自身的治理拒绝不会被公共代码吞掉 |
| **可选 `current_for_query(policy)`** | 新增 `query-context/1` 能力；参数为公共 `QueryValidationPolicy`，不是模型输入 | 要让缺失的可选治理属性不再提前阻断，采用此入口；参考 Java/Lab Adapter 已实现 |
| 公共 Lab 投影 | 移到 `metriccanvas_authoring.data.lab_projection`；两个参考 HTTP Adapter 委托该模块 | 采用公共投影，保留公司信封/认证转换；不再手工复制通用投影算法 |
| 发现 `matches` | 新增 `kind`，可为 metric 或 dimension；指标新增 businessDomain；顶层补 dimensions、businessDomains 和覆盖说明 | 自定义发现实现需提供等价查询语义；消费者不能再假定每个 match 都有 metricRef |
| 查询授权 `authorize(binding, request, version)` | 签名不变，传入的是规范化后的请求；授权摘要仍为 `digest(request)` | 确认记录应绑定公共规范化后的计划。不得返回固定授权或把旧未规范化摘要无条件接受 |
| `DqeExecutionPort.execute()` | 签名和返回结构不变 | 不增加“宽松直通”接口；现有认证、拒绝、行映射继续执行 |
| Java 保存 / Relay 交接 / CAS | 协议不变 | 保留未知写入、精确基线和跨进程状态 |

### `query-context/1` 返回规则

```python
from metriccanvas_authoring.data.lab_projection import project_lab_snapshot
from metriccanvas_authoring.data.validation_policy import QueryValidationPolicy

async def current(self):
    return await self.current_for_query(QueryValidationPolicy(strict=True))

async def current_for_query(self, policy):
    # 从可信身份和授权数据集范围读取；省略部分沿用内部真实实现。
    snapshot = project_lab_snapshot(
        subject_id=subject_id, details=models, projection=projection,
        values_by_dataset=values_by_dataset, policy=policy,
    )
    # 与 search() 同源的版本指纹，包含源元数据、治理与权限范围；不能随机或恒定。
    snapshot['version'] = discovery_version
    return snapshot
```

宽松查询视图携带 `queryValidationView: "1"`，允许指标的 additivity、timeAggregation、isRatio 缺失，公共查询读取器将其作为 unknown。**这是私有执行视图，不是放宽了中立 Schema 1.1，也不是可写入页面的文档。** 不得将该视图给仍要求完整中立 Schema 的消费者。`current()` 保持原协议，`current_for_query()` 使用 `parse_data_context(snapshot, policy=policy)` 校验。

对于指标目录暂未收录但存在可信字段声明的测度，私有查询视图也允许对象字段 `roleHints: ["measure"]`；必须提供真实 type、nullable、sensitive 等字段事实。宽松模式可据此派生查询字段契约，严格模式仍拒绝缺失指标目录条目。没有可信类型/身份的任意指标名仍被拒绝，不从几行样例猜类型。此能力不是要求 Adapter 伪造字段声明；没有真实来源就不提供。

安全、身份、敏感性和执行字段所需的类型/可空性保持必需。非法的已声明治理值始终拒绝，不能用 defaults 掩盖。公共转换不再仅由 SUM/COUNT 等聚合符号推断可加性/时间聚合；严格模式需显式源声明或经治理确认的配置，宽松模式允许其缺失并返回警告。单位尺度未知不自动转换。

参考 `JavaDatasetMetadataProvider.search()` 与 `current_for_query()` 使用相同元数据/治理版本；策略另进入查询结果身份，不冒充数据版本变化。Lab 公共投影的版本现在由源元数据、治理与维度值指纹生成，严格/宽松共用数据版本；旧 Lab 版本指纹升级后须重新发现。Java 提供方仍使用其同源统一指纹。同批次快照仅读取一次。自定义 Adapter 必须保持相同身份/版本约束，不能在同一版本下悄悄换字段含义。

未采用新方法的旧 Adapter 自动走 `current()`，兼容运行，但若它自己先报 `DATA_CONTEXT_GOVERNANCE_REQUIRED`，公共宽松开关不能凭空恢复它没有返回的元数据。诊断命令的 `policyAwareProvider` 可识别此情况。

### 发现输出的消费变化

- 指标卡保留既有 metricRef/source/detailRef，增加 kind=metric 和规范 businessDomain。
- 维度匹配返回 kind=dimension、name、label、businessDomain、isTime、granularities、filterability。name 是查询名，label 是展示名，二者不能互换。
- 顶层 dimensions 给出相关模型的维度；没有证据时 metricCompatibility 和取值保持 unknown，不宣称每个指标都能与所有维度组合。
- matchCoverage/dimensionCoverage 标记受限投影是否截断；原 coverage 仍表示源提供方的数据集读取覆盖，不代表查询能力全量已验证。
- 原始发现的 executionReadiness 为 not_checked；发现成功不等于治理、授权和真实执行已经通过。

## Skill 与现场恢复

更新公共 Tool 与同批 Skill，重新发现、确认计划再查询。模型应使用返回的业务域、维度和粒度；尤其“中国区”必须进入 filters 或有已确认的指标固有口径，不能把无地域条件的结果标为中国区。半年窗口与跨期总量也要分别核对。

```sh
.venv/bin/python scripts/check_data_context.py
.venv/bin/python scripts/check_data_context.py --strict
```

第一条使用当前部署策略，第二条独立检查完整治理。两者都只检查元数据，DQE/save/relayHandoff 仍为 not_checked。旧部署使用自有投影时先迁移公共投影，再检查；不要整目录覆盖 adapters。

更正配置后新建可信创作轮次，重新发现取得版本和合法参数。校验开关本身支持同轮下一批生效，但不会重发先前保存，也不免除新查询范围的确认。回传实际策略、规范 scope、错误候选及 DQE 执行结果；不回传凭据、SQL 或原始公司错误。
