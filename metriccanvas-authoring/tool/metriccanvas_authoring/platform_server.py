"""宿主已发布的导入路径；入口实现在 ``entrypoints.mcp.platform_server``。

`bundle.json` 的 toolServices、Relay 接入文档和 bundle 校验都点名本模块，
因此保留为委托。仓内新代码直接引用 `entrypoints.mcp.platform_server`。
"""
from metriccanvas_authoring.entrypoints.mcp.platform_server import (
    create_platform_server,
    create_production_platform_server,
    main,
)

__all__ = ["create_platform_server", "create_production_platform_server", "main"]


if __name__ == '__main__':
    main()
