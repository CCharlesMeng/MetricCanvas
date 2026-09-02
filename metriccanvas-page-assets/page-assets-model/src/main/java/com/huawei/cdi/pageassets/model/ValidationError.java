package com.huawei.cdi.pageassets.model;

import com.fasterxml.jackson.annotation.JsonAutoDetect;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotNull;

import java.util.Objects;

/**
 * 契约 contracts/metriccanvas/page/error-types.json 定义的 `type/path/message`。
 */
@JsonAutoDetect(fieldVisibility = JsonAutoDetect.Visibility.ANY,
        getterVisibility = JsonAutoDetect.Visibility.NONE, setterVisibility = JsonAutoDetect.Visibility.NONE)
public class ValidationError {
    @JsonProperty("type")
    private String type = null;

    @JsonProperty("path")
    private String path = null;

    @JsonProperty("message")
    private String message = null;

    public ValidationError type(String type) {
        this.type = type;
        return this;
    }

    @NotNull
    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public ValidationError path(String path) {
        this.path = path;
        return this;
    }

    @NotNull
    public String getPath() {
        return path;
    }

    public void setPath(String path) {
        this.path = path;
    }

    public ValidationError message(String message) {
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

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass()) {
            return false;
        }
        ValidationError that = (ValidationError) o;
        return Objects.equals(this.type, that.type)
                && Objects.equals(this.path, that.path)
                && Objects.equals(this.message, that.message);
    }

    @Override
    public int hashCode() {
        return Objects.hash(type, path, message);
    }

    @Override
    public String toString() {
        return "class ValidationError {\n"
                + "    type: " + type + "\n"
                + "    path: " + path + "\n"
                + "    message: " + message + "\n"
                + "}";
    }
}
