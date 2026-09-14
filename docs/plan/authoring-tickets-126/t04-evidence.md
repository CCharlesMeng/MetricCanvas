# T04 本仓方案交付证据

2026-09-14；S0；基线 `5d06583878fc18ab145be9315d608c6e90ca6775`。

| #130 验收项 | 证据 | 结论 |
|---|---|---|
| #105/#106 最新资料、现有/拟新增/未知 | proposal 的事实表；已读取两票完整正文和评论、2026-09-10 原资料及最新对账；#130 与 #126 原生 blocked_by 均 [] | 本仓资料对账完成；外部新提案未确认 |
| 精确读取、历史、写后读、幂等、结果查询、冲突、说明、保留值、候选、执行、最后筛选 | proposal 对应章节；21 组输入/响应/预期样例 | 文档与样例已交付，消费者代码不在本次范围 |
| MCP 分工、可信产物、身份/来源/已保存引用 | proposal 所有权与通道、逻辑值类型、消费方对齐清单 | 已明确；S1/S2 未登记，不能声称已对齐 |
| 算法归 Java、计划归 Relay、成功/失败/重复/过期及联调清单 | proposal、contract-examples.json、intranet-126-handoff.md | 本仓方案完成；真实联调待 #105/#106/内网 |

实际验证：

- `python3 docs/plan/authoring-tickets-126/t04-verify-examples.py`：**21 scenarios / 32 steps** 样例自洽检查通过。覆盖重复保存、同键换载荷、回执丢失查结果、旧修订在新修订后读回、错引用/hash、冲突、候选修正、重复/未确认/过期/旧版本/基线变化/租约失效、执行成功/空集/部分失败/缺源/错条件/无权限。
- 现有 `packages/page/src/index.ts` 的 `parsePage`：样例中 **22 处完整页面文档** 均 `ok:true`，协议 6.0。使用原工作区现有依赖只读运行，产品源码与本 worktree 共同源码基线相同，本轮未改产品代码；没有运行真实 DQE。
- 原 `tsx` CLI 因沙箱禁止 IPC pipe 报 EPERM；改用 `node --import tsx` 后成功，无额外权限/外部调用。parsePage 返回值已显式断言 ok，不以“不抛异常”判断通过。
- `git diff --check` 通过；白名单 SHA-256 比较用于验证原始交接内容未被改变。无生产代码/公共 DTO/外部服务改动，因此未运行全仓构建或浏览器回归；不声称 UI 已完成。

页面校验复现（在已装依赖的仓根；MC_T04_EXAMPLES 指向本文件旁 JSON）：

```bash
MC_T04_EXAMPLES=/private/tmp/metriccanvas-126-s0/docs/plan/authoring-tickets-126/t04-contract-examples.json node --import tsx --input-type=module <<'JS'
import { readFileSync } from 'node:fs';
import { parsePage } from './packages/page/src/index.ts';
const data = JSON.parse(readFileSync(process.env.MC_T04_EXAMPLES, 'utf8'));
let count = 0;
for (const c of data.cases) for (const s of c.steps) for (const x of [s.request, s.response]) {
  if (!x.document) continue;
  const result = parsePage(x.document);
  if (!result.ok) throw new Error(JSON.stringify(result));
  count++;
}
console.log(`${count} documents passed`);
JS
```

限制：样例 checker 是文档质量检查，不是服务替身、生产契约校验器或消费者验收；没有 HTTP/SDK 字段确认。未来 params 多值与 layout 写出由 S2 实施后替换/扩展相应样例，当前合法 6.0 样例不是新协议完成证明。

回退：文档提交可独立 revert，不迁移数据；原工作区/其他 worktree 不受影响。S1/S2 以集成 SHA 读取提案后回传兼容结果，S0 才记录消费对齐及 M0 放行。#130 保持 OPEN，避免文档产出被误认为全部消费对齐完成。
