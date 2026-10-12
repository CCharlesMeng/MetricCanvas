# DatePicker · Alpha Tests

## AC ↔ 证据映射

| AT | 状态 | 执行环境 | 证据记录 | 新鲜度 | 说明 |
| --- | --- | --- | --- | --- | --- |
| AT-1 | PROVEN | mock | restore-report-green.json；BE-1、BE-9、BE-12、BE-13、BE-15 | review-1 | GREEN 52/52，尺寸容差0px；code=616ead21db764d050c70dd0f933d96006535ef31b687ae0276060108750d8694 |
| AT-2 | PROVEN | mock | focused-tests.txt；BE-2、BE-3 | review-1 | 6文件30项；半范围保持已应用值，跨年完整提交、倒置/非法/required清空拒绝、可选null、闰日与键盘 |
| AT-3 | PROVEN | mock | BE-5、BE-6、BE-7、BE-10、BE-11、BE-14 | review-1 | 正式期间与明细联动、创作提取确认、ShadowRoot、只读、多实例重挂、390/320页面无横溢出；最右月份可达 |
| AT-4 | PROVEN | mock | BE-8；output/pdf/report-date-picker-tiny-os.pdf | review-1 | 打开面板后点击正式导出；8页渲染检视，无日期输入或日历。PDF为位图，不能用空文本层证明隐藏 |

## 证据边界

使用正式引擎与本地合成数据，不代表真实 Relay/Java/DQE 或部署集成验收。浏览器采集在全部实现后集中执行；尺寸和计算样式与冻结官方事实比较，未按Task重复浏览器RED。

截图差分保留 meanAbsDifference=0.962/255、666/136710个像素差大于20；两张来源均为浏览器JPEG截图，因此不声称逐像素零差，也不把差分改写为0。样式契约52项已按原期望比较。仍可用 evidence/artifacts/selected-comparison.png 独立查看同尺寸参照与实现。

上游尺寸、SVG与CSS资产路径/hash见 evidence/upstream-assets.json，版权保留 tiny-vue-LICENSE.txt。起点三个修改文件的快照已归档 evidence/artifacts/starting-files/，差异见 evidence/artifacts/story-diff.txt。

## 实现证据

共享表现组件：packages/engine/runtime-ui/src/filters/DatePicker.svelte。单值与范围的正式适配器都复用它，datetime仍保持原分支。面板使用原挂载根中的浏览器top layer，关闭或销毁时清理监听和ResizeObserver。

独立夹具启动：`pnpm exec vite --config packages/engine/runtime-ui/tests/browser/vite.config.ts`，访问 `http://127.0.0.1:5188/packages/engine/runtime-ui/tests/browser/date-picker.html`。

## 后续优化

2026-10-11：网格重复CSS已合并。本表及原独立检视保留初次验收快照；当前重构的编译等价对照、类型与嵌入构建结果见 [optimization.md](optimization.md)。
