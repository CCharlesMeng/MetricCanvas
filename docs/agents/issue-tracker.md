# Issue Tracker:本地 Markdown

本仓库的 issue 和规格文档(spec,亦即 PRD)以 Markdown 文件形式存放在 `.scratch/` 目录。

## 约定

- 每个 feature 一个目录:`.scratch/<feature-slug>/`
- spec(PRD)为 `.scratch/<feature-slug>/spec.md`
- 实施 issue 每张一个文件:`.scratch/<feature-slug>/issues/<NN>-<slug>.md`,从 `01` 开始编号——禁止把多张 issue 合并进一个文件
- Triage 状态记录在 issue 文件顶部附近的 `Status:` 行(标签字符串见 `triage-labels.md`)
- 评论和对话历史追加到文件底部的 `## Comments` 标题下

## 当 skill 说"发布到 issue tracker"时

在 `.scratch/<feature-slug>/` 下创建新文件(目录不存在则先创建)。

## 当 skill 说"获取相关 ticket"时

读取所引用路径的文件。用户通常会直接给出路径或 issue 编号。

## Wayfinding 操作

供 `/wayfinder` 使用。**map** 是一个文件,每张 ticket 对应一个 **child** 文件。

- **Map**:`.scratch/<effort>/map.md` —— 包含 Notes / Decisions-so-far / Fog 三部分正文。
- **Child ticket**:`.scratch/<effort>/issues/NN-<slug>.md`,从 `01` 编号,正文写问题。`Type:` 行记录类型(`research`/`prototype`/`grilling`/`task`);`Status:` 行记录 `claimed`/`resolved`。
- **Blocking**:文件顶部附近的 `Blocked by: NN, NN` 行。所列文件全部 `resolved` 后该 ticket 解除阻塞。
- **Frontier**:扫描 `.scratch/<effort>/issues/` 中开放、未阻塞、未认领的文件;编号最小者优先。
- **Claim**:动工前先写入 `Status: claimed` 并保存。
- **Resolve**:在 `## Answer` 标题下追加答案,置 `Status: resolved`,再把要点与链接追加到 `map.md` 的 Decisions-so-far。
