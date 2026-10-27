# 层级筛选联动复杂度实测

基线：`219b5db9233d735c2234f83d4ce7c8062ac57605`。工具 `metriccanvas-ts-ast/1`，TypeScript5.9.3。selfCC按仓库固定AST语法决策口径；optionalChains另列，subtreeCC不替代自身分值。Svelte仅抽取完整script块测量，模板分支人工复核并由真实浏览器覆盖，未冒称模板CC。生成的第三方及打包脚本不当作新增作者函数。

本批扫描35个源文件及测试文件，共1747个函数/回调。按同一限定名（匿名回调按父限定名及同序位置）匹配，新增256项，selfCC为1–15，新增超限0。全部新增文件和新增辅助函数均包含于实测。

## 相关既有函数前后

| 函数 | 前 | 后 | 处理 |
|---|---:|---:|---|
| `packages/page/src/table/validate-expansion.ts` `rowExpansionErrors` | 21 | 4 | 职责拆分或新增显式分支 |
| `packages/page/src/table/validate-expansion.ts` `rowExpansionErrors/<anonymous>` | 65 | 65 | 存量超限未增长；保留既有错误顺序/执行编排，避免扩大本批风险 |
| `packages/engine/runtime/src/table/expansion.ts` `createRowExpansionController/open` | 7 | 6 | 职责拆分或新增显式分支 |
| `packages/engine/runtime/src/table/expansion.ts` `createRowExpansionController/retain` | 9 | 12 | 职责拆分或新增显式分支 |
| `packages/engine/runtime-ui/src/table/controller.ts` `createTableController/reset` | 6 | 8 | 职责拆分或新增显式分支 |
| `packages/engine/runtime-ui/src/table/controller.ts` `createTableController/present` | 1 | 4 | 职责拆分或新增显式分支 |
| `packages/engine/runtime-ui/src/table/export/prepare.ts` `prepareTableExport` | 2 | 4 | 职责拆分或新增显式分支 |
| `packages/engine/runtime-ui/src/table/export/task.ts` `exportVisibleTable` | 3 | 3 | 职责拆分或新增显式分支 |
| `packages/engine/runtime-ui/src/table/export/workbook.ts` `encodeTableWorkbook` | 6 | 1 | 职责拆分或新增显式分支 |
| `packages/engine/runtime/src/orchestrator.ts` `orchestrate/start` | 26 | 26 | 存量超限未增长；保留既有错误顺序/执行编排，避免扩大本批风险 |
| `packages/engine/runtime-ui/src/RuntimeSurface.svelte` `run` | 48 | 48 | 存量超限未增长；保留既有错误顺序/执行编排，避免扩大本批风险 |

存量未关闭项：本次接线涉及的 `rowExpansionErrors` 逐组件旧校验回调65→65、`orchestrate/start`26→26、`RuntimeSurface.run`48→48及其筛选订阅回调20→20。外层校验入口21→4，新增规则已移至独立的层级校验职责。上述旧函数不以外层低分掩盖；后续入口沿仓库复杂度计划处理。本文件同扫出的其他存量高值函数未改自身分支，原始前后报告逐项保留。

行为依据：合法/非法完整Page、旧子表/普通Excel、取消/迟到回执、首次恢复查询、归属变化意图及任务超时测试；对应最终测试与浏览器证据见[result.md](result.md)。

## 全部新增函数与回调

以下限定名保留实际测量行号；原始JSON留在本地同目录，按仓库约定不随普通证据提交。

### `apps/playground/fixtures/hierarchy-gateway.ts`

| 函数/回调 | 行 | selfCC |
|---|---:|---:|
| `createHierarchyGateway` | 3 | 1 |
| `createHierarchyGateway/encodeSearch` | 4 | 2 |
| `createHierarchyGateway/fetchFilterCandidates` | 9 | 2 |
| `createHierarchyGateway/fetchFilterCandidates/<anonymous@11:92>` | 11 | 1 |

### `packages/engine/runtime-ui/src/RuntimeSurface.svelte`

| 函数/回调 | 行 | selfCC |
|---|---:|---:|
| `run/<anonymous@613:24>` | 613 | 2 |

### `packages/engine/runtime-ui/src/table/controller.ts`

| 函数/回调 | 行 | selfCC |
|---|---:|---:|
| `createTableController/syncHierarchy` | 32 | 4 |
| `createTableController/hierarchy` | 81 | 1 |
| `createTableController/hierarchySnapshot` | 82 | 10 |
| `createTableController/hierarchyRows` | 93 | 2 |

### `packages/engine/runtime-ui/src/table/export/hierarchy.ts`

| 函数/回调 | 行 | selfCC |
|---|---:|---:|
| `prepareHierarchyExport` | 11 | 4 |
| `prepareHierarchyExport/<anonymous@18:26>` | 18 | 1 |
| `prepareHierarchyExport/fetchData` | 20 | 2 |
| `assertKeys` | 37 | 3 |
| `assertKeys/<anonymous@38:23>` | 38 | 1 |
| `assertKeys/<anonymous@39:16>` | 39 | 1 |
| `collectChildren` | 41 | 5 |
| `collectChildren/<anonymous@46:38>` | 46 | 4 |
| `collectChildren/<anonymous@46:38>/fetchData` | 50 | 1 |
| `collectChildren/<anonymous@59:46>` | 59 | 3 |
| `collectChildren/<anonymous@59:46>/<anonymous@60:64>` | 60 | 1 |
| `collectChildren/<anonymous@64:34>` | 64 | 2 |
| `collectChildren/<anonymous@65:35>` | 65 | 2 |
| `collectChildren/<anonymous@65:35>/<anonymous@65:75>` | 65 | 1 |
| `mapParents` | 70 | 2 |
| `mapParents/worker` | 72 | 2 |

### `packages/engine/runtime-ui/src/table/export/workbook.ts`

| 函数/回调 | 行 | selfCC |
|---|---:|---:|
| `encodeWorkbookTables` | 37 | 2 |
| `writeTableSheet` | 44 | 6 |
| `writeTableSheet/title` | 49 | 7 |
| `writeTableSheet/project` | 54 | 1 |
| `writeTableSheet/project/<anonymous@54:78>` | 54 | 3 |
| `writeTableSheet/project/<anonymous@54:78>/<anonymous@57:72>` | 57 | 2 |
| `writeTableSheet/project/<anonymous@54:78>/<anonymous@60:71>` | 60 | 2 |
| `writeTableSheet/<anonymous@64:29>` | 64 | 5 |
| `writeTableSheet/<anonymous@85:16>` | 85 | 4 |
| `writeTableSheet/<anonymous@85:16>/<anonymous@88:27>` | 88 | 14 |
| `writeTableSheet/<anonymous@108:25>` | 108 | 4 |
| `downloadWorkbookBytes` | 117 | 1 |
| `downloadWorkbookBytes/<anonymous@124:39>` | 124 | 1 |

### `packages/engine/runtime-ui/tests/hierarchy-export.test.ts`

| 函数/回调 | 行 | selfCC |
|---|---:|---:|
| `state` | 6 | 1 |
| `<anonymous@7:135>` | 7 | 3 |
| `<anonymous@7:135>/<anonymous@14:34>` | 14 | 1 |
| `<anonymous@7:135>/<anonymous@15:34>` | 15 | 1 |
| `<anonymous@20:101>` | 20 | 1 |
| `<anonymous@30:99>` | 30 | 1 |
| `<anonymous@30:99>/fetchData` | 32 | 2 |
| `<anonymous@30:99>/fetchData/<anonymous@33:32>` | 33 | 3 |
| `<anonymous@38:77>` | 38 | 1 |
| `<anonymous@38:77>/run` | 42 | 1 |
| `<anonymous@46:56>` | 46 | 1 |
| `<anonymous@46:56>/fetchData` | 48 | 1 |
| `<anonymous@46:56>/fetchData/<anonymous@48:74>` | 48 | 1 |
| `<anonymous@53:68>` | 53 | 1 |
| `<anonymous@53:68>/fetchData` | 55 | 3 |
| `<anonymous@53:68>/run` | 59 | 1 |
| `<anonymous@62:97>` | 62 | 1 |
| `<anonymous@62:97>/<anonymous@64:92>` | 64 | 1 |
| `<anonymous@62:97>/<anonymous@64:101>` | 64 | 1 |
| `<anonymous@62:97>/<anonymous@64:108>` | 64 | 1 |
| `<anonymous@72:74>` | 72 | 1 |
| `<anonymous@72:74>/fetchData` | 74 | 1 |
| `<anonymous@72:74>/fetchFilterCandidates` | 74 | 1 |
| `<anonymous@72:74>/fetchFilterCandidates/<anonymous@74:154>` | 74 | 1 |

### `packages/engine/runtime/src/orchestrator.ts`

| 函数/回调 | 行 | selfCC |
|---|---:|---:|
| `initialTableView` | 188 | 2 |

### `packages/engine/runtime/src/table/expansion.ts`

| 函数/回调 | 行 | selfCC |
|---|---:|---:|
| `createRowExpansionController/startQuery` | 110 | 4 |
| `createRowExpansionController/startQuery/fetchData` | 114 | 1 |
| `createRowExpansionController/startQuery/displayInputs` | 116 | 1 |
| `createRowExpansionController/startQuery/filterRevision` | 116 | 2 |
| `createRowExpansionController/startQuery/<anonymous@118:43>` | 118 | 2 |
| `createRowExpansionController/startQuery/<anonymous@118:43>/<anonymous@120:59>` | 120 | 1 |
| `createRowExpansionController/refresh` | 123 | 3 |
| `createRowExpansionController/refresh/signature` | 126 | 1 |
| `createRowExpansionController/refresh/signature/<anonymous@126:82>` | 126 | 1 |
| `createRowExpansionController/refresh/<anonymous@129:74>` | 129 | 1 |
| `createRowExpansionController/selectionMove` | 132 | 4 |
| `createRowExpansionController/syncSelectedRow` | 138 | 11 |
| `createRowExpansionController/syncSelectedRow/<anonymous@147:61>` | 147 | 1 |
| `createRowExpansionController/sync` | 152 | 1 |

### `packages/engine/runtime/src/table/hierarchy-selection.ts`

| 函数/回调 | 行 | selfCC |
|---|---:|---:|
| `hierarchyChoice` | 15 | 13 |
| `resolveHierarchySelection` | 28 | 15 |
| `resolveHierarchySelection/displayInputs` | 34 | 1 |
| `resolveHierarchySelection/filterRevision` | 34 | 2 |
| `resolveHierarchySelection/<anonymous@49:18>` | 49 | 2 |
| `resolveHierarchySelection/<anonymous@50:35>` | 50 | 1 |
| `hierarchyRows` | 56 | 7 |
| `hierarchyRows/<anonymous@59:23>` | 59 | 1 |
| `hierarchyRows/<anonymous@60:16>` | 60 | 1 |
| `hierarchyRows/<anonymous@63:29>` | 63 | 1 |
| `rowExpansionFilters` | 68 | 12 |
| `rowExpansionFilters/<anonymous@77:69>` | 77 | 1 |
| `rowExpansionFilters/<anonymous@84:34>` | 84 | 1 |
| `createHierarchySelectionSession` | 92 | 1 |
| `createHierarchySelectionSession/snapshot` | 96 | 1 |
| `createHierarchySelectionSession/sync` | 97 | 8 |
| `createHierarchySelectionSession/sync/<anonymous@101:78>` | 101 | 1 |
| `createHierarchySelectionSession/sync/<anonymous@110:85>` | 110 | 3 |
| `createHierarchySelectionSession/sync/<anonymous@112:9>` | 112 | 3 |
| `createHierarchySelectionSession/dispose` | 114 | 1 |

### `packages/engine/runtime/src/table/session.ts`

| 函数/回调 | 行 | selfCC |
|---|---:|---:|
| `createTableSession/resetDefault` | 31 | 1 |

### `packages/engine/runtime/tests/hierarchy-fixture.ts`

| 函数/回调 | 行 | selfCC |
|---|---:|---:|
| `hierarchyFixture` | 7 | 3 |
| `choose` | 13 | 3 |
| `hierarchySim` | 18 | 3 |
| `hierarchySim/<anonymous@20:27>` | 20 | 1 |
| `hierarchySim/encodeSearch` | 22 | 1 |
| `hierarchySim/fetchFilterCandidates` | 26 | 2 |
| `hierarchySim/fetchFilterCandidates/<anonymous@28:92>` | 28 | 1 |
| `hierarchySim/close` | 30 | 1 |
| `hierarchySim/close/<anonymous@30:86>` | 30 | 1 |
| `hierarchySim/close/<anonymous@30:86>/<anonymous@30:117>` | 30 | 2 |

### `packages/engine/runtime/tests/hierarchy-selection.test.ts`

| 函数/回调 | 行 | selfCC |
|---|---:|---:|
| `<anonymous@9:97>` | 9 | 2 |
| `<anonymous@9:97>/<anonymous@11:67>` | 11 | 1 |
| `<anonymous@9:97>/<anonymous@12:131>` | 12 | 1 |
| `<anonymous@9:97>/<anonymous@13:88>` | 13 | 1 |
| `<anonymous@9:97>/<anonymous@13:319>` | 13 | 1 |
| `<anonymous@15:102>` | 15 | 1 |
| `<anonymous@15:102>/<anonymous@23:10>` | 23 | 1 |
| `<anonymous@15:102>/<anonymous@24:10>` | 24 | 1 |
| `<anonymous@27:83>` | 27 | 1 |
| `<anonymous@31:84>` | 31 | 1 |
| `<anonymous@31:84>/run` | 34 | 1 |
| `<anonymous@31:84>/fetchFilterCandidates` | 37 | 1 |
| `<anonymous@40:133>` | 40 | 1 |
| `<anonymous@40:133>/<anonymous@42:67>` | 42 | 2 |
| `<anonymous@40:133>/<anonymous@43:82>` | 43 | 1 |
| `<anonymous@40:133>/<anonymous@46:21>` | 46 | 1 |
| `<anonymous@40:133>/<anonymous@48:21>` | 48 | 1 |
| `<anonymous@40:133>/<anonymous@51:21>` | 51 | 1 |
| `<anonymous@56:100>` | 56 | 1 |
| `<anonymous@56:100>/<anonymous@59:87>` | 59 | 1 |
| `<anonymous@56:100>/<anonymous@61:88>` | 61 | 1 |
| `<anonymous@67:98>` | 67 | 1 |
| `<anonymous@67:98>/fetchData` | 69 | 1 |
| `<anonymous@67:98>/fetchData/<anonymous@69:163>` | 69 | 1 |
| `<anonymous@67:98>/<anonymous@70:67>` | 70 | 1 |
| `<anonymous@67:98>/<anonymous@72:85>` | 72 | 1 |
| `<anonymous@67:98>/<anonymous@73:85>` | 73 | 1 |
| `<anonymous@67:98>/<anonymous@74:35>` | 74 | 1 |
| `<anonymous@67:98>/<anonymous@74:115>` | 74 | 1 |
| `<anonymous@67:98>/<anonymous@76:45>` | 76 | 1 |
| `<anonymous@78:78>` | 78 | 1 |
| `<anonymous@78:78>/<anonymous@80:43>` | 80 | 1 |
| `<anonymous@78:78>/<anonymous@81:82>` | 81 | 1 |
| `<anonymous@78:78>/<anonymous@84:21>` | 84 | 1 |
| `<anonymous@78:78>/<anonymous@87:21>` | 87 | 1 |
| `<anonymous@78:78>/<anonymous@90:21>` | 90 | 1 |
| `<anonymous@94:82>` | 94 | 1 |
| `<anonymous@94:82>/<anonymous@98:43>` | 98 | 1 |
| `<anonymous@94:82>/<anonymous@98:43>/<anonymous@98:79>` | 98 | 1 |
| `<anonymous@94:82>/<anonymous@99:82>` | 99 | 1 |
| `<anonymous@94:82>/<anonymous@101:134>` | 101 | 1 |
| `<anonymous@94:82>/<anonymous@103:21>` | 103 | 1 |
| `<anonymous@94:82>/<anonymous@104:118>` | 104 | 1 |
| `<anonymous@94:82>/<anonymous@105:115>` | 105 | 1 |
| `<anonymous@110:95>` | 110 | 1 |
| `<anonymous@110:95>/<anonymous@112:87>` | 112 | 1 |
| `<anonymous@121:88>` | 121 | 3 |
| `<anonymous@121:88>/<anonymous@123:151>` | 123 | 1 |
| `<anonymous@121:88>/<anonymous@129:67>` | 129 | 1 |
| `<anonymous@121:88>/<anonymous@130:63>` | 130 | 1 |
| `<anonymous@121:88>/<anonymous@130:147>` | 130 | 1 |
| `<anonymous@121:88>/<anonymous@132:21>` | 132 | 1 |
| `<anonymous@121:88>/<anonymous@133:44>` | 133 | 1 |
| `<anonymous@121:88>/<anonymous@134:61>` | 134 | 1 |
| `<anonymous@138:101>` | 138 | 1 |
| `<anonymous@138:101>/fetchData` | 140 | 1 |
| `<anonymous@138:101>/<anonymous@141:67>` | 141 | 1 |
| `<anonymous@138:101>/<anonymous@143:43>` | 143 | 1 |
| `<anonymous@138:101>/<anonymous@146:155>` | 146 | 1 |
| `<anonymous@138:101>/<anonymous@146:192>` | 146 | 1 |

### `packages/page/src/table/validate-expansion.ts`

| 函数/回调 | 行 | selfCC |
|---|---:|---:|
| `componentHierarchyExportErrors` | 126 | 2 |
| `legacyExpandedExport` | 127 | 2 |
| `missingExpansionParam` | 128 | 2 |
| `missingExpansionParam/<anonymous@128:138>` | 128 | 1 |
| `privateBindingErrors` | 129 | 8 |
| `privateBindingErrors/<anonymous@134:56>` | 134 | 2 |
| `privateBindingErrors/<anonymous@135:75>` | 135 | 2 |
| `sourceOwnerErrors` | 140 | 7 |
| `sourceOwnerErrors/<anonymous@143:29>` | 143 | 2 |
| `privateInputErrors` | 152 | 8 |
| `privateInputErrors/<anonymous@159:29>` | 159 | 2 |
| `privateInputErrors/<anonymous@159:29>/<anonymous@159:122>` | 159 | 1 |
| `privateInputErrors/<anonymous@161:29>` | 161 | 2 |
| `privateInputErrors/<anonymous@161:29>/<anonymous@161:104>` | 161 | 2 |

### `packages/page/src/table/validate-selection.ts`

| 函数/回调 | 行 | selfCC |
|---|---:|---:|
| `issue` | 9 | 1 |
| `rawString` | 11 | 4 |
| `completeQuery` | 15 | 5 |
| `completeQuery/<anonymous@18:49>` | 18 | 5 |
| `lookupInputs` | 20 | 8 |
| `lookupInputs/<anonymous@26:26>` | 26 | 1 |
| `lookupInputs/<anonymous@26:87>` | 26 | 1 |
| `lookupInputs/<anonymous@27:56>` | 27 | 3 |
| `lookupInputErrors` | 32 | 9 |
| `lookupInputErrors/<anonymous@33:53>` | 33 | 1 |
| `lookupBindingExists` | 41 | 4 |
| `lookupBindingExists/<anonymous@43:52>` | 43 | 1 |
| `lookupBindingExists/<anonymous@44:59>` | 44 | 1 |
| `hierarchySelectionErrors` | 47 | 5 |
| `hierarchySelectionErrors/<anonymous@50:85>` | 50 | 1 |
| `validHierarchyLevels` | 56 | 7 |
| `selectionDeclarationErrors` | 60 | 8 |
| `selectionDeclarationErrors/<anonymous@62:30>` | 62 | 1 |
| `selectionDeclarationErrors/<anonymous@67:62>` | 67 | 1 |
| `childSelectionErrors` | 70 | 11 |
| `childSelectionErrors/<anonymous@74:24>` | 74 | 1 |
| `childSelectionErrors/<anonymous@74:78>` | 74 | 2 |
| `childSelectionErrors/<anonymous@77:34>` | 77 | 1 |
| `hierarchyExportErrors` | 83 | 5 |
| `hierarchyExportErrors/<anonymous@88:95>` | 88 | 1 |

### `packages/page/src/version.ts`

| 函数/回调 | 行 | selfCC |
|---|---:|---:|
| `usedAt/<anonymous@393:38>/<anonymous@393:124>` | 393 | 1 |
| `usedAt/<anonymous@708:9>` | 708 | 2 |
| `usedAt/<anonymous@709:13>` | 709 | 1 |
| `usedAt/<anonymous@728:9>` | 728 | 2 |
| `usedAt/<anonymous@729:13>` | 729 | 1 |
| `usedAt` | 734 | 3 |
| `usedAt` | 742 | 1 |
| `usedAt/<anonymous@745:9>` | 745 | 2 |
| `usedAt/<anonymous@746:13>` | 746 | 1 |
| `usedAt` | 750 | 1 |

### `packages/page/tests/hierarchy-selection.test.ts`

| 函数/回调 | 行 | selfCC |
|---|---:|---:|
| `<anonymous@4:93>` | 4 | 1 |
| `version` | 11 | 1 |
| `reversed` | 12 | 1 |
| `multiple` | 13 | 1 |
| `missingLevel` | 14 | 1 |
| `noLookup` | 15 | 1 |
| `parentWindow` | 16 | 1 |
| `parentBinding` | 17 | 1 |
| `numberMatch` | 18 | 1 |
| `lookupShared` | 19 | 1 |
| `noSelectedInput` | 20 | 1 |
| `noSelection` | 21 | 1 |
| `exportFields` | 22 | 1 |
| `duplicateFields` | 23 | 1 |
| `lookupWindow` | 24 | 1 |
| `lookupRow` | 25 | 1 |
| `privateShared` | 26 | 1 |
| `<anonymous@28:73>` | 28 | 2 |
| `<anonymous@28:73>/<anonymous@30:73>` | 30 | 1 |
| `<anonymous@32:65>` | 32 | 1 |

### `tools/dqe-sim/src/hierarchy-selection.ts`

| 函数/回调 | 行 | selfCC |
|---|---:|---:|
| `record` | 5 | 3 |
| `value` | 6 | 5 |
| `value/<anonymous@8:41>` | 8 | 2 |
| `matching` | 11 | 10 |
| `matching/<anonymous@17:50>` | 17 | 1 |
| `matching/<anonymous@19:22>` | 19 | 1 |
| `scenarioRows` | 23 | 9 |
| `scenarioRows/<anonymous@29:34>` | 29 | 1 |
| `scenarioRows/<anonymous@32:51>` | 32 | 1 |
| `scenarioRows/<anonymous@34:31>` | 34 | 1 |
| `scenarioRows/<anonymous@34:31>/<anonymous@34:70>` | 34 | 1 |
| `executeHierarchySelection` | 37 | 12 |
| `executeHierarchySelection/<anonymous@48:54>` | 48 | 1 |
| `executeHierarchySelection/<anonymous@48:54>/<anonymous@48:89>` | 48 | 1 |

### `tools/scripts/local-authoring-data-analysis.ts`

| 函数/回调 | 行 | selfCC |
|---|---:|---:|
| `scanHierarchySelection` | 127 | 3 |

### `tools/scripts/page-conformance-vectors.ts`

| 函数/回调 | 行 | selfCC |
|---|---:|---:|
| `mutate` | 2486 | 1 |
| `mutate` | 2487 | 1 |
| `mutate` | 2488 | 1 |
| `mutate` | 2492 | 1 |

## 原始测量校验

| 文件 | SHA256 |
|---|---|
| `complexity-before.json` | `0bde9bb9beaf21912c4a641de0ca50290368b15095c380b1966d720dd2764ec5` |
| `complexity-after.json` | `e7e9384f1140236e0cbaa411eaae7618e69c915d55dd2c18fe0de7f67a4a3290` |
