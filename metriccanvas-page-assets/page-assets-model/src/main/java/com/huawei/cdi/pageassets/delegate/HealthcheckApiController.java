package com.huawei.cdi.pageassets.delegate;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

import java.util.Optional;

@Controller
@RequestMapping("${pageassets.base-path:/rest/cdi/pageassets/v1}")
public class HealthcheckApiController implements HealthcheckApi {
    private final HealthcheckApiDelegate delegate;

    public HealthcheckApiController(@Autowired(required = false) HealthcheckApiDelegate delegate) {
        this.delegate = Optional.ofNullable(delegate).orElse(new HealthcheckApiDelegate() {
        });
    }

    @Override
    public HealthcheckApiDelegate getDelegate() {
        return delegate;
    }
}
