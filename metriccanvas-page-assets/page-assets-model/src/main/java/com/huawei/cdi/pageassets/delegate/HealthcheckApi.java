package com.huawei.cdi.pageassets.delegate;

import com.huawei.cdi.pageassets.model.HealthcheckResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;

/**
 * 由 rest-services-page-assets.yaml 的 `healthcheck` tag 对应的 API 接口。
 */
@Validated
public interface HealthcheckApi {

    default HealthcheckApiDelegate getDelegate() {
        return new HealthcheckApiDelegate() {
        };
    }

    @RequestMapping(value = "/healthcheck",
            produces = {"application/json"},
            method = RequestMethod.GET)
    default ResponseEntity<HealthcheckResponse> healthcheck() {
        return getDelegate().healthcheck();
    }
}
