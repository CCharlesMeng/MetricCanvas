package com.huawei.cdi.pageassets.delegate;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

import java.util.Optional;

/**
 * basePath 的唯一注入点：`pageassets.base-path` 缺省为 YAML 的 basePath，独立部署与并入宿主只改这一项配置。
 */
@Controller
@RequestMapping("${pageassets.base-path:/rest/cdi/pageassets/v1}")
public class PagesApiController implements PagesApi {
    private final PagesApiDelegate delegate;

    public PagesApiController(@Autowired(required = false) PagesApiDelegate delegate) {
        this.delegate = Optional.ofNullable(delegate).orElse(new PagesApiDelegate() {
        });
    }

    @Override
    public PagesApiDelegate getDelegate() {
        return delegate;
    }
}
