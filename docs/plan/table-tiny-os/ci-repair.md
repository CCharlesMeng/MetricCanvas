# CI 兼容性修复复验

首次交付提交 `eae372c4` 的 [CI](https://github.com/CCharlesMeng/MetricCanvas/actions/runs/39402808372) 中，tests、types、build、authoring 通过；独立安装兼容性矩阵有8项失败（四类问题分别发生在 Chrome 与 Edge），另412项通过。

- 移除新增的 embedded/fit 强制省略规则，保留长文本自然换行和滚动可达性；原有长文本可达性断言继续执行。
- 140行长PNG演示改用3倍输出，仍导出完整140行并跨截图块；不增加既有PNG像素预算、不更改用户其他页面倍率。新行高在4倍下已超过既有硬上限，继续用4倍会让演示直接失败。报告说明及本地创作知识同步更新；像素标尺仍逐输出行检查拼接无错。
- 像素对照两侧使用相同合成图层，使Linux的普通流参照与固定定位测试宿主采用相同抗锯齿路径；官方冻结CSS不变，PNG字节相等断言和零容差不变。
- 原生拖拽用例在1600px高的测试视口中显式检查起点和终点均可见；新行高使目标超出了原视口。仍真实拖动并断言组件已迁移、拖拽状态和反馈全部清除，不改变产品拖拽逻辑。

本地复验：Embed表格、搜索及报告图片的23项浏览器用例全部通过；Canvas的15项浏览器用例全部通过；另外单独复验embedded/forecast长文本可达性通过。相关三包类型检查、54个页面文档、创作契约一致性与3302个摘要核对通过。原始结果及源码摘要见 [复验记录](evidence/ci-repair-verification.json)。Linux独立安装结果仍以修复提交对应的新CI为准。

此前日期日历、枚举面板及完整交互状态的100%像素覆盖缺口不因CI修复而消失，AT-01继续保持未验证。

## 第二轮：固定文字栅格化环境

修复提交 `b0e736a2` 的独立安装矩阵已通过418项；长文本可达性、长PNG、原生拖拽在Chrome与Edge均已通过。剩余2项为同一个基础网格PNG对照的文字抗锯齿差异。仅强制相同合成图层不足以让所有sticky文字层采用同一路径，故撤销这段测试宿主transform，改为仅在新表格测试文件的浏览器中统一 `--disable-lcd-text`。该开关由[Chromium源码](https://chromium.googlesource.com/chromium/src/%2B/HEAD/content/public/common/content_switches.cc)定义，用于关闭LCD文字渲染；不会修改产品样式、冻结官方CSS、尺寸或比较容差。

本地重新执行本文件9项浏览器用例全部通过，Embed类型检查0错误0警告。具体命令环境及源码摘要见 [文字栅格化复验](evidence/text-rasterizer-verification.json)。Linux结果仍以新提交的完整CI为准。
