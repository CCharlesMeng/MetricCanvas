# 行权效率：图表独立区域切换

- 页面：`governance-compliance.json`；形态沿用输入的 Dashboard，Schema 6.59。
- 入口：`/pages/governance-compliance`。四张图左上各有“中国区 / 海外”，默认中国区；显示“中国区”时查询值为原来的“国内”。
- `sdt-duration-site`、`sdt-count-site`、`biz-decision-site`、`contract-decision-site` 分别绑定一个图表数据源的 `国内或海外`。期间和区域仍是四图共享条件；两张 inline 表保留输入内容。
- 操作：逐图选择海外，其他图的按钮保持原选择，仅对应查询改变站点谓词；刷新后从 URL 恢复四项选择。浏览器已用合成响应验证桌面 1440px、窄屏 390px、四图查询隔离和 URL 恢复。
- 当前主工作区产品及 Skill 为 6.52，不能加载原输入的 6.59 常量系列。没有降低页面版本或改写基线系列；使用本地 `chart-constant-values` 工作树的 6.59 运行时完成兼容校验及浏览器验证。
- 本次预览：`http://127.0.0.1:5194/pages/governance-compliance`，从此目录直接发现和加载精确页面文件，运行脚本 `/tmp/governance-preview.mjs`，停止后可在上述工作树 `apps/playground` 下运行 `node /tmp/governance-preview.mjs` 重启。普通浏览器需已配置的业务 DQE；自动化检查中的合成响应不写入页面或常驻服务。
- 原始字节备份、校验回执、浏览器截图和请求证据：`docs/evidence/governance-compliance-20261027/`。输入内联数值为演示占位；真实业务 DQE、权限与指标口径未验证。
- 仅修改页面声明及工作流说明，没有修改可执行函数或分支，函数复杂度测量不适用。
