# 分组页面参数与多时间输入

状态：2026-09-20 用户确认，页面协议 6.6 实现。本方案替代 2026-09-17 模板方案中的参数数组与 timeRange.value 设计；模板与实例继续使用同一 Page 文档，查询引用仍原位声明。

## 文档结构

```json
{
  "params": {
    "dimensions": [
      {"id":"region","dim_name":"地区部","dim_value_list":["中国地区部"]}
    ],
    "times": [
      {"id":"report-period","granularity":"month","start":"2026-01","end":"2026-06"},
      {"id":"comparison-period","granularity":"month","start":"2025-01","end":"2025-06"}
    ],
    "scalars": [
      {"id":"heading","type":"string","value":"半年对比报告"}
    ]
  }
}
```

- dimensions、times、scalars 都是可选非空数组；声明 params 时至少有一个参数。scalars 保留纯展示输入，类型为 string/number/boolean。
- 所有组共享参数 ID 空间，ID 格式沿用小写字母、数字和中划线。每个参数必须有消费者，不与筛选器重名。
- required 缺省 true，label 可选。维度统一使用非空、无重复的字符串列表，不另设 multiple。dim_name 明确业务字段，消费查询的 dim_name 必须一致。
- 实际值直接写 dim_value_list、start/end 或 value；新结构不接受 default。未填模板省略实际值；时间起止必须同时省略或同时填写。
- granularity 为 month/date，校验真实日历、0001—9999 年与 start ≤ end，区间包含两端。period、is_aggregate 留在各查询中。
- times 的每一项是独立输入；报告期间和对比期间可以分别填写。根据单个基准月份派生上月、全年等仍由旧 time + window 能力承接，不把派生窗口误当成多个独立输入。

## 消费关系

```json
{
  "filter": {
    "dims": [{"dim_name":"地区部","dim_value_list":{"param":"region"}}],
    "time": {
      "period":"month",
      "is_aggregate":false,
      "start":{"param":"report-period","part":"start"},
      "end":{"param":"report-period","part":"end"}
    }
  }
}
```

另一查询可以引用 comparison-period；同一查询的起止必须来自同一个参数。维度引用整值替换列表。month 对应 period=month，date 对应 period=day，不隐式转换。

只允许在 dim_value_list、time.start/end 这些受控位置引用必需参数，不允许引用字段名、指标、分组、排序或其他请求节点。原位引用目标不能同时受 filterBindings、旧 paramBindings 或同维度静态条件控制。参数不会按名称自动注入每个查询。

文本继续使用 `{param:id}`。维度多值用顿号连接；区间显示“start 至 end”，相同起止只显示一次。可选参数不能用于必需文本。

## 执行与兼容

保存和 normalizePageDocument 保留分组声明与引用；parsePage 只在运行态归一化声明。引擎先确定实际输入，再在查询副本中替换引用；不修改原始文档，不重写查询聚合设置。

未填值模板可保存与校验，必需值不全则阻止执行。运行态不使用筛选历史补值。带参数引用的查询不消费没有当前执行凭据的 initial 旧行；可信执行回执仍按既有执行入口核验。

URL 以参数 ID 为键：维度使用重复键；times 使用 URL 编码的 JSON 对象 `{start,end}`，由 pageParamSearch 编码。未传键时读取文档实际值；显式非法、空或重复的单值输入阻止初始化，不回退另一期间。外部执行回执 appliedInputs 中的时间值也使用 `{start,end}`，精度由声明确定。

旧 params 数组、default、paramBindings、time/window 保留原语义。6.6 新增分组分支，不自动把旧页面迁为新结构；6.5 及更早版本不能声明分组参数。

完整合法页面见 `packages/page/fixtures/contract-valid/grouped-params-page.json`。外部模板召回、实例存储和发布提取流程不属于此次引擎改造。

## 验证记录（2026-09-20）

- `pnpm check`：全仓类型与 Svelte 检查通过；最后的参数副本隔离和执行回执用例另通过 Page/Engine TypeScript 检查。
- `pnpm exec vitest run packages/page/tests packages/engine/runtime/tests`：56 个测试文件、433 项通过。
- `packages/engine/data-gateway/tests/dqe-http.test.ts`：5 项真实本机 HTTP 回归通过（沙箱外监听临时端口）。
- Python 全量创作回归共 448 项：445 项在沙箱内通过，3 项因本机端口权限失败；所属 content_containers、java_page_assets 两组共 9 项在沙箱外重跑全部通过。新分组参数包含 12 个共享 TS/Python 契约向量。
- `node --import tsx tools/scripts/export-authoring-contracts.ts --check` 与 bundle 校验通过；`git diff --check` 通过。
- 另跑参考手册测试时，历史“退役参考全部保留在冻结来源”哈希校验失败。其 actions-and-navigation.md 在 HEAD 中的哈希也已与历史清单不符；本次保留历史清单，不以更新期望值掩盖已有问题。其余 5 项参考手册测试通过。

查询行为通过真实引擎编排到数据网关请求的断言验证；未宣称已接通外部生产模板召回服务。

## 独立提交验证

提交以本地基线 14526fbb 为父提交，推送到 codex/grouped-page-params；远端 main 已前进，未合并远端另一版参数实现。本次仅提交分组参数相关变化，未提交工作区原有百万格式和创作流程改动。

从基线重建独立副本、仅加入本次源码并重新生成契约后：Page/Engine 共 55 个文件、429 项测试通过；Page 源码及 Page/Engine 测试类型检查通过；Python 参数契约 8 项测试通过。上节 433/448 数量来自包含原有未提交工作的完整工作区，不能当成独立提交的测试数量。
