# 指标卡等高：范围交付

用户授权提交并推送到 main，明确要求 skip CI。提交标题使用 `fix(metric-card): equalize mixed card heights [skip ci]`；本轮不将 GitHub CI 视为已通过。

## 基线与范围

- 远端基线：`d8e486a69314237c440c0a8b0ac3bf0c72006d68`。它比原实现工作区前进四个提交，包含 Schema 6.81 和独立 Skill 1.18.0。
- 在隔离 checkout 迁入本次四行 CSS 及混排说明、示例/合法夹具；保留远端已有 Schema、页头和校验器优化，生成独立 Skill 1.18.1 及对应协议、MC、锁文件。
- 保存并交付本次用户提供的 `rep-office-execution-efficiency.json`、`rep-business-result.json` 及目录说明。两页沿用已确认的 Schema 6.80 / 根级 iocHeader，当前 6.81 引擎兼容读取；业务查询、筛选与组件形态不再修改。
- 仅承接 `pages/README.md` 中本任务入口，其他工作区改动保留在原 checkout。

Schema 字段净增减为 0；产品代码只有四行 CSS，没有新增或修改可执行函数，因此不存在函数 CC 变化或未关闭的复杂度项。原始业务 JSON 与迁移中间快照继续保留在本地，不作为本次交付文件。

## 新基线验证

1. 四个组件/页面相关 Vitest 文件：29 项通过。
2. 独立 Skill、旧页升级及页面参考三个 Vitest 文件：158 项通过，包含仓外安装与链接闭合检查。
3. 引擎类型检查：0 errors / 0 warnings；Playground 检查同样 0 errors / 0 warnings。
4. 两个业务页及完整混排示例由本次生成的独立校验器验证通过。
5. 官方生成器写出 1409 product / 4 authoring / 1 interface files；生成一致性检查通过。MC 诊断快照使用官方 fixture 工具刷新。
6. 5199 临时 Playground 的 workspace 依赖指向隔离 checkout 自身，第三方库复用已安装版本。真实浏览器在同一新基线下分别回放未加/已加四行 CSS：1440px 卡面从 124/90/146/146px 变为四张 146px；字体、颜色、间距和内部坐标保持，390px 自然高度不变。忽略生成的 Svelte class token，几何比较误差限为 0.05px，见[机器报告](../../../artifacts/metric-card-height-20261103/delivery-browser.json)及[当前交付截图](../../../artifacts/metric-card-height-20261103/delivery-wide.png)。行权效率页面也实际打开，标题与四张指标卡正常呈现。
7. 无真实 DQE、Relay 或线上部署验证；静态示例、DQE 仿真和缺失占位均不能证明真实取数。

此前完整回归与环境路径修正的记录保留在[实现验收](acceptance.md)，不将原基线结果冒充新基线全量检查，也不为本次四行样式改动重跑未受影响的导出器故障注入全套。

## 交付与清理约定

推送使用普通 fast-forward，核对远端 SHA；提交含 `[skip ci]`，不启动 CI waiter。停止本任务 5199 开发进程并归档交付 worktree。原工作区 main 保持原位置与并行工作，不在脏工作区整体快进、覆盖或自动暂存其他任务文件。其他工作树、分支和开放任务保持。

实际提交 SHA、远端核对和清理结果由最终交付回执记录；这份文档不自引用自身提交 SHA。
