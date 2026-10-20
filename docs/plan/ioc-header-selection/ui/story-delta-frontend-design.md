# IOC 选择控件设计与 API 审查

## 用户批准的规格

1. 搜索为可选项，默认有搜索，覆盖平面/树、单/多选。搜索只过滤已加载候选；匹配名称、编码与祖先路径，忽略首尾空白和拉丁字母大小写；不改变已选值、不触发业务查询。
2. 多选在输入区显示可删除标签，始终单行横向滚动，不能随标签数增加高度。
3. 采用已冻结 OpenTiny OS 3.32.0 官方 CSS 及官方 SVG。树收起为描边加号、展开为描边减号，浅灰线连接。保留用户已批准的水平滚动。未确认增强暂不加入。
4. 树单选任一可选节点替换当前值并关闭；加减号只展开收起。只选叶子模式的父节点仅展开。
5. 未指定的业务选择语义不猜测：存量树默认父选后代，显式 independent 才提交父级自身稳定码；leaf 只提交叶子；单选从不将父节点展开成多值。
6. 保留候选 loading/empty/unavailable/error；选值缺少候选仍以稳定代码回显且可删除；禁用状态不允许变更。

## 正式 API 选择

- 中立 `Selection` 接收 `options: UiTreeOption[]`、`value: string[]`、`multiple`、`searchable=true`、`tree`、`treeSelection`、`disabled`、`placeholder`、`statusText`、`onchange`。状态由调用方持有，浮层/搜索/展开仅本地临时状态。
- 现有 `Select` 的 string value/onchange 保持；增加 `searchable=true`，内部用同一控件。多选不改变现有 Select 的返回类型。
- 页面 dimension 新增 `selection: single|multiple`（缺省 multiple，tabs 固定 single）、`searchable: boolean`（缺省 true）、`treeSelection: descendants|independent|leaf`（仅 tree；缺省 descendants 保留存量查询）。筛选状态继续 string[]，single 限制最多一值；URL 非法多值不覆盖合法初值，直接写入拒绝。
- 候选端口非破坏扩展 `parentValue?: string`，指向本批候选中的稳定 value。显式关系不拼 label；非法父引用、重复码或循环显示层级错误，不提交猜测值。不提供 parentValue 时保留已有 '/' 路径建树契约；纯结构祖先不能在独立/单选中当业务码提交。
- 不改远程搜索/懒加载/分页接口，不把多级 dimension hierarchy 的“换查询字段”与同一维度候选树混淆。
- 新页面字段由当前 HEAD 6.31 升到 6.32（此隔离检出没有其他任务未提交的 6.32 草案），版本门和契约同步。

## 视觉来源与证据边界

官方来源：docs/evidence/platform-ui-os-theme-2026-10-12/sources.json（CSS，SHA256校验）；https://github.com/opentiny/tiny-vue/tree/465189f87db9555d0c6f4abde77774649e89046d（SVG）。这是用户批准的官方风格和固定几何要求；不是官网整页截图像素比对，不承诺远程真实候选/权限/真实 DQE 验收。
