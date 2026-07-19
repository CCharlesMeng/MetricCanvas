# Issue Tracker:GitHub

本仓库的 issue 和 PRD 以 GitHub issue 形式存放于 `CCharlesMeng/MetricCanvas`。所有操作使用 `gh` CLI。

## 约定

- **创建 issue**:`gh issue create --title "..." --body "..."`,多行正文用 heredoc
- **读取 issue**:`gh issue view <number> --comments`,用 `jq` 过滤评论,同时获取标签
- **列出 issue**:`gh issue list --state open --json number,title,body,labels,comments`,按需加 `--label`/`--state` 过滤
- **评论**:`gh issue comment <number> --body "..."`
- **加/去标签**:`gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **关闭**:`gh issue close <number> --comment "..."`

仓库信息由 `gh` 在 clone 内自动从 `git remote -v` 推断。

## PR 作为 triage 入口

**PRs as a request surface: no.**(若本仓库将外部 PR 视为功能请求,改为 `yes`;`/triage` 读取此开关。)

## 当 skill 说"发布到 issue tracker"时

创建一个 GitHub issue。

## 当 skill 说"获取相关 ticket"时

执行 `gh issue view <number> --comments`。

## Wayfinding 操作

供 `/wayfinder` 使用。**map** 是一个带 `wayfinder:map` 标签的 issue,**child** ticket 是它的子 issue。

- **Map**:`gh issue create --label wayfinder:map`,正文含 Notes / Decisions-so-far / Fog。
- **Child ticket**:通过 GitHub sub-issue 关联到 map(`gh api` 子 issue 端点);不可用时在 map 正文维护任务清单,child 顶部写 `Part of #<map>`。标签:`wayfinder:<type>`(`research`/`prototype`/`grilling`/`task`)。认领后指派给对应开发者。
- **Blocking**:用 GitHub 原生 issue dependencies(`gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker 的数据库 id>`,注意是 `.id` 不是 `#number`);不可用时退回到 child 正文顶部的 `Blocked by: #<n>` 行。所有 blocker 关闭即解除阻塞。
- **Frontier**:列出 map 的开放子 issue,剔除有开放 blocker 或已有 assignee 的,按 map 顺序取第一个。
- **Claim**:`gh issue edit <n> --add-assignee @me`,作为会话第一个写操作。
- **Resolve**:`gh issue comment` 写答案 → `gh issue close` → 把要点追加到 map 的 Decisions-so-far。
