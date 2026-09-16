# 统一创作评测：当前入口与历史边界

当前实现基线：main `7583d80`。**真实模型外发仍待具体授权**；本轮只执行本地生产stdio、scripted传输及HTTP mock，不读取密钥。模型、远端latest、Relay/生产身份、save/publish和真实提供方成绩分别记账；本地检查通过不代表这些能力通过。

## 选哪个入口

| 目的 | 当前入口 | 范围 |
|---|---|---|
| 当前五工具本地检查 | `run_trusted_local.py --transport scripted --suite local-smoke` | 真实统一工厂/stdio + 合成scope/current-turn/数据与内存候选；结果必须non-model-evidence |
| 无密钥列工具/核对Schema | `preflight.py --surface unified-content` | 不传config即可不读密钥；不调用模型，也不证明可写/latest |
| 批准后的当前九例模型运行 | `run_trusted_local.py --transport http --allow-real-model --suite frozen` | 同一共享循环；必须另给已批准config；当前未获批 |
| 新旧原评分及新版协议评分 | `eval_evidence.py` | 原status/counts保留；新版只读协议单列protocolAssessment/protocolCounts |
| 历史S1基线重跑 | `run_local.py --arm baseline`，在保留旧Skill的固定checkout | 四工具旧协议；当前五工具Skill会被请求前门禁拒绝，不是当前运行入口 |
| 原14例来源 | `history/` | 原样归档，旧score_local写死语义评审，禁止拿来给新样本评分 |

当前真实注册为 `metriccanvas-platform-content`：read_page_context、discover_data_context、compose_page、create_content_page、edit_page。模型参数用context_ref，续编用candidate_ref；不传page_id/baseline_token/source_token。`--profile diagnostic|production`目前均使用相同五工具集合，分开记录但不宣称存在工具集合改善或生产路由证据。

## 本地可运行命令（无需凭据）

在仓库根目录运行，Python >=3.12，依赖沿用tool/requirements.lock。本机已有 `/private/tmp/metriccanvas-unified-s1-20260915/work/venv/bin/python`；下列`PYTHON`代表该环境。

```sh
PYTHONDONTWRITEBYTECODE=1 "$PYTHON" metriccanvas-authoring/test-harness/model-evals/preflight.py --surface unified-content --output "$NEW_PREFLIGHT_JSON"
PYTHONDONTWRITEBYTECODE=1 "$PYTHON" metriccanvas-authoring/test-harness/model-evals/run_trusted_local.py --transport scripted --suite local-smoke --scenario missing-data --repetitions 1 --include-examples --output "$NEW_RAW_DIRECTORY"
PYTHONDONTWRITEBYTECODE=1 "$PYTHON" -m unittest discover -s metriccanvas-authoring/test-harness/tests -p 'test_*model_eval_harness.py'
```

输出文件/目录必须全新，拒绝覆盖。`--scenario all --repetitions 3`可完整跑12类本地协议检查；本次只跑受影响定向场景，不重复历史36次全量。scripted不接受config/真实调用开关，父进程及合成stdio子进程硬拦截IP连接。所有模拟结果modelRequests=0、usage=null，simulatedModelCalls单列，任何review都不能将模拟结果变成真实模型pass。

## 输入、参考与程序通道

- 本地测试server真实import生产统一factory；scope/current-turn来自测试程序写入的受限启动状态文件，不是模型输入。源描述/Data Context/DQE显式为local-synthetic。缺提供方返回精确CURRENT_TURN/SOURCE_DESCRIPTION/DATA_CONTEXT/CANDIDATE_STORE错误，不回退旧服务。
- 初始注入SKILL.md、references/tools.md、相关workflow；创建/显式切换注入选定layout。模型没有文件读取工具。
- **errors.md可执行路径**：宿主在真实工具结果首次含issues后，从固定作者路径注入；同一响应的全部tool消息先完成，再追加参考system消息，不添加模型调用预算。只加载一次，缺作者文件在模型请求前失败。
- **examples.md可执行路径**：明确需要参数例子时用`--include-examples`在启动注入。默认不提供，部署声明会告诉模型缺此能力；不能要求任意文件补读或让数据发现代替文档搜索。该开关是运行配置，比较批次不得临时更换。
- `injection.json`记录policy及逐文件hash/phase/turn/step；manifest锁定所有可能注入源、suite、runner/transport/fixture及依赖hash。errors是受控宿主注入，不等于通用动态文件工具；examples并非模型任意请求后自动读取。
- read_page_context仅暴露有界安全投影；发现工具回受控匹配；写内容工具只回modelSummary。完整candidate record/document/rootBinding/operations/source_description_evidence留程序通道。
- 同轮候选续写校验根绑定、父引用、版本、完整文档及hash；unchanged只能复用已见的相同候选。多轮保留安全历史并追加新context；scripted只从本轮消息解析候选。下一轮基于程序最后接纳的本地候选重建上下文，**不证明远端latest、最终选择或提交**。

## 原九例与协议版本映射

`unified-authoring.cases.json`和原hash保持不变；本地smoke并不替代冻结九例。`protocol-acceptance.v1.json`将原suite哈希绑定到 **unified-content-readonly-v1**，仅对原配置问答案例增加当前协议评估：

1. 不调用任何创建/编辑工具，也不调用数据发现。
2. 程序侧前后文档相同、无候选；成功读取当前选中目标的完整有界配置，实际工具结果与trace一致。
3. 人工逐次核对回答是否符合读出的配置与原语义期望（含显式值/未设置/省略区别），以及是否冒称保存/发布。

原noTools分数仍为inconclusive，既有status/counts原样输出。新protocolAssessment只替换该断言的适用方式，复用其余证据门禁并单独统计protocolCounts；因此原协议分数不被改写，新协议也不因已知接口差异永久卡住。缺人工语义审阅仍inconclusive，scripted/mock证据仍blocked，缺trace/可信基线不能pass。映射改变必须新版本，不调整原case来适应结果。

```sh
PYTHONDONTWRITEBYTECODE=1 "$PYTHON" metriccanvas-authoring/test-harness/model-evals/eval_evidence.py "$RAW_DIRECTORY" --reviews "$REVIEW_JSON" --output "$NEW_REPORT_JSON"
```

原review字段继续支持。新版配置问答需在对应`case-id/repeat`下附`protocolReviews`，例如：

```json
{
  "heldout-config/1": {
    "protocolReviews": {
      "unified-content-readonly-v1": {
        "reviewer": "<human reviewer>",
        "reason": "<逐次审阅理由>",
        "resultSha256": "<result.json hash>",
        "mappingSha256": "<protocol-acceptance.v1.json hash>",
        "evidenceFiles": {
          "response-1-1.json": "<实际最终答复文件hash>",
          "program-tool-1-0-1.json": "<成功配置读取文件hash>"
        },
        "criteria": {
          "configurationAnswerGrounded": {"status":"pass","reason":"<对照原语义期望和完整配置的理由>"},
          "noFalsePersistenceClaim": {"status":"pass","reason":"<答复未冒称保存/发布的理由>"}
        }
      }
    }
  }
}
```

文件名须对应实际轨迹，不能照抄示例；缺少/改动hash、没有最终答复或成功配置读取，语义审阅不生效。模型完整request/response及工具结果都保留，不按固定文案自动判答案。

## 真实HTTP：只有具体批准后才运行

[当前授权稿](evidence/approval-request.md)已改为五工具/context_ref、实际发送内容与每批共享预算；本轮未获批。`--allow-real-model`是显式运行开关，不代替用户批准。以下仅供批准后的运行者：

```sh
PYTHONDONTWRITEBYTECODE=1 "$PYTHON" metriccanvas-authoring/test-harness/model-evals/run_trusted_local.py --transport http --allow-real-model --config "$APPROVED_CONFIG" --suite frozen --scenario all --repetitions 3 --profile diagnostic --token-budget 600000 --output "$NEW_RAW_DIRECTORY"
```

production另批运行，参考配置固定。每轮最多6模型调用/12工具调用；整批共享600k token，无重试，配置/HTTP/协议/缺usage/泄漏/预算错误停批，attempt保留。两个当前协议批次共54场景、60用户轮次，最多360模型请求/720本地工具调用、1.2M token。旧baseline网络重跑不在当前授权请求中；若需要，另列旧载荷与预算。真实服务端模型修订、费用和外部提供方事实未核实，不由配置字符串推定。

## 历史与当前证据

- history/：原14例6pass/3fail/5blocked及原runner/来源；163个原始文件曾逐一hash核验。13例实际调用、34请求，路由均未验；不当作完整平台成功率。
- evidence/approval-request.s1-20260915.md：原授权稿和拒绝事实，非当前批准。
- evidence/trusted-local.*、trusted-history.report.json：之前的36次协议检查和多轮补充，全部non-model-evidence；保留不覆盖。
- 本次准备修复的定向命令、结果和文件hash见evidence/readiness-20260916.json；完整本地原始记录在git忽略的local-runs/。

真实完整页面/候选不提交Git；原始本地记录受限存储。文件行数、synthetic成功数、预检列工具均不能换算真实模型成功率、生产写入保证或费用。
