# 底图 geojson 静态资产

由 `tools/scripts/prepare-geo.mjs` 从 Natural Earth 数据制备(JSON 无法内嵌注释,来源与许可记录于此):

| 文件 | 来源 | 许可 |
|---|---|---|
| `china.json` | Natural Earth 1:50m admin-1 states/provinces 中国子集,区域名取 `name_zh` | 公有领域([NE Terms of Use](https://www.naturalearthdata.com/about/terms-of-use/)) |
| `world.json` | Natural Earth 1:110m admin-0 countries,区域名取英文 `NAME` | 公有领域(同上) |

精简处理:坐标舍入到 2 位小数并去重;properties 只保留 `name` 与 `cp`(区域中心点,
散点叠加的坐标来源,取 NE 标注点、缺失时按最大环形心计算)。

**边界口径风险(已知,勿删)**:Natural Earth 按其自身口径绘制边界(台湾在 admin-0 中单列、
中国省级子集不含港澳台),与中国官方地图表述有差异;开发演示用途可接受,
正式对外发布前需替换为具审图号的合规数据源。

重新生成:

```bash
curl -sSLO https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_1_states_provinces.geojson
curl -sSLO https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson
node tools/scripts/prepare-geo.mjs ne_50m_admin_1_states_provinces.geojson ne_110m_admin_0_countries.geojson
```
