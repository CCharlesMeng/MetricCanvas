# 2026-09-21 工作区批量截断与恢复记录

日期：2026-09-21。性质：事故与恢复记录，不是设计决策。写它的原因是：被清零的文件正好落在一次未完成的重构中间，下一个接手的人很容易把「内容没了」误判成「实现还没写」，从而凭猜测重写。

## 发生了什么

14:51:41 与 14:53:21 两次批量写入把若干文件截断为 0 或 1 字节。没有对应的编辑意图：同一秒内先记录完整内容、再记录空内容，且同批被写到的其他几十个文件内容未变（只是被快照）。同一事件还把 `metriccanvas-authoring/bundle.lock.json` 退回到 11:46 的旧版本，因此它与 11:58 之后的两批源码改动全部对不上。

截断的文件里有五个是当轮 A08 重构刚写入、尚未接完线的新代码，只存在于工作区，**git 里没有任何版本可回退**。

## 恢复清单

来源是编辑器本地历史（`~/Library/Application Support/Cursor/User/History`）中截断前的最后一份快照，逐份读回核对，未凭记忆重写：

| 文件 | 截断前 | 归属 |
|---|---|---|
| `metriccanvas-authoring/tool/metriccanvas_authoring/server.py` | 1279B | A08 首段（未提交） |
| `.../work/state.py` | 4101B | 第二批 Platform v2 |
| `.../domain/canonical.py` | 782B | 第三批 A09 |
| `.../assets/ports.py` | 1043B | A08 首段（未提交） |
| `.../adapters/outbound/service_identity.py` | 571B | A08 首段（未提交） |
| `docs/agents/domain.md` | 1897B | 已跟踪，含未提交修改 |
| `docs/page-building-process.md` | 8725B | 已跟踪，含未提交修改 |
| `docs/archive/docs-consolidation/2026-09-21-docs-consolidation.md` | 17825B | 未跟踪 |
| `参考/区域流水地图/alpha-tests.md` | 4669B | 未跟踪，与创作重构无关 |

`bundle.lock.json` 未手工修补；等生成器可运行后按既有导出链重新生成，已恢复为当前状态。

## 事后核对

- 全仓已跟踪文件与 HEAD 对比，不再有「现在 ≤1 字节、HEAD 里有内容」的文件。
- 按编辑器历史反查全仓未跟踪文件，不再有「现在为空、历史里有更大版本」的文件。
- 创作测试全量运行，除另一处进行中的页面 schema 6.7 改动外全部通过。

## 下次怎么快速判断

1. 先按字节数筛一遍，不要只看 `git status`：被清零的未跟踪文件在 `git status` 里仍然只是 `??`，跟正常新文件没有区别。
2. 交接文档说「已完成」而磁盘上文件为空时，先查编辑器本地历史里同一文件的上一份快照，再决定是恢复还是重写。
3. 派生产物（`bundle.lock.json`、`contract-lock.json`、快照目录）只用既有生成器重新生成，不要手改成「看起来对得上」。
