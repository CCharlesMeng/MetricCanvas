# 当前统一协议的真实模型外发授权稿（2026-09-16）

**状态：待用户明确批准；本稿不是批准。** 本轮准备不读取密钥、不发外部模型请求。当前基线 main `7583d806130723d857d3032779ffab650501e422`；执行前再固定集成HEAD、suite、工具Schema、注入策略与文件hash。

## 历史拒绝事实

2026-09-15 自动审批拒绝了使用工作区外既有配置的真实模型外发：

> This invokes a real external model using a configuration outside the workspace and may transmit project-derived prompt/context data; the user authorized bounded real evaluation generally but did not specifically authorize this payload to this destination.

原 S1 四工具授权稿与旧token样例保留在 `approval-request.s1-20260915.md`，仅供历史追溯，不能当当前协议或批准凭据。

## 本次拟请求的明确范围

是否批准以下 **当前五工具协议的两批模型评测**？

| 项目 | 范围 |
|---|---|
| 目的服务 | DeepSeek，域名 `api.deepseek.com`，HTTPS `/chat/completions`；不含敏感URL参数 |
| 请求模型/参数 | `deepseek-v4-flash`；temperature=0，max_tokens=4096，thinking disabled，无重试；历史响应名 `deepseek-flash`，固定服务端版本未核实 |
| 内容服务 | 本机生产统一工厂 `metriccanvas-platform-content`，`read_page_context / discover_data_context / compose_page / create_content_page / edit_page` |
| 可信输入 | 测试程序注入local-synthetic身份、scope/current-turn、源描述和内存候选存储；模型只持有opaque `context_ref`，续编使用 `candidate_ref` |
| 场景 | 原冻结9例，10个用户轮次/一遍 × 每例3次 × diagnostic/production两批 = **54次场景执行、60用户轮次** |
| 请求上限 | 每轮6模型请求、12工具调用；两批合计最多 **360模型请求、720本地工具调用** |
| token上限 | 每批共享600,000 token，两批最多 **1,200,000 token**；不足时停批，不追加预算 |
| 成本 | 未核实账号当前价格/折扣，历史API没有返回金额，无法可靠给出金额上限；此稿请求的是调用/token范围 |
| 参考策略 | SKILL/tools及场景workflow/layout启动注入；实际工具issues首次出现后宿主注入errors；examples默认不可用，若本批预先选 `--include-examples` 则启动注入，模式必须固定记账 |

当前diagnostic与production都使用同一五工具集合，分开记录但不声称工具集差异或真实生产路由已经验证。**旧四工具baseline网络重跑不包含在本次请求范围**；旧runner及历史结果保留，如另需旧侧真实重跑，应单列载荷和追加预算。

## 将发送的内容

- **包含项目Skill Markdown原文**、本次实际注入的流程/布局/错误/可选例子；包含从实现生成的真实五工具说明和完整JSON输入Schema，属于项目派生接口内容。
- 中文任务、local-synthetic夹具经 `read_page_context` 输出的配置投影（组件ID/类型、标题、列宽、布局、字段绑定、基线/候选引用和哈希等受控内容）。发现工具会返回合成源的业务域、版本、指标/维度匹配和解析结果；不是实际公司数据。
- 模型自己的历史user/assistant/tool消息；内容工具仅modelSummary，读取工具仅安全投影，发现工具仅其受控结果。候选续写会包含opaque candidate_ref/version/hash。
- 不直接发送Python/TypeScript实现源码；但Skill和工具Schema确实是项目内容。完整页面、数据行、原始查询、完整候选record、rootBinding、source_description_evidence、真实业务数据和其他环境变量留本机程序通道。
- 密钥未来仅由批准后的HTTP分支从既有配置内存读取，作为HTTPS Authorization发送给DeepSeek；不写入模型messages、日志或manifest。不会发送Java/Relay/盘古凭据，也不请求隐藏推理。

## 当前真实载荷的脱敏结构样例

```json
{
  "trustedContext": {
    "context_ref": "local-context-<random>",
    "mode": "existing",
    "baselineAuthority": "local-synthetic; remote latest unverified; next local turn uses last admitted candidate"
  },
  "userRequest": "把 table 的标题改为地域明细。"
}
```

读取调用示例：`read_page_context({"context_ref":"local-context-<random>","use_selection":true})`。编辑调用示例：

```json
{
  "context_ref": "local-context-<random>",
  "candidate_ref": "candidate-<same-turn-reference-if-continuing>",
  "request": {"operations": [{"id":"rename","type":"set_title","componentId":"table","title":"地域明细"}]}
}
```

根基线首次编辑不传candidate_ref。模型不传page_id、baseline_token、source_token或身份scope；创建身份由可信程序决定。样例是结构说明，最终以逐请求完整payload、实际Schema与注入hash为准。

## 停止与验收边界

HTTP/配置/协议错误、缺usage、泄漏检测、预算不足或工具越界立即停批，无重试；失败请求attempt计数保留。输入按UTF-8字节数＋协议余量＋4096输出保守预留，费用/实耗以提供方实际响应为准。

内容工具无save/publish路径；local-synthetic数据成功不等于真实数据服务可用。真实latest、Relay路由、生产身份、保存/发布/重启恢复仍blocked。原九例分数保留；当前配置问答另按`unified-content-readonly-v1`映射评分，正确回答与未冒称保存需要逐次人工语义审阅。scripted/HTTP mock证据始终不是模型成绩。
