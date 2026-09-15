# S2 最新上下文与只读配置：实施证据

基线：S1作者/评测集成及证据 `1a1cdb3`；共同契约/ADR冻结 `ff93b61`。实际工作树仍为 `/private/tmp/metriccanvas-unified-s1-20260915`，未改 main 或生产服务。

## 实现与边界

- ADR-0079 固定可信创作轮次与门禁；结构作者、7个正反例、3个产品序列化字节向量位于 contracts/authored/authoring-turn*。TS与Python消费同一Schema；语义检查另核对身份、工作区、request/run/turn/page、能力、状态和精确引用。
- binding.documentSha256核对可信prepare传入的documentJson精确UTF8字节；Python严格解析已验证字符串，拒绝重复键/非有限值，摘要与编辑消费该解析基线。旧ContentBaseline/内容artifact内部Python hash保持，避免改历史幂等语义。
- 新统一服务 `metriccanvas-platform-content`：五工具都要求 context_ref。page_id、baseline_token、source_token从模型面退出，身份和完整基线来自带外current-turn端口。缺端口明确CURRENT_TURN_UNAVAILABLE，不回退旧content_server。
- read_page_context只返回有界结构/配置：稳定ID/类型/标题/位置/布局、允许的数据槽、字段绑定与格式、表格列和指标卡配置行。未知扩展不通用递归，明确省略；完整查询/业务行/凭据留程序通道。补读cursor绑定本轮身份、页、精确修订/hash与目标，跨范围或删除/歧义拒绝。
- 工作台在等待前封闭新的手工写入口，flush已开始输入，同步后由显式latestRead端口重读。只读与澄清后新轮同样重读；取消/lookup不创建新轮。prepare返回的完整绑定逐项核对，迟到/跨身份结果不发内容请求；未知写入保留恢复锁。
- registry、pyproject CLI、Skill工具参考一致指向受门禁工厂；静态映射到旧module/CLI的反例失败，生产工厂即使设置旧token目录也不能写。

## 受影响验证

| 层 | 当前结果 |
|---|---|
| 共同结构/字节向量与分发TS | 31项通过（含独立包/来源/生成器所有权） |
| Python完整Authoring | 310项通过，17.804秒；本地回环监听已授权 |
| 新统一公开内容与上下文 | 14项通过；含真实lineChart配置分页、完整编辑保持、new创建、旧token/无provider/只读写入拒绝、迟到产物丢弃 |
| Skill/Bundle/分发契约 | 7/7/3项通过，quick_validate通过 |
| 工作台 | 18文件256项通过；tsc通过；svelte-check 0 errors/0 warnings；T20实际浏览器回归通过 |
| 真实模型 | blocked；0新请求，外发具体授权仍待用户 |
| 真实提供方 | blocked；真实身份/latest/Relay分流与路由未接入 |

工具服务可以通过可信embedding注入替身current-turn端口进行本地纵切验收；独立stdio目前没有真实提供方，因此只展示工具面并失败关闭。这不是生产latest或完整服务接入的完成证据。浏览器fixture的prepare/latest只服务测试，不能作为生产fallback。

## 可复现命令

```sh
node --import tsx tools/scripts/export-authoring-contracts.ts --check
python3 metriccanvas-authoring/scripts/check_bundle.py
PYTHONDONTWRITEBYTECODE=1 work/venv/bin/python -m unittest discover -s metriccanvas-authoring/test-harness/tests -p 'test_*.py'
node node_modules/vitest/vitest.mjs run tests/authoring-turn-contract.test.ts tests/authoring-export-isolation.test.ts tests/page-reference.test.ts
node node_modules/vitest/vitest.mjs run apps/platform/tests/workbench
```

分发体积：8文件、178行、15,131字节（主文50/create9/edit8），不据此推断模型token改善。S1冻结成绩保留为历史；S2工具协议变更后旧runner必须拒绝错配，不能继续旧token冒称完成。

## 独立分发与评测协议

本地sdist构建成功，安装到work/s2-installed；从空目录以隔离Python启动已安装CLI，五工具注册齐备，无current-turn提供方的read返回CURRENT_TURN_UNAVAILABLE，模型请求0。新增Schema确实随sdist进入_bundle，未依赖源码仓路径。

TB2的S2预检和协议门禁以来源提交9ce6646/7e62e52集成为27d1c9d/89e884a。preflight可显式选unified-content列真实五工具；旧S1runner在加载S2 Skill时，于读取配置、启动stdio或HTTP客户端之前返回UNSUPPORTED_SKILL_PROTOCOL，避免旧token工厂冒充新入口。S2真实runner/current-turn服务仍blocked，S1历史保持不改。
