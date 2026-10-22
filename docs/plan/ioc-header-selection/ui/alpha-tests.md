# Alpha tests

## AC ↔ 证据映射

| AT | 状态 | 执行环境 | 证据记录 | 新鲜度 | 说明 |
| --- | --- | --- | --- | --- | --- |
| AT1 | PROVEN | mock | BE-1、BE-3、BE-5 | 当前依赖哈希见 evidence/review-evidence.json | 本地合成/正式契约；不代表真实服务 |
| AT2 | PROVEN | mock | BE-2、BE-6 | 当前依赖哈希见 evidence/review-evidence.json | 本地合成/正式契约；不代表真实服务 |
| AT3 | PROVEN | mock | BE-1、BE-3、BE-5 | 当前依赖哈希见 evidence/review-evidence.json | 本地合成/正式契约；不代表真实服务 |
| AT4 | PROVEN | mock | BE-4、BE-5、BE-6；26项Chrome浏览器与仓外tarball交互 | 当前依赖哈希见 evidence/review-evidence.json | 本地合成/正式契约；不代表真实服务 |
| AT5 | PROVEN | contract | quality_gate:state-boundary、quality_gate:final-focused；BE-1 | 当前依赖哈希见 evidence/review-evidence.json | 本地合成/正式契约；不代表真实服务 |
| AT6 | PROVEN | mock | BE-3、BE-6；filter-tree与map-hierarchy回归 | 当前依赖哈希见 evidence/review-evidence.json | 本地合成/正式契约；不代表真实服务 |
| AT7 | PROVEN | contract | quality_gate:contracts、quality_gate:bundle；quality_gate:regression（仓外local-authoring测试） | 当前依赖哈希见 evidence/review-evidence.json | 本地合成/正式契约；不代表真实服务 |

## 回归与修复记录

- 初次组件浏览器测试发现官方默认 wrap 覆盖单行声明，同一滚动/高度断言修复后通过。
- 独立检视发现半选 SVG 转录混入图层名称，按批准的官方图形要求修复为真实非空 path，保留白色填充；新增“两个合法路径、蓝底白色方块”断言并重跑浏览器与安装后交互。
- 1,141项核心及local-authoring/参考文档回归通过；此后只对最后涉及的依赖跑46项定向测试、状态边界、类型检查和浏览器。没有把初次版本派生产物漂移记作最终成功。

## 计划外承接

| 文件 | Task | 原因 |
| --- | --- | --- |
| packages/engine/runtime-ui/src/report-theme-properties.ts | T2 | 新选择样式变量需要完整进入导出主题；原生成器重生成并通过可重复性回归 |
| docs/page-metadata/reference-map.json、packages/ui/README.md | T5 | 公开API与新字段/版本的语义说明；保留原有同名selection语义 |
