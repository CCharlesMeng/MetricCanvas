# 提交基线复杂度复测

交付基线：`9263fb54b03667cb4eb3682f967f28deda0e14c7`。口径：`metriccanvas-ts-ast/1`，TypeScript 5.9.3。Svelte script 与模板原始函数表达式分别解析；闭包独立测量，指标为 selfCC。初次实现的复杂度记录保留为历史，本文记录迁入当前 main 后的实际值。

| 文件 / 范围 | 函数数 | 最大 selfCC | 超过 15 |
|---|---:|---:|---:|
| apps/platform/src/lib/PageAuthoringWorkbench.svelte#script.ts | 79 | 14 | 0 |
| apps/platform/src/lib/PageAuthoringWorkbench.svelte#template.ts | 30 | 7 | 0 |
| apps/platform/src/lib/workbench/Inspector.svelte#script.ts | 12 | 7 | 0 |
| apps/platform/src/lib/workbench/Inspector.svelte#template.ts | 12 | 2 | 0 |
| apps/platform/src/lib/workbench/ComponentProperties.svelte#script.ts | 5 | 11 | 0 |
| apps/platform/src/lib/workbench/ComponentProperties.svelte#template.ts | 6 | 2 | 0 |
| apps/platform/src/lib/workbench/ConditionProperties.svelte#script.ts | 3 | 3 | 0 |
| apps/platform/src/lib/workbench/ConditionProperties.svelte#template.ts | 8 | 2 | 0 |
| apps/platform/src/lib/workbench/ConditionRuleEditor.svelte#script.ts | 7 | 6 | 0 |
| apps/platform/src/lib/workbench/ConditionRuleEditor.svelte#template.ts | 4 | 1 | 0 |
| packages/engine/runtime-ui/src/ioc-header/IocHeader.svelte#script.ts | 8 | 5 | 0 |
| packages/engine/runtime-ui/src/ioc-header/IocHeader.svelte#template.ts | 0 | 0 | 0 |
| apps/platform/src/lib/workbench/property-edit.ts | 36 | 14 | 0 |
| apps/platform/src/lib/workbench/condition-editor.ts | 13 | 12 | 0 |
| apps/platform/tests/workbench/condition-editor.test.ts | 11 | 5 | 0 |
| apps/platform/tests/agent-flow/main.ts | 23 | 7 | 0 |

## 修改函数对比

| 函数 | 前 | 后 |
|---|---:|---:|
| PageAuthoringWorkbench.svelte#script.ts.savePageTitle | 5 | 4 |
| PageAuthoringWorkbench.svelte#script.ts.flushWorkingInput | 4 | 4 |
| PageAuthoringWorkbench.svelte#script.ts.selectComponentFromList | 2 | 2 |
| ComponentProperties.svelte#script.ts.submit | 11 | 11 |
| property-edit.ts.presentationControls | 2 | 2 |
| PageAuthoringWorkbench.commitPageTitle | 4 | 删除 |
| IocHeader.measure | 2 | 3 |

当前 main 的表格置顶行使用通用 JSON 控件，因此 ComponentProperties.submit 保留其解析与拒绝非法输入的职责，11→11；条件控件按 presentation target 独立划分，不按 JSON 类型一刀切。新增 tableColumn 名称分派未增加函数分支。所有本批修改函数、新增辅助函数、测试回调和模板回调均不超过 15；无本批超限未关闭项。

## 函数完整清单

| 文件 / 范围 | 函数 / selfCC |
|---|---|
| apps/platform/src/lib/PageAuthoringWorkbench.svelte#script.ts | <anonymous@62:31>=6；<anonymous@62:31>/storageTarget=1；<anonymous@62:31>/identity=3；<anonymous@105:34>=5；<anonymous@109:35>=1；<anonymous@115:11>=1；readSavedPreview=9；<anonymous@130:11>=14；<anonymous@130:11>/<anonymous@131:85>=11；<anonymous@130:11>/<anonymous@132:60>=1；<anonymous@130:11>/hasUnsavedWork=6；<anonymous@130:11>/<anonymous@137:57>=4；<anonymous@130:11>/<anonymous@137:57>/<anonymous@140:15>=5；<anonymous@130:11>/<anonymous@147:8>=2；<anonymous@130:11>/enableSync=2；<anonymous@130:11>/resume=4；<anonymous@130:11>/identity=3；<anonymous@130:11>/currentPageId=2；<anonymous@130:11>/<anonymous@160:34>=1；<anonymous@130:11>/activateTask=2；<anonymous@130:11>/activateTask/<anonymous@163:130>=11；<anonymous@130:11>/scope=5；<anonymous@130:11>/<anonymous@172:35>=1；<anonymous@130:11>/online=1；<anonymous@130:11>/offline=1；<anonymous@130:11>/identity=3；<anonymous@130:11>/readVerifiedSource=1；<anonymous@130:11>/sourceKey=1；<anonymous@130:11>/preview=2；<anonymous@130:11>/save=1；<anonymous@130:11>/<anonymous@185:28>=2；<anonymous@130:11>/<anonymous@186:47>=1；<anonymous@130:11>/beforeStart=1；<anonymous@130:11>/readPage=1；<anonymous@130:11>/<anonymous@194:28>=4；<anonymous@130:11>/submit=2；<anonymous@130:11>/selection=3；<anonymous@130:11>/flushPendingInput=4；<anonymous@130:11>/identity=3；<anonymous@130:11>/<anonymous@207:26>=1；<anonymous@130:11>/<anonymous@211:46>=1；<anonymous@130:11>/captureIdentity=1；<anonymous@130:11>/onpage=2；<anonymous@130:11>/onerror=1；<anonymous@130:11>/captureIdentity=1；<anonymous@130:11>/onpreview=7；<anonymous@130:11>/onapply=7；<anonymous@130:11>/onerror=1；<anonymous@130:11>/<anonymous@253:12>=1；<anonymous@256:11>=3；<anonymous@257:11>=3；<anonymous@258:11>=3；<anonymous@259:34>=6；<anonymous@260:11>=3；<anonymous@260:11>/<anonymous@260:155>=4；<anonymous@260:11>/<anonymous@260:324>=1；<anonymous@270:11>=1；<anonymous@278:36>=10；<anonymous@278:36>/<anonymous@289:9>=1；<anonymous@299:43>=5；<anonymous@299:43>/<anonymous@304:35>=1；<anonymous@307:41>=9；<anonymous@307:41>/<anonymous@316:7>=4；canNavigateDuringCloud=6；flushWorkingInput=4；savePageTitle=4；saveRevision=8；relocateSelection=3；applyDocumentEdit=3；handleAuthoringIntent=9；selectComponentType=5；selectComponentFromList=2；selectComponentFromList/<anonymous@398:22>=3；selectComponentFromList/<anonymous@398:22>/<anonymous@401:49>=1；applyPropertyEdit=12；moveComponentFromList=5；managePageRecord=4；closeMetadataDrawer=1；closeMetadataDrawer/<anonymous@435:22>=1 |
| apps/platform/src/lib/PageAuthoringWorkbench.svelte#template.ts | <anonymous@1:2>=1；<anonymous@2:2>=3；<anonymous@3:2>=1；<anonymous@4:2>=1；<anonymous@5:2>=1；<anonymous@6:2>=2；<anonymous@7:2>=1；<anonymous@8:2>=1；<anonymous@9:2>=1；<anonymous@10:2>=1；<anonymous@11:2>=1；<anonymous@12:2>=1；<anonymous@13:2>=1；<anonymous@14:2>=3；<anonymous@15:2>=1；<anonymous@16:2>=1；<anonymous@17:2>=1；<anonymous@18:2>=1；<anonymous@19:2>=2；<anonymous@20:2>=1；<anonymous@21:2>=1；<anonymous@22:2>=1；<anonymous@23:2>=1；<anonymous@24:2>=1；<anonymous@25:2>=1；<anonymous@26:2>=1；<anonymous@27:2>=1；<anonymous@28:2>=1；<anonymous@29:2>=7；<anonymous@30:2>=5 |
| apps/platform/src/lib/workbench/Inspector.svelte#script.ts | <anonymous@60:11>=3；<anonymous@67:56>=1；<anonymous@68:58>=1；<anonymous@69:51>=1；<anonymous@75:11>=2；clearListDrag=1；startListDrag=5；listDropIntent=7；overListItem=6；scrollListEdge=4；dropListItem=4；selectListItem=3 |
| apps/platform/src/lib/workbench/Inspector.svelte#template.ts | <anonymous@1:2>=1；<anonymous@2:2>=1；<anonymous@3:2>=2；<anonymous@4:2>=2；<anonymous@5:2>=2；<anonymous@5:2>/<anonymous@5:51>=1；<anonymous@6:2>=1；<anonymous@7:2>=1；<anonymous@8:2>=1；<anonymous@9:2>=1；<anonymous@10:2>=1；<anonymous@11:2>=1 |
| apps/platform/src/lib/workbench/ComponentProperties.svelte#script.ts | valueText=3；<anonymous@8:41>=1；<anonymous@9:45>=1；submit=11；submit/<anonymous@17:67>=1 |
| apps/platform/src/lib/workbench/ComponentProperties.svelte#template.ts | <anonymous@1:2>=2；<anonymous@2:2>=1；<anonymous@3:2>=1；<anonymous@4:2>=1；<anonymous@5:2>=1；<anonymous@6:2>=2 |
| apps/platform/src/lib/workbench/ConditionProperties.svelte#script.ts | <anonymous@10:45>=1；<anonymous@11:40>=1；apply=3 |
| apps/platform/src/lib/workbench/ConditionProperties.svelte#template.ts | <anonymous@1:2>=1；<anonymous@2:2>=1；<anonymous@3:2>=2；<anonymous@3:2>/<anonymous@3:28>=1；<anonymous@4:2>=1；<anonymous@5:2>=1；<anonymous@6:2>=1；<anonymous@7:2>=1 |
| apps/platform/src/lib/workbench/ConditionRuleEditor.svelte#script.ts | <anonymous@11:25>=1；<anonymous@12:27>=3；<anonymous@13:31>=3；<anonymous@15:26>=2；commit=2；apply=6；apply/<anonymous@21:33>=1 |
| apps/platform/src/lib/workbench/ConditionRuleEditor.svelte#template.ts | <anonymous@1:2>=1；<anonymous@2:2>=1；<anonymous@3:2>=1；<anonymous@4:2>=1 |
| packages/engine/runtime-ui/src/ioc-header/IocHeader.svelte#script.ts | <anonymous@15:11>=3；<anonymous@15:11>/measure=3；<anonymous@15:11>/measure/<anonymous@24:33>=1；<anonymous@15:11>/measure/<anonymous@25:28>=1；<anonymous@15:11>/measure/<anonymous@27:46>=1；<anonymous@15:11>/measure/<anonymous@27:80>=1；<anonymous@15:11>/<anonymous@32:21>=1；toggle=5 |
| packages/engine/runtime-ui/src/ioc-header/IocHeader.svelte#template.ts |  |
| apps/platform/src/lib/workbench/property-edit.ts | object=4；exportButtons=4；exportButtons/<anonymous@28:74>=1；componentOf=4；componentOf/<anonymous@36:96>=1；componentOf/<anonymous@37:90>=1；propertyControls=13；propertyControls/<anonymous@43:63>=5；propertyControls/<anonymous@47:110>=1；propertyControls/<anonymous@48:141>=3；propertyControls/visit=2；propertyControls/visit/<anonymous@55:23>=7；propertyControls/visit/<anonymous@55:23>/<anonymous@59:160>=1；propertyControls/isReportHeader=4；propertyControls/addExportControls=7；propertyControls/addExportControls/<anonymous@70:35>=1；propertyControls/addMetricBeforeControls=10；propertyControls/addMetricBeforeControls/<anonymous@84:49>=1；propertyControls/<anonymous@92:62>=2；invalidProperty=1；editProperty=2；isChartValueEdit=3；editChartProperty=4；editExistingProperty=14；editExistingProperty/<anonymous@122:121>=1；propertyTarget=11；metricRowTarget=8；columnTarget=13；editReportExport=6；changeExportButton=14；changeExportButton/<anonymous@189:31>=1；presentationControls=2；presentationControls/<anonymous@208:59>=2；presentationControls/<anonymous@208:59>/<anonymous@211:88>=3；editMetricBefore=14；editSpecialProperty=4 |
| apps/platform/src/lib/workbench/condition-editor.ts | filterConditionChoices=1；filterConditionChoices/<anonymous@15:26>=4；filterConditionChoices/<anonymous@15:26>/<anonymous@19:22>=3；basicFilterCondition=4；basicConditionSelection=7；basicConditionSelection/<anonymous@32:31>=2；conditionSummary=7；conditionSummary/<anonymous@48:52>=1；conditionSummary/<anonymous@49:52>=1；conditionSubject=5；conditionSubject/<anonymous@61:31>=1；presentationLabel=12；presentationLabel/<anonymous@75:78>=1 |
| apps/platform/tests/workbench/condition-editor.test.ts | <anonymous@11:93>=4；<anonymous@11:93>/<anonymous@16:24>=1；<anonymous@11:93>/<anonymous@18:31>=2；<anonymous@11:93>/<anonymous@22:69>=1；<anonymous@26:103>=1；<anonymous@26:103>/<anonymous@28:22>=1；<anonymous@37:94>=1；<anonymous@46:106>=5；<anonymous@46:106>/<anonymous@51:50>=2；<anonymous@46:106>/<anonymous@56:51>=1；<anonymous@46:106>/<anonymous@60:65>=1 |
| apps/platform/tests/agent-flow/main.ts | messagesFor=2；finishSession=1；finishTurn=1；<anonymous@25:68>=1；<anonymous@27:41>=1；log=1；stored=2；info=2；updateInfo=5；read=1；update=1；mount=2；mount/<anonymous@40:157>=1；openSession=4；openSession/<anonymous@43:90>=1；send=7；send/<anonymous@48:144>=1；send/<anonymous@49:87>=1；send/<anonymous@57:23>=1；receipt=1；window.fetch=4；readConfig=1；<anonymous@78:66>=1 |
