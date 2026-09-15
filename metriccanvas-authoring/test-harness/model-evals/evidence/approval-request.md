# 需要用户具体批准的真实模型评测

状态：blocked。尚未执行本轮真实模型请求。2026-09-15 的自动审批拒绝原理由：

> This invokes a real external model using a configuration outside the workspace and may transmit project-derived prompt/context data; the user authorized bounded real evaluation generally but did not specifically authorize this payload to this destination.

## 具体请求

是否批准向 **DeepSeek / api.deepseek.com** 发送以下范围，用既有配置执行隔离的本地内容评测？使用已核验的历史 `/chat/completions` 协议，配置只从本机既有 `.env` 内存读取；不复制密钥。

- 请求模型：`deepseek-v4-flash`；历史返回 `deepseek-flash`，服务端固定版本无法核实。temperature=0，max_tokens=4096，thinking disabled，无网络重试。
- 发送数据：项目 Skill Markdown 原文及本场景流程/布局参考、由实际内容 MCP 注册生成的工具说明与 JSON 输入 Schema（属于项目派生接口信息）、人工编写的中文任务、程序夹具的组件 ID/类型/标题、布局、基线引用/哈希、必要目标配置、模型自己的历史消息与内容工具安全摘要。
- 包含 **Skill 文本、夹具摘要、从源码生成的工具 Schema**；不直接发送 Python/TypeScript 实现源码。静态 Skill 本身是项目内容，不能视为完全不出项目数据。
- 不发送：API 密钥、Authorization 头的日志副本、其他环境变量、真实业务数据、完整页面、数据行、原始查询、完整产物、模型隐藏推理请求、Java/Relay/盘古凭据。网络认证本身仍须把 API 密钥通过 HTTPS Authorization 发送给 DeepSeek。
- 9 场景 × 3 次独立会话；旧/新 Skill 各跑全工具诊断及生产配置，共最多 108 次场景执行、720 次模型请求。生产四工具与诊断四工具当前相同，仍分开记账，不宣称差异来自工具删减。
- 每批最多 600,000 token，共四批最多 2,400,000 token；采用输入 UTF-8 字节数＋协议预留＋4096 输出的保守准入估算，实耗以 API usage 计数。若当前批预算不足，不运行余例，不自动追加预算。费用未知：没有核实本账号当前价格/折扣，API 历史未返回金额，不能提供可靠金额上限。
- 每轮最多 6 模型请求、12 工具调用；配置/HTTP/协议错误、缺 usage、泄漏检测、超预算或工具越界立即停止批次并标 blocked，无重试。内容服务无保存/发布能力。
- 缺数据服务的创建场景仍须明确 blocked；只读/局部编辑产物可离线校验。主实现 commit 和注入哈希冻结后才运行新 Skill；留出输出不反馈提示改写。

## 脱敏代表样例

以下结构展示会发送的类别，真实引用由程序当次生成：

```json
{
  "trustedContext": {
    "entry": "platform",
    "page_id": "eval-random-id",
    "baseline_token": "baseline-random-token",
    "baselineRef": {"pageId": "edit-example", "revisionId": "fixture-r1", "resourceId": "isolated-eval"},
    "documentSha256": "<fixture-hash>",
    "layout": "report",
    "sections": [{"id": "main", "components": [{"id": "table", "type": "table", "title": "Table"}]}]
  },
  "userRequest": "把 table 的标题改为地域明细。"
}
```

另有系统消息携带实际 Skill 及已声明参考文本；工具定义含实际 `edit_page(baseline_token, request)` 输入 Schema；工具返回仅 `modelSummary`。完整 fixture 和候选仅写本机受限目录。这里展示的截短样例不替代实际注入 hash 清单。
