# 独立安装浏览器矩阵适配

`9fc129612069a9bed3d8e32ba3dfadafe00fda3e` 的[CI](https://github.com/CCharlesMeng/MetricCanvas/actions/runs/41478574383)中，测试、类型、创作、构建及Windows/Linux MC分发均通过；兼容性矩阵474通过、44失败，总门禁失败，不能记为完成。

本地先使用构建后的embed复现两个代表失败：呈现矩阵还断言旧的55/53条，新增IOC Header后实际为56/54条；子表格测试取第一个article，组件化的兼容页头现在也使用article，因此定位停在标题上。CI页面快照中实际父行与数据均正常存在。32项计数失败及12项定位超时共同解释44项失败。

只调整三个浏览器测试文件：矩阵明确包含新增组件；子表格/行号用article[data-component-type="table"]选择实际表格组件，保持第一/第二张表的原语义和所有行、分页、缓存、重试及列数断言。产品代码、JSON、查询与超时未修改。

复验：三个相关文件41项Chrome检查通过；完整本地Chrome矩阵243项全部通过（1.8分钟），并再次确认1409产品/4创作/1接口生成一致。独立安装Chrome/Edge矩阵由新提交CI重验；本机没有安装Edge，不把本地Chrome结果当成Edge证明。

复杂度：metriccanvas-ts-ast/1、TypeScript5.9.3测量三个文件全部90个函数和回调，分数全部保持。修改的呈现测试回调selfCC3→3，六个表格测试回调各1→1；无新增函数、无新增超限。未修改的inaccessibleText嵌套回调16仍属原存量，不在本次纯定位/计数修正中扩大重构。明细见[browser-compatibility.json](browser-compatibility.json)。
