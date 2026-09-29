# 9235/9236 反馈：MC 公共改进采用说明

本批仅更新 MC 公共 Tool、模板、Skill、测试和诊断。内部 `tool/metriccanvas_authoring/adapters/` 继续由部署方维护；公共同步不会自动采用模板变化。

## 行为变化

- 元数据模板在 55 秒获取期限内，初次读取与缺失 dataset 补取共享最多三次 HTTP 调用；每个读取最多一次瞬断重试。401/403、其他永久拒绝、协议和业务错误不重试。408/429/500/502/503/504 与传输瞬断有界重试，取消不会被吞掉。公共 snapshot 的等待/租约/加载上限仍有效。
- 公共快照记录 hit/wait/acquire/publish/uncached/failed 等事件及耗时；模板记录 HTTP 成败耗时；平台操作记录阶段耗时。仅固定标签和耗时，不记录身份、缓存键、原始错误或载荷，不配置文件路径、不写 MCP stdout。日志处理器异常不改变业务结果。
- 部署指纹增加快照、查询结果、字段派生、装配和校验器实际 import 路径。运行时沿用真实服务解释器/PYTHONPATH。
- coverage 新增 resultComplete（程序结果完整）和 sampleTruncated（模型样本缩短），原 complete/truncated 保留模型证据覆盖语义。41/41 返回但仅展示20行时 resultComplete=true，complete=false；客户端可忽略新增字段，输入和页面协议不变。
- 结果装配在身份/版本/授权校验后消费程序中的完整返回行。模型证据及 initial 仍有界；totalCount 未知保持未知。41/41 的完整结果可验证饼图和唯一 match；实际缺行/总数未知不获得完整性证明。证明相关组件不会发布截断 initial 供渲染先画错误比例，保存定义继续使用现有查询协议。
- compose 读取失败结果以做局部处理时，也必须匹配当前查询政策；读取历史证据可以保留原政策，消费不可跨政策。
- 唯一规范名优先，别名不能覆盖规范名。别名有多个候选时，公共查询返回 DATA_CONTEXT_NAME_AMBIGUOUS 和有界候选，不执行该请求；同批其他合法请求仍可继续。strict/relaxed 都不静默选第一个。冲突的规范名仍失败。
- compose/edit 使用同一口径格式。新自动说明的所有权保存在本轮私有工作状态，随组件移动/删除及来源变化维护；不进入页面协议。人工改过的文字立即退出自动维护。新轮或历史页面缺少所有权记录时保留原文，相关数据变更返回 SCOPE_NOTE_REVIEW_REQUIRED；不猜测删除。
- Skill 澄清单行总量卡不需要维度，按行选取才需要 match；完整占比与模型 20 行样本不同；查询使用规范名和精确字段；缺单位/币种时不猜测。

## 内部需要配合的内容

1. 定向合并 `examples/adapter_template/firstparty/dataset_metadata_http.py`，保留实际认证/端点。沿用公共 read_turn_metadata 和 source_identity（端点、身份、工作区、凭据指纹、有效 dataset 范围、投影配置），不要另外创建 provider 缓存或通过删 binding 字段提高命中率。
2. 可信轮次及共享持久 CAS 必须跨 oneshot 稳定；取消/撤权由可信上下文和精确请求授权检查传达，不能依赖重复元数据 HTTP 偶然发现。
3. DQE Adapter 保留真实 totalCount/分页事实。len(rows) 不是总数证明；null 不能伪装成全量。单位/币种和 name/caption/返回列差异需真实契约对账。
4. 日志采集与存放由部署方决定。多进程日志宜由单一收集器轮转；不复制 parents[9] 路径推导或多进程共享 RotatingFileHandler 补丁。真实 14 秒耗时需要另外记录 Relay 启动、装配、基线核对、DQE、保存和交付段。
5. 复核公共补丁：不采用 alias setdefault、count>=len(rows)、一律给 output_dims 加时间粒度、按时间筛选猜趋势、按“流水”猜 CNY。当前公共校验器已支持时间维度基名与返回粒度列名不同。

## 升级与回退

排空活跃轮次后，在部署副本使用固定公共提交执行同步预览；公共本地补丁/新文件冲突必须先对账，不手改 lock 绕过。已有内部目录逐文件保留，不整目录覆盖模板。重新安装 Tool，并一起更新公共 Skill 和生成契约，检查实际导入指纹后切换。

本批不迁移页面 Schema 或 StateStore Interface。`scopeAnnotations` 是工作记录的私有可选字段；旧记录缺失时按历史文本处理。别名消歧行为和完整性证明变化按新轮采用，不让旧新进程同时处理活跃轮次或复用旧语义结果。回退配套公共/内部安装产物，保留状态库和未知保存操作；源码回退不回滚业务数据。

同步逐文件替换不是在线原子发布。半更新部署必须被 lock/指纹检查识别，从保留的干净部署副本恢复，不能继续带混合文件提供服务。

## 验证入口与未纳入事项

`test-harness/fixtures/execution-improvements.cases.json` 记录专项验收面。独立进程测试使用真实 SQLite 与本地 HTTP，含同键等待、重启、杀进程后租约接管、身份/轮次/配置隔离、迟到 owner 和取消。它们不证明内部生产服务已接通。

主流程 runner 支持 `--cases create-report --evidence-probe complete|truncated|unknown`：在同一 stdio/HTTP/授权链中验证 41 行完整性及共享别名；加 `--scripted` 为确定性验证。输出冻结实际 fixture、用例与摘要。完整性事实来自可信 fixture，模型消息没有预期页面或判分脚本。

浏览器重开脚本可接第三个位置参数指定该运行的 `evidence-fixture.json`；默认仍使用原主流程夹具。查看实际报告，不能把低层通过计为真实模型或浏览器通过。

显式排序输入扩展、未知币种补足、revision 0 的保存契约放宽未纳入本批实现。前者需要 Authoring 输入/授权摘要设计，后两者需要 Java/治理事实及对应契约决定。本批不会在 Adapter 暗中改变这些业务含义。
