# 商务 SDT 级联查询本地验收结论

2026-10-12：本批协议、引擎、目标页面、本地DQE仿真及本地验证已完成。预览地址为 http://localhost:5173/pages/business-sdt-report 。当前连接127.0.0.1:18228的本地DQE Sim；阶段夹具中补出的部分时长为合成测试数值，不能用于业务结论。真实DQE、Relay/Java执行接线和生产验收未执行。

## 实现行为

[目标页面](../../../pages/business-sdt-report.json)使用Schema6.14，最快与最慢分别声明主源和阶段源。主源保留asc/desc、limit5、左四字段及原排序；阶段源通过query.resultBindings读取本轮原始commerce-id集合，maxValues5，形成一个普通商务编号维度条件。没有逐行请求，没有写入隐藏筛选器，也没有将cascade/pivot发送给DQE。

阶段源一次查询时长与次数，以pivot.columns[].valueField生成三阶段六列；主源按商务编号joinAggregate左关联。原表格数据槽不变，两表各5行10列。没有对应阶段时只将相应输出置null，0仍为0；重复商务编号与阶段组合拒绝，辅助源继续要求complete并核验totalCount。主Top5可有更大totalCount，不能因此将导出扩展为全部项目。

查询结果解析为等待、空集、错误或确定性维度集合，预览与导出共用；原始查询依赖与计算依赖分阶段校验。上游条件变化同步失效下游并推进代次，迟到成功和失败均不覆盖当前结果，共享请求仍服务未受影响的消费者。缺键、非法类型、超限、空集和失败不触发无条件明细请求。级联关联链跳过没有输入证明的initial和执行回执，独立源保留原复用行为。

浏览器检查发现原fit:container在390宽度下把十列压为逐字换行；仅这两张表改为现有fit:content，内部overflow-x:auto，保留十列和原列组。桌面长名称也可能需要横向滚动。没有新增表格属性或修改组件样式。

## 实际执行与结果

| 层次 | 状态 | 执行证据与范围 |
| --- | --- | --- |
| TS静态/运行时/网关/仿真 | passed | 92个文件、764项测试；page/tests、engine/runtime/tests、engine/data-gateway/tests、tools/dqe-sim/tests |
| Python创作校验 | passed | 完整harness 523项，使用tool/.venv/bin/python；脚本无真实模型调用 |
| 两端级联协议一致性 | passed | 15个同源向量验证接受/拒绝、根因声明路径及输入不变性；导出到[共享契约](../../../contracts/metriccanvas/page/conformance/query-result-bindings.json) |
| 页面校验 | passed | pnpm validate，当前15份根页面全部通过 |
| 类型/组件 | passed | page、engine、playground、DQE Sim check；Svelte检查0错误0警告；工具构建类型检查通过 |
| 包构建 | passed | build:packages、embed build、packages:check通过 |
| 契约/分发 | passed | authoring:contracts及check，548 product/4 authoring/1 interface；check_bundle.py 1772 digest checks通过 |
| 决策及差分 | passed | ADR索引check、git diff --check通过 |
| 本地HTTP | passed | 202609与202610两套编号集合，普通DQE两阶段取数及项目分区导出；[9月记录](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/2026-10-12-business-sdt-cascade/local-http.json)、[10月记录](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/2026-10-12-business-sdt-cascade/local-http-october.json) |
| 浏览器正常数据 | passed | 两表10行100个单元格逐项对照夹具与number-1格式，见[DOM](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/2026-10-12-business-sdt-cascade/browser-desktop.json)、[核对结果](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/2026-10-12-business-sdt-cascade/browser-row-verification.json)、[截图](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/2026-10-12-business-sdt-cascade/project-efficiency-cascade.jpg) |
| 浏览器异常呈现 | passed | 空集显示暂无数据；主失败和阶段失败显示查询错误，不显示旧行；截图和HTTP分别见下方 |
| 窄屏 | passed | 390×844模拟视口、每表5行10列、内部auto横向滚动及宽度证据，[DOM](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/2026-10-12-business-sdt-cascade/browser-narrow.json)、[截图](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/2026-10-12-business-sdt-cascade/project-efficiency-narrow.jpg)；不是实机触摸验证 |
| 导出数据准备 | passed | 导出使用新主集合，保留Top5；complete辅助、普通分页、取消和行数限制均有运行时回归；没有进行此报告的完整PDF编码验收 |
| 真实DQE/Relay/Java/DS模型 | not-run | 本批没有相应真实上下文与响应；本地数据不证明生产时长、完整性或权限 |
| CI/部署/Git交付 | not-run | 未提交、推送或部署；保留其他会话改动 |

主要命令：

```sh
pnpm exec vitest run packages/page/tests packages/engine/runtime/tests packages/engine/data-gateway/tests tools/dqe-sim/tests
PYTHONDONTWRITEBYTECODE=1 metriccanvas-authoring/tool/.venv/bin/python metriccanvas-authoring/test-harness/run_tests.py
pnpm validate
pnpm --filter @metriccanvas/page check
pnpm --filter @metriccanvas/engine check
pnpm --filter playground check
pnpm --filter @metriccanvas/dqe-sim check
pnpm build:packages
pnpm --filter @metriccanvas/embed build
pnpm packages:check
pnpm authoring:contracts
pnpm authoring:contracts:check
python3 metriccanvas-authoring/scripts/check_bundle.py
pnpm adr:index:check
git diff --check
```

最初系统python3缺少jsonschema/httpx，不能执行完整harness；改用仓库已有虚拟环境后全量通过，没有通过删测试或改业务实现绕开。历史check-authoring-validation-parity.py对比复杂度重构前Python快照，不能用来要求新语义与旧实现完全相同，本批的跨语言判据是15个共享级联向量。此前旧版本测试预期与运行时方言检查的失败已修复并复跑通过。

## 浏览器请求与失败证据

[请求摘要](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/2026-10-12-business-sdt-cascade/browser-request-summary.json)已从本地服务日志逐项核验，仅统计POST，CORS预检另列。正常打开：一次批量主请求包含两项逻辑查询；主响应成功后一次批量阶段请求包含两项逻辑查询，各含其自身全部且仅5个商务编号。截图不足以单独证明这个时序，时序使用HTTP记录。

空集和主查询失败均只有一次主POST，没有阶段POST；阶段失败有主、阶段两次POST，页面错误分类为DQE_QUERY_REJECTED。

- 空集：[页面文字](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/2026-10-12-business-sdt-cascade/browser-empty.txt)、[截图](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/2026-10-12-business-sdt-cascade/project-efficiency-empty.jpg)、[HTTP](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/2026-10-12-business-sdt-cascade/browser-empty-http.log)。
- 主失败：[页面文字](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/2026-10-12-business-sdt-cascade/browser-main-error.txt)、[截图](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/2026-10-12-business-sdt-cascade/project-efficiency-main-error.jpg)、[HTTP](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/2026-10-12-business-sdt-cascade/browser-main-error-http.log)。
- 阶段失败：[页面文字](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/2026-10-12-business-sdt-cascade/browser-detail-error.txt)、[截图](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/2026-10-12-business-sdt-cascade/project-efficiency-detail-error.jpg)、[HTTP](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/2026-10-12-business-sdt-cascade/browser-detail-error-http.log)。
- 最终正常：[HTTP](https://github.com/CCharlesMeng/MetricCanvas/blob/ea40f6641e41e974dd3f1801c4613c5a1a7fcd45/docs/evidence/2026-10-12-business-sdt-cascade/browser-final-http.log)。已恢复正常仿真，浏览器正常预览保持打开，临时窄屏视口已恢复。

DQE Sim接受DQE_SDT_SCENARIO=empty/main-error/detail-error注入本地验证状态；正常启动不设置此变量。延迟、代次竞争、共享消费者、同编号换月份和导出中止在确定性运行时测试中验证，未将其称为真实网络取消验收。当前页面月份固定202609；第二月份通过HTTP测试修改本轮四源声明验证，没有新增页面日期控件。

## 后续真实集成与回滚

真实验真应确认第二项普通DSL支持商务编号集合、阶段类别及粒度、同编号同阶段唯一性、天/次单位、缺失含义、实际total_count和隐式上限，以及两请求使用同一月份。前端网关不要求Relay新增级联调度；若创作期执行或后端执行回执要完整执行这组依赖，需要对应提供方实现相同输入语义，不能由本批浏览器通过代替。AI装配自动生成级联未纳入本批。

[ADR-0099](../../adr/0099-raw-query-result-bindings-and-bounded-left-joins.md)及正式查询/计算协议承载现行结论；讨论和计划已[归档](../../archive/2026-10-12-business-sdt-cascade/README.md)。实施前字节与差分基线保存在/tmp/metriccanvas-sdt-cascade-before-20261012/；回滚使用本批明确路径恢复页面及协议/引擎，不能全仓reset或覆盖其他会话工作。初始截图与hash保留在[基线](README.md)。
