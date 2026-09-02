package com.huawei.cdi.pageassets.adapter.inbound.rest;

import com.huawei.cdi.pageassets.domain.error.ErrorCode;
import com.huawei.cdi.pageassets.domain.error.PageAssetException;
import com.huawei.cdi.pageassets.model.ErrorResponse;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

import java.util.Objects;

/**
 * 错误信封（ADR-0062）：HTTP 状态语义 + `{ code, message, details }`。业务闭集来自领域异常；
 * Spring MVC 自己抛出的绑定 / 校验 / 路由错误统一为传输层码 `INVALID_REQUEST`（4xx）或 `INTERNAL_ERROR`（5xx）。
 * 有意与公司现有服务的两套信封不同，见 ADR-0062「错误闭集与信封」。
 */
@RestControllerAdvice
public final class RestErrorHandler extends ResponseEntityExceptionHandler {
    private static final Logger LOG = LoggerFactory.getLogger(RestErrorHandler.class);

    private final RestModelMapper mapper;

    public RestErrorHandler(RestModelMapper mapper) {
        this.mapper = Objects.requireNonNull(mapper, "mapper");
    }

    @ExceptionHandler(PageAssetException.class)
    public ResponseEntity<ErrorResponse> handlePageAsset(PageAssetException exception) {
        ErrorResponse body = new ErrorResponse()
                .code(ErrorResponse.CodeEnum.fromValue(exception.code().name()))
                .message(exception.getMessage())
                .details(exception.details().map(mapper::toModel).orElse(null));
        return envelope(statusOf(exception.code()), body);
    }

    @ExceptionHandler({InvalidRequestException.class, ConstraintViolationException.class})
    public ResponseEntity<ErrorResponse> handleInvalidRequest(RuntimeException exception) {
        return envelope(HttpStatus.BAD_REQUEST, transport(HttpStatus.BAD_REQUEST, exception.getMessage()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnexpected(Exception exception) {
        LOG.error("unexpected failure", exception);
        return envelope(HttpStatus.INTERNAL_SERVER_ERROR,
                transport(HttpStatus.INTERNAL_SERVER_ERROR, "服务内部错误"));
    }

    /** Spring MVC 的绑定、校验、路由与协商错误都经这里进入同一信封。 */
    @Override
    protected ResponseEntity<Object> handleExceptionInternal(Exception exception, Object body, HttpHeaders headers,
                                                             HttpStatusCode statusCode, WebRequest request) {
        HttpStatus status = HttpStatus.resolve(statusCode.value());
        if (status == null) {
            status = HttpStatus.INTERNAL_SERVER_ERROR;
        }
        String message = status.is5xxServerError() ? "服务内部错误" : requestProblem(exception);
        return ResponseEntity.status(status).contentType(MediaType.APPLICATION_JSON)
                .body(transport(status, message));
    }

    static HttpStatus statusOf(ErrorCode code) {
        return switch (code) {
            case INVALID_PAGE, PAGE_ID_MISMATCH -> HttpStatus.UNPROCESSABLE_ENTITY;
            case PAGE_ID_CONFIRMATION_REQUIRED, REVISION_CONFLICT, IDEMPOTENCY_CONFLICT -> HttpStatus.CONFLICT;
            case PAGE_NOT_FOUND, REVISION_NOT_FOUND -> HttpStatus.NOT_FOUND;
            case NOT_SUPPORTED -> HttpStatus.NOT_IMPLEMENTED;
        };
    }

    private static ErrorResponse transport(HttpStatus status, String message) {
        return new ErrorResponse()
                .code(status.is5xxServerError() ? ErrorResponse.CodeEnum.INTERNAL_ERROR
                        : ErrorResponse.CodeEnum.INVALID_REQUEST)
                .message(message)
                .details(null);
    }

    private static String requestProblem(Exception exception) {
        if (exception instanceof org.springframework.web.ErrorResponse response) {
            String detail = response.getBody().getDetail();
            if (detail != null && !detail.isBlank()) {
                return detail;
            }
        }
        String message = exception.getMessage();
        return message == null || message.isBlank() ? "请求不合法" : message;
    }

    private static ResponseEntity<ErrorResponse> envelope(HttpStatus status, ErrorResponse body) {
        return ResponseEntity.status(status).contentType(MediaType.APPLICATION_JSON).body(body);
    }
}
