# 统一导出按钮与元数据清晰度

日期：2026-10-19。需求：同一种按钮按元数据实例化PDF/PNG，点击直接下载，清晰度由配置决定。

## 结构与兼容

`reportHeader.props.exportButtons`，1至2项，每种格式最多一项；每项 `{format, label?, filename?, scale?}`。PDF支持2/3/4倍，默认2；PNG支持3/4倍，默认3。协议6.31；旧pdfExport/pngExport在读取接缝归一化，禁止混用，编辑器写回新结构。删除菜单、清晰度弹窗、二次生成/保存、待保存Blob和5分钟过期逻辑。实例任务状态、独立文档、水印隔离、完整正文和单PNG约束保持。

PDF高倍率采用预算内截图块，一个纸张可承接多个块；不按画布预算降低倍率。Worker按页号、纵向位置和完成标记写入，完成全部页才下载。

## 页面、文档与Skill

- `pages/report-png-export.json`：PDF 2倍/PNG 3倍与PDF/PNG 4倍配置、日期、图表、12行明细和未启用对照。
- `pages/report-png-long-export.json`：4倍、140行、单PNG跨内部块。
- `pages/report-pdf-export.json`：旧PDF配置兼容。
- 协议正文：`docs/page-metadata/components/reportHeader.md`；索引：`PAGE-METADATA.md`；新能力门禁、合法夹具和6项非法向量同步。
- Skill入口更新exportButtons路由；真源重新导出为753产品、4创作、1接口文件，含独立校验器与哈希清单。

## 本地验证

- `pnpm test`：253文件通过，2190测试通过、5跳过；另补充旧配置归一化测试，单文件2项通过。
- `pnpm check`：全部通过，Svelte诊断0错误0警告。
- `pnpm build:packages`、Embed ES/IIFE、Platform构建通过。
- 作者Python完整540项通过、1跳过，无真实模型调用。
- `pnpm authoring:contracts:check` 与Bundle检查通过；独立安装Skill闭合由全量测试覆盖。
- Chrome实际下载10项通过：直接两按钮、唯一PNG签名和原生解码、父层DOM/伪元素水印隔离、3/4倍、DPR2、键盘、点击期间文件名冻结、长报告逐行接缝校验、Worker错误/销毁、旧PDF/CSP/重复任务回归。
- 已安装tarball消费者重新安装本次page/engine/embed包，类型检查、构建与同样10项Chrome浏览器用例全部通过；未安装Edge，完整双浏览器矩阵未完成。
- 4倍PDF实际输出单页A4，编码块宽4800且每块≤16777216像素；包含同页多块，Poppler渲染检查标题、背景、完整图表和12行明细。

无提交、push、部署或真实DQE/Relay/门户验收。主动跨文档注入水印的门户仍需真实环境核验；本地合成数据与Chrome测试不替代该结论。
