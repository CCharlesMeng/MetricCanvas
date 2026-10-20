# Alpha tests

## AC ↔ 证据映射

| AT | 状态 | 执行环境 | 证据记录 | 新鲜度 | 说明 |
| --- | --- | --- | --- | --- | --- |
| AT-P1 | PROVEN | mock | BE-1、BE-4；browser-final、consumer-final | code=17886903b0b78e34ce5a2e73f7167f7da780d5f934dda4b52875292406721cf0 | 普通根与ShadowRoot鼠标点击、重复关闭、清空、移除、禁用 |
| AT-P2 | PROVEN | mock | BE-2、BE-4；browser-final | code=17886903b0b78e34ce5a2e73f7167f7da780d5f934dda4b52875292406721cf0 | 官方默认颜色和几何值逐项断言，树线与半选保留回归 |
| AT-P3 | PROVEN | mock | BE-3；page-final | code=17886903b0b78e34ce5a2e73f7167f7da780d5f934dda4b52875292406721cf0 | 5个本地页面场景、1440×1000与390×844，无页面错误 |

## 因果与验证记录

- click-red.txt / click-trace-red.txt保留同一自然鼠标断言失败：pointerdown打开、pointerup原生light-dismiss关闭。改为完整click打开并记录按下前状态后通过。
- SVG实际为0×0，恢复16px；官方suffix-inner的pointer-events阻断箭头点击，提高局部选择器优先级并以独立Vite与安装包验证。
- 旧蓝色info标签改用官方基础light灰标签；输入包裹32px、标签24px、选项32px、箭头灰色、搜索两侧16px及左内边距20px均有computed-style断言。
- 29项组件浏览器、5个实际页面场景、5项仓外安装包浏览器、40项定向单测；UI检查0错误0警告。数据为本地合成，当前范围不含服务集成变更。
- session-diff.patch保存本修复相对前序未提交实现的确切差异；前序ui/证据保留为历史记录。
