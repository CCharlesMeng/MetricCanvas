# 本批代码复杂度实测

口径：`metriccanvas-ts-ast/1`，TypeScript `5.9.3`。基线为本次修改前的工作区文件快照，保留此前未提交的并行代码；不与 HEAD 的旧实现混算。Svelte 仅提取 script 后交给 TypeScript AST，另用 Svelte AST 提取模板原始函数表达式测量；未将整个模板作为 TypeScript 解析。

## 修改函数前后

| 函数 | 前 | 后 | 说明 |
|---|---:|---:|---|
| PageAuthoringWorkbench.savePageTitle | 5 | 4 | 统一使用工作副本 |
| PageAuthoringWorkbench.flushWorkingInput | 4 | 4 | 输入提交允许在准备期排空 |
| PageAuthoringWorkbench.selectComponentFromList | 2 | 2 | 新增定位回调另测 |
| ComponentProperties.submit | 11 | 8 | JSON 处理转入独立规则编辑 |
| property-edit.presentationControls | 2 | 2 | 标签交给职责明确的展示函数 |
| PageAuthoringWorkbench.commitPageTitle | 4 | 已删除 | 工作台不再通过管理接口单独写标题 |
| IocHeader.measure | 2 | 3 | 卸载后异步测量失效保护 |

## 全部新增辅助函数与回调

| 文件 | 函数 / selfCC |
|---|---|
| ConditionProperties.after.ts | <anonymous@10:45>=1；<anonymous@11:40>=1；apply=3 |
| ConditionRuleEditor.after.ts | <anonymous@11:25>=1；<anonymous@12:27>=3；<anonymous@13:31>=3；<anonymous@15:26>=2；commit=2；apply=6；apply/<anonymous@21:33>=1 |
| condition-editor.ts | filterConditionChoices=1；filterConditionChoices/<anonymous@15:26>=4；filterConditionChoices/<anonymous@15:26>/<anonymous@19:22>=3；basicFilterCondition=4；basicConditionSelection=7；basicConditionSelection/<anonymous@32:31>=2；conditionSummary=7；conditionSummary/<anonymous@48:52>=1；conditionSummary/<anonymous@49:52>=1；conditionSubject=5；conditionSubject/<anonymous@61:31>=1；presentationLabel=12；presentationLabel/<anonymous@75:78>=1 |
| condition-editor.test.ts | <anonymous@10:103>=1；<anonymous@10:103>/<anonymous@12:22>=1；<anonymous@21:94>=1；<anonymous@30:106>=5；<anonymous@30:106>/<anonymous@35:50>=2；<anonymous@30:106>/<anonymous@40:51>=1；<anonymous@30:106>/<anonymous@44:65>=1 |
| PageAuthoringWorkbench.applyPropertyEdit | 12 |
| selectComponentFromList 新增 tick 回调 / find 回调 | 2 / 1 |

## 修改文件全部脚本函数（含存量）

| 文件 | 函数数 | 最大 selfCC | 超过 15 |
|---|---:|---:|---:|
| ComponentProperties.after.ts | 3 | 8 | 0 |
| ConditionProperties.after.ts | 3 | 3 | 0 |
| ConditionRuleEditor.after.ts | 7 | 6 | 0 |
| Inspector.after.ts | 12 | 7 | 0 |
| IocHeader.after.ts | 8 | 5 | 0 |
| PageAuthoringWorkbench.after.ts | 79 | 14 | 0 |
| condition-editor.ts | 13 | 12 | 0 |
| property-edit.ts | 32 | 15 | 0 |
| condition-editor.test.ts | 7 | 5 | 0 |
| main.ts | 23 | 7 | 0 |

模板原始回调另测：PageAuthoringWorkbench 30 个、最大 7；Inspector 12 个（末次加入 currentCandidate 的脚本回调为 1）、最大 2；ComponentProperties 8 个、最大 2；ConditionProperties 8 个、最大 2；ConditionRuleEditor 4 个、最大 1；IocHeader 无模板函数表达式。

本批修改函数及全部新增函数均不超过 15，无本批复杂度未关闭项；未声明全仓复杂度债务已经关闭。新增代码仍使用现有 Condition、候选形态约束和工作副本保存职责；未引入通用规则引擎或新的页面协议。
