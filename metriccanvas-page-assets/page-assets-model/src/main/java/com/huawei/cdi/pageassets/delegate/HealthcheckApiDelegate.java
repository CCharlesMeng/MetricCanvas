package com.huawei.cdi.pageassets.delegate;

import com.huawei.cdi.pageassets.model.HealthcheckResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.context.request.NativeWebRequest;

import java.util.Optional;

/**
 * {@link HealthcheckApi} 的 delegate。
 */
public interface HealthcheckApiDelegate {

    default Optional<NativeWebRequest> getRequest() {
        return Optional.empty();
    }

    /**
     * @see HealthcheckApi#healthcheck
     */
    default ResponseEntity<HealthcheckResponse> healthcheck() {
        return new ResponseEntity<>(HttpStatus.NOT_IMPLEMENTED);
    }
}
