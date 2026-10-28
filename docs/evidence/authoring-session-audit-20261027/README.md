# 创作执行链调查证据

后续实施：[本地实施与验收](implementation.md)。本文件及 probe.log 保留修复前调查基线，不代表当前缺陷仍未修复。

日期：2026-10-27。产品代码未修改；以下包含预期暴露缺陷的失败探针，不是修复验收报告。

整体策略：[创作契约与执行链整体调整策略](../../plan/2026-10-27-authoring-contract-reliability.md)。

## 基线与方法

- 固定 SHA：`54021ab6776c37c8e7e5f669e6c76cc88a3d7a48`。
- 从 Git 导出到 `/tmp/mc-authoring-audit-Btt485`；原工作区的并行改动没有带入。
- Python：项目已有 `.venv/bin/python`，3.12.13。探针使用固定副本的代码/夹具，不使用现场旧检出的产品源码。
- 所有身份、授权、DQE、Java 保存/读取、HTTP 均来自现有 Fake/Mock 与合成数据。未访问真实服务、未调用模型。
- MC inspect 使用包内真实检查脚本，经本地 Node 执行；不提供可信 correlation 的场景明确返回 correlation=not_run。
- 附件原始生产日志和部署文件未取得；本轮不复述附件里的金额、客户信息或 token。

## 实测结果

| 范围 | 结果 | 意义 |
|---|---|---|
| 原有定向测试 | 56项通过，约4.75秒 | DQE响应兼容、查询策略、关系证据、容错和同轮快照的已有约束仍成立 |
| 新增缺陷探针 | 8个测试方法失败，含strict/relaxed子场景共9条断言失败 | 时间入口缺口、诊断不足、指标卡证据路径不一致可离线复现 |
| 新增对照探针 | 7个方法通过 | 区分已有能力与待改能力，避免按外部报告误改 |
| 探针全部 | 15个方法，约1秒 | 执行退出码应为1，产品尚未修复 |
| 复杂度 | Radon 6.0.1，16个函数/方法CC=1–3 | 新增的是调查探针，产品函数前后无变化；没有新增超限函数 |

原始输出：probe.log（本地附件，不随仓交付：`.scratch/evidence-runtime-attachments-20261028/authoring-session-audit-20261027/probe.log`）、baseline-tests.log（本地附件，不随仓交付：`.scratch/evidence-runtime-attachments-20261028/authoring-session-audit-20261027/baseline-tests.log`）、[复杂度测量](complexity.json)。日志包含既有夹具的 TemporaryDirectory ResourceWarning，不改变断言结果。最初定向执行缺少 model-evals 导入路径及被引用页面/模拟数据，补齐固定提交的这些依赖后重新执行，最终56项通过。

### 缺陷探针的确切断言

1. 月粒度配日值在strict/relaxed下均应在执行前拒绝：实际都执行一次。
2. 不存在的日历日期应在执行前拒绝：实际执行一次。
3. 倒置月份范围strict下应拒绝：实际执行一次。
4. 年粒度配月值应拒绝：实际执行一次。
5. FastMCP公开query_data入口应拒绝月/日精度冲突：实际调用执行器并返回ready。
6. 编辑失败应有局部路径和安全解释：实际仅TYPE_CHANGE_UNSUPPORTED与空path。
7. 查询失败应有安全解释：实际有code/path/candidates/action，无message。
8. 普通指标卡与metric-summary应使用同一可信完整行证据：前者成功，后者从initial重新选行而拒绝。

第8项是故意在装配函数的真实调用接口提供“完整程序证据、部分初始缓存”以检查其契约一致性；不声称已复现两次生产session的完整输入链。

### 对照探针

1. 合法月范围正常执行并保持值。
2. ERROR+空行抛DQE_ITEM_ERROR，SUCCESS+空行可消费。
3. NO_PERMISSION+非空行维持已接受规则；不作为本次缺陷。
4. compose后未preview，artifact.document已可直接结构检查；关联检查仍not_run。
5. 两次编辑直接使用前一次workVersion续编成功，服务端仍核对当前基线。
6. 同轮两次元数据search：示例Adapter仅1次Mock HTTP，内部保留参考版2次；数据相同时版本hash相同。
7. catalog含完整templateFile，规范查询key成功，短key失败，标准模板未设置component默认值。

另外手动测量三次本地内容查询：catalog约131ms、未知短key约115ms、规范key约112ms。仅作本地阶段定位，不与生产工具14秒直接相减推导网络/认证耗时。

## 重放

可用任意干净的完整Git检出，或从上述固定SHA导出仓库内容。不要使用较旧的主工作区源码替代。需要本项目的Python依赖及可执行Node；不需要真实服务配置。

在原仓库根目录执行，`MC_AUDIT_ROOT` 指向固定提交的副本：

```sh
MC_AUDIT_ROOT=/tmp/mc-authoring-audit-Btt485 PYTHONDONTWRITEBYTECODE=1 \
  metriccanvas-authoring/tool/.venv/bin/python \
  docs/evidence/authoring-session-audit-20261027/probe.py \
  DesiredInvariants ExistingGuarantees
```

应运行15个方法，当前基线报告9条断言失败。明确指定两个类，避免unittest将导入的夹具测试类也收集为调查探针。

在固定副本根目录执行现有定向回归（`AUDIT_PYTHON` 指向已安装项目依赖的Python）：

```sh
PYTHONPATH=metriccanvas-authoring/tool:metriccanvas-authoring/test-harness:metriccanvas-authoring/test-harness/tests:metriccanvas-authoring/test-harness/model-evals \
  PYTHONDONTWRITEBYTECODE=1 "$AUDIT_PYTHON" -m unittest \
  test_dqe_http test_query_validation_policy test_result_relations \
  test_authoring_tolerance test_metadata_processes
```

依赖包括本提交的 `tools/dqe-sim/fixtures` 及 `pages/business/report/flow`/`tokens`，只做Python夹具读取，不启动模拟服务。实际跑过的最终命令等价于上述命令，Python路径为原仓库的 `metriccanvas-authoring/tool/.venv/bin/python`。

## 源码定位（均以固定SHA为准）

| 主题 | 路径与位置 |
|---|---|
| 时间输入宽松Schema | `metriccanvas-authoring/contracts/authored/page-build-spec.schema.json:122`；`page-structure-plan.schema.json:109` |
| 私有时间校验 | `metriccanvas-authoring/tool/metriccanvas_authoring/data/business_interpretation.py:37` |
| 规范化与DQE构造 | `data/validation_policy.py:55`；`data/executable_units.py:295` |
| 查询结果/错误投影 | `data/results.py:44`、`:120` |
| 指标发现 | `data/semantic_catalog.py:21`、`:98`、`:130`、`:165` |
| 编辑诊断 | `pages/components/component_editing.py:25`；`pages/editing/page_editing.py:17`；`pages/editing/operation_batch.py:40`；`pages/referenced.py:176` |
| 行证据选择差异 | `pages/composition/page_structure.py:67`；`pages/components/section_presentation.py:6` |
| 读取/编辑状态 | `pages/platform_authoring.py:73`、`:94`；`assets/drafts.py:20` |
| 内部参考元数据Adapter | `metriccanvas-authoring/tool/metriccanvas_authoring/adapters/firstparty/dataset_metadata_http.py:56` |
| 示例元数据Adapter | `metriccanvas-authoring/examples/adapter_template/firstparty/dataset_metadata_http.py:60` |
| MC检查和关联 | `tools/mc-content/scripts/mc_inspection.py:41`、`:71` |
| 内容key解析 | `tools/mc-content/scripts/mc_resources.py:104` |

缩写 `data/`、`pages/`、`assets/` 均相对于 `metriccanvas-authoring/tool/metriccanvas_authoring/`。代码与测试只能证明固定基线行为；实际部署责任仍以策略文档列出的外部证据关闭。
