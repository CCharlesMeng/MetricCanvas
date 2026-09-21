# 新版可信评测 runner：本地适配与集成证据

日期：2026-09-15。集成冻结 **e526358**。主体5669b1c（来源2f7117a）、多轮修复b8fb2d2（来源ca4b1b7）、生成锁e526358。基于产品实现09982cb及证据提交0a84541。没有真实模型请求、push或生产切换。

## 补齐的本仓工作

`model-evals/run_trusted_local.py`使用同一个循环运行scripted或显式HTTP transport。真实本地stdio子进程导入生产五工具工厂；可信测试程序注入scope/current-turn和精确文档字节。模型仅获得context_ref、实际Skill/参考/工具Schema及安全结果。完整基线、候选、rootBinding、源描述证据留在0600程序文件，不进入模型消息。

读取、发现、候选链、无变化候选复用、静态/数据/混合创建、已有页新增、依赖失败和提供方缺失均经过该循环。每轮保留前轮安全对话并追加新可信context；程序用上一轮合法候选重建本地基线。脚本候选替换只读取当轮工具结果，旧候选不会自动跨轮复用。这是本地fixture更新，不是远端latest证明。

两种transport只替代模型消息的来源。HTTP分支复用冻结参数和配置校验，记录与实际发送完全相同的JSON payload（不记录认证头）；共享整个批次预算，6次模型步骤/轮、12次工具调用/轮，无网络重试，HTTP失败/缺usage/预算不足停止。**本次HTTP全部mock，真实HTTP分支没有执行，也没有读取模型配置或密钥。**scripted父进程及fixture子进程硬拦截IP socket连接。

## 比较与评分

- 旧run_local保留S1入口和旧协议门禁；新版使用独立明确的统一protocol入口，不再因新版五工具本身而拒绝。
- 新HTTP入口支持原9例冻结suite，记录case/重复次数、arm/profile、协议、注入和源码hash。原冻结cases、历史14例及其文件hash未修改。当前五工具diagnostic/production集合相同，不能宣称真实路由或工具集差异。
- 配置只读场景的旧noTools断言不能直接等同新协议；保留原期望并标inconclusive，另检查只读内容边界。creation/freshBaseline检查改读程序侧轮次及候选证据，未把page_id/baseline_token重新塞回模型上下文。
- 所有scripted轨迹明确`evidenceKind=non-model-evidence`、`modelRequests=0`、`usage=null`。模拟调用单列，任何正面review都不能把它提升为真实模型pass。功能检查pass与模型成绩blocked并存。
- 普通问数真实入口没有Relay时在模型调用前精确blocked；缺轮次、候选、数据上下文、源描述或scope不一致分别记录真实错误，不回退旧服务。

## 集成验证（e526358）

| 检查 | 结果 |
|---|---|
| `unittest ... -p 'test_*model_eval_harness.py'` | 30项pass，4.562秒；真实stdio与HTTP mock、摘要隔离、评分、跨轮历史及预算回归 |
| `run_trusted_local.py --transport scripted --suite local-smoke --scenario all --repetitions 1` | 12/12确定性检查pass，35模拟调用、22本地stdio工具调用、10候选、0真实模型请求 |
| 原始证据完整性 | 195 JSON hash匹配，文件权限0600；所有request模型均为scripted-no-model |
| TS导出隔离 | 15项pass |
| Python分发 | 3项pass |
| 导出当前性、bundle、diff检查 | pass；bundle0.2.0、1468摘要 |

日志与原始受限记录：`work/runner-e526358-tests.log`、`work/runner-e526358-smoke/`、`work/runner-e526358-export.log`、`work/runner-e526358-distribution.log`。不提交完整页面/候选原始记录。

原评测任务另跑12×3=36次检查全部pass（105模拟调用、66stdio调用、30候选），多轮修复后补fresh-local-turn×3与30定向测试。摘要在`model-evals/evidence/trusted-local.*.json`、`trusted-history.report.json`；这是其隔离分支的带来源证据，不冒充e526358的运行。集成点重新运行上述12场景，未重复不受影响的409项产品全套；产品侧409 Python/312 TS/浏览器/隔离安装证据仍见S6–S7记录。

## 仍未完成

本地runner适配已完成，已从剩余工作中移除。真实DeepSeek载荷/目的地址授权仍待确认；此前自动审批明确拒绝一般授权下的具体外发，本次未绕过。真实模型准确率/token改善尚无新数据。

远端latest、Relay路由/产物通道、生产身份、真实源规则与刷新、保存/发布提供方、H1–H15和成组生产切换/回退仍须各自实证。runner中的本地合成端口不代表这些能力已接通；S8整体保持未完成。
