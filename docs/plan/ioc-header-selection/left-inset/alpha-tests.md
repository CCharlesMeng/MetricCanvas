# Alpha tests

| AT | 状态 | 执行环境 | 证据记录 | 新鲜度 | 说明 |
| --- | --- | --- | --- | --- | --- |
| AT1 | PROVEN | mock | BE-1、selection-browser | code=bd19670d4376b6e5570da3526a91f85102184638eccb9ac907a441ee7ba7a783 | 7项浏览器回归；两种根的展开前后16px，实际IOC页面16px |

RED见evidence/red-focused.txt：Expected16 Received0；GREEN见evidence/green.txt。原官方组合选择器优先级覆盖局部padding，现限定选择浮层与树组合，使用原有16px token；未改树内部缩进。
