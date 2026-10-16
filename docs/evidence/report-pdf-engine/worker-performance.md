# Report PDF 后台编码与旧入口移除验收

日期：2026-10-16。实施基线：601c96bca747b46f8d9c725e433a09e4e6c81425。用户批准Dedicated Worker编码、主线程分批处理，另裁决withExportView作废，不保留旧方案兼容；不再需要用户取消。现行行为由ADR-0097与docs/report-export.md维护。

## 实现及范围

移除HTML/Svelte实例的withExportView及三个公共DOM类型，删除取消按钮。内置下载捕获实例状态，保留取数范围、部分数据、10000行和准备60秒规则。DOM、计算样式、布局和静态组件仍在主线程；使用6ms预算，并每四次让出进入一次普通任务队列，防止仅使用优先续体饿死普通任务。截图Adapter从锁定html2canvas 1.4.1生成，异步克隆/解析/绘制并一次解析多块复用；不另造CSS渲染规则。

一个任务独立Worker，通过transfer list传ImageBitmap；最多一块在后台处理、一块在主线程准备。OffscreenCanvas裁切，原生PNG编码；不透明RGB PNG复用压缩流和Predictor 15，支持压缩流时通过原生解压/压缩整理过滤行，避免JavaScript重建全部像素及重复压缩；其他PNG格式保留jsPDF无损处理。Worker返回完整文件ArrayBuffer后下载。所有终态释放Worker、画布、位图、临时DOM和对象URL；60秒无生成进展或消息无响应会失败，内部实例失效仍可中止。

## 同场景基线与结果

本机Chrome、1440×1000视口、1200px内容宽度，商务SDT月报，50行合成数据、六个分区、3页PDF。网关立即返回固定数据，不包含真实DQE网络耗时。原实现从未修改的主工作区加载，新实现从独立worktree加载；两次测量顺序执行，未并行运行浏览器。使用相同输入、浏览器和16ms定时心跳；longtask由PerformanceObserver记录。

| 指标 | 原实现（三次） | 新实现（三次） |
|---|---|---|
| 总耗时ms | 2242 / 2108 / 2000 | 1162 / 1089 / 1112 |
| 最大主线程长任务ms | 915 / 862 / 806 | 未检测到≥50ms长任务 |
| 心跳间隔P95 ms | 232 / 209 / 214 | 32 / 33 / 40 |
| 最大心跳间隔ms | 1009 / 940 / 882 | 79 / 75 / 77 |
| PDF字节 | 2,003,938 | 1,995,930 |

中位总耗时下降约47%。这不是所有设备或生产数据量的保证，也不将后台计算与总耗时改善混为一谈。之后增加无进展期限，重复浏览器回归仍通过；并行构建/长表验收时耗时为1176–1325ms、最大心跳83ms。

从两个PDF提取全部三个图片资源比较：两张像素完全相同；另一张仅81/8,145,600像素的绿色通道相差1级，其余通道一致。源布局、纸张尺寸、连续分页和完整行数一致。3500行已知颜色栅格接缝测试为0像素行不匹配。原生RGB直嵌和非RGB回退均实际生成了PDF；Chrome产物确认Predictor 15。

500行长表（直接读取report-pdf-export页面，仅扩充inline数据）导出17页、6个图片块，每块不超过8192最长边/1600万像素；实际最长主线程任务78ms，重复下载与Worker失败清理通过。较长报告耗时随DOM、像素及文件大小增加，仍受固定行数与资源限制。

## 验证与分发

- `pnpm test`：248文件通过，2157测试通过、5跳过；之后新增公平调度和失效恢复回归，定向四文件15项通过。
- `pnpm check`、`pnpm build:packages`、embed生产ES/IIFE构建：全部通过，所有Svelte检查0错误0警告。
- `report-pdf-performance-browser.mjs`、`report-pdf-browser.mjs`、`report-pdf-continuous-browser.mjs`、`report-pdf-runtime-fidelity-browser.mjs`、`report-pdf-appearance-browser.mjs`、`report-pdf-fidelity-browser.mjs`、`report-pdf-partial-browser.mjs`均已执行；覆盖梯度字形/留白、背景、53行53柱、多列几何、并排表格、部分取数失败和资源清理。
- embed生产构建五项回归：配置驱动实际下载、编码失败、无取消与销毁释放、导出期间切月仍冻结点击时文本/文件名、CSP禁止Blob Worker时明确失败。
- `pnpm report-pdf:check`核对Worker和截图生成器；公开面快照明确删除旧类型，HTML实例没有withExportView。
- 从产品真源生成页面参考与Skill。authoring contracts与Bundle检查通过；独立复制Skill目录到仓外，Node校验report-pdf-export通过，协议保持6.29。没有新增模型创作流程，不声称真实DS模型验收。

需要目标浏览器支持Worker、OffscreenCanvas和ImageBitmap，宿主CSP允许worker-src blob:。单文件产物内嵌Worker，不依赖CDN或单独资源路由。真实DQE、Relay、Java、内网宿主CSP和生产部署未验收；安装消费者的Chrome/Edge矩阵由当前提交CI另行记录。
