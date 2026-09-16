# 统一创作页面的新旧消费者往返验证

本地离线验证，2026-09-16。旧代码组固定为实施前基线 `9d4f4444efc43f47d039d882b141207b915c8e9e`，新代码组为已合入 main 的 `0e740ecf8598648fa4fe8461e589dd95ed25b1f9`。旧组来自 Git archive，未用新代码替代旧消费者。不是对实际生产部署版本的假定。

## 本次新增证据

使用新版公开 MCP `create_content_page` 分别生成 report/dashboard：真实受控组合算法，合成数据及可信轮次端口，包含查询组件、静态说明与显式 span=5。产物协议均为 6.3。

两份产物各经过以下完整链路：

1. 新版完整产物交给独立进程里的旧版 Python 页面归一化与编辑器；进程只使用旧源码及旧 contract snapshot。
2. 旧版归一化逐字段无损，受控修改标题成功，未修改源文档；未来协议 99.0 被拒绝。
3. 与期望文档做完整结构相等比较，证明除标题外，数据源、字段、行、组件属性、顺序与 span 均保持。
4. 旧版编辑结果交回新版归一化，并作为完整、hash 已匹配的可信基线传入新版公开 MCP `edit_page`；再次修改标题成功，其他内容完全保持。

结果：**2 条跨版本往返通过**。运行时/契约指纹、3个阶段的页面 SHA-256 和检查项写入[机器证据](2026-09-16-page-compatibility-evidence.json)。这不是重跑同一版本既有示例，而是首次用固定旧源码读取、编辑新版公开工具产物并交回新消费者。

## 页面消费者代码没有发生漂移

`git ls-tree` 核对以上两组版本，以下源码树完全一致：

| 路径 | 两组相同的 Git tree |
|---|---|
| packages/page | `8b9e4cf79969ea368823ac3834f391ad0954d0ed` |
| packages/engine | `81142544cf54b067fe74d1c12844625a4be62c54` |
| packages/metric-canvas | `0597cfa18945e5e6ef594377c3e3b3e45c42bed1` |
| packages/embed/src | `929c4eb2cec1ef1e0ab9683dd9e6f9ac318d1fb3` |

此证据说明统一作者没有另造一套页面协议或渲染实现，不代表任意旧部署或内部自定义组件都兼容。浏览器版本/Svelte 组合另由远端 CI 仓外 tarball 矩阵验收。

## 可复现命令

```sh
mkdir -p work/page-compat-baseline
/Library/Developer/CommandLineTools/usr/bin/git archive 9d4f4444efc43f47d039d882b141207b915c8e9e metriccanvas-authoring > work/page-compat-baseline.tar
tar -xf work/page-compat-baseline.tar -C work/page-compat-baseline
work/venv/bin/python tools/scripts/verify-authoring-page-compatibility.py --baseline-bundle work/page-compat-baseline/metriccanvas-authoring --output work/page-compat-result.json
```

脚本复用 test-harness 合成依赖；不修改产品工厂，不进行真实模型或提供方请求。机器输出中的运行时指纹覆盖各组 tool、contracts、contract-snapshot 及 bundle.json，不含 Python 缓存。命令应在新代码组运行；`git archive` 目标必须保持固定。

## 仍不能据此关闭的回退门禁

- 本次是**页面文档**读写往返，不是远端修订写入、发布或单写切换。未执行任何真实保存/发布，模型请求仍为 0。
- 旧组没有新版统一候选链和执行恢复协议；不能把新版 SQLite 待决队列直接交给旧组继续写，也不能凭页面可读推导操作状态可回退。
- 真正回退必须绑定实际旧部署整组版本、Adapter、扩展和完整待决记录。未决原操作需要由能识别其记录的恢复实现查明；不能重新生成操作 ID 或改走旧直接 CRUD 重试。
- 内部扩展/H1–H15、真实产物鉴权与完整性、强保存/原操作查询、发布和部署回退仍需各自证据。S8 未关闭。
