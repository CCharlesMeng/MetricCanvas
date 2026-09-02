package com.huawei.cdi.pageassets.model;

import com.fasterxml.jackson.annotation.JsonAutoDetect;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonValue;
import jakarta.validation.constraints.NotNull;

import java.util.Objects;

/**
 * ErrorResponse
 */
@JsonAutoDetect(fieldVisibility = JsonAutoDetect.Visibility.ANY,
        getterVisibility = JsonAutoDetect.Visibility.NONE, setterVisibility = JsonAutoDetect.Visibility.NONE)
public class ErrorResponse {
    /**
     * 业务闭集来自 ADR-0062；`INVALID_REQUEST` 与 `INTERNAL_ERROR` 为传输层码。
     */
    public enum CodeEnum {
        INVALID_PAGE("INVALID_PAGE"),
        PAGE_ID_MISMATCH("PAGE_ID_MISMATCH"),
        PAGE_ID_CONFIRMATION_REQUIRED("PAGE_ID_CONFIRMATION_REQUIRED"),
        PAGE_NOT_FOUND("PAGE_NOT_FOUND"),
        REVISION_NOT_FOUND("REVISION_NOT_FOUND"),
        REVISION_CONFLICT("REVISION_CONFLICT"),
        IDEMPOTENCY_CONFLICT("IDEMPOTENCY_CONFLICT"),
        NOT_SUPPORTED("NOT_SUPPORTED"),
        INVALID_REQUEST("INVALID_REQUEST"),
        INTERNAL_ERROR("INTERNAL_ERROR");

        private final String value;

        CodeEnum(String value) {
            this.value = value;
        }

        @Override
        @JsonValue
        public String toString() {
            return String.valueOf(value);
        }

        @JsonCreator
        public static CodeEnum fromValue(String text) {
            for (CodeEnum b : CodeEnum.values()) {
                if (String.valueOf(b.value).equals(text)) {
                    return b;
                }
            }
            return null;
        }
    }

    @JsonProperty("code")
    private CodeEnum code = null;

    @JsonProperty("message")
    private String message = null;

    @JsonProperty("details")
    private Object details = null;

    public ErrorResponse code(CodeEnum code) {
        this.code = code;
        return this;
    }

    @NotNull
    public CodeEnum getCode() {
        return code;
    }

    public void setCode(CodeEnum code) {
        this.code = code;
    }

    public ErrorResponse message(String message) {
        this.message = message;
        return this;
    }

    @NotNull
    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public ErrorResponse details(Object details) {
        this.details = details;
        return this;
    }

    public Object getDetails() {
        return details;
    }

    public void setDetails(Object details) {
        this.details = details;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass()) {
            return false;
        }
        ErrorResponse that = (ErrorResponse) o;
        return Objects.equals(this.code, that.code)
                && Objects.equals(this.message, that.message)
                && Objects.equals(this.details, that.details);
    }

    @Override
    public int hashCode() {
        return Objects.hash(code, message, details);
    }

    @Override
    public String toString() {
        return "class ErrorResponse {\n"
                + "    code: " + code + "\n"
                + "    message: " + message + "\n"
                + "    details: " + details + "\n"
                + "}";
    }
}
