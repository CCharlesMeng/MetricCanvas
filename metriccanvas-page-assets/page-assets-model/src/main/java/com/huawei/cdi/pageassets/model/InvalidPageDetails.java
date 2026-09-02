package com.huawei.cdi.pageassets.model;

import com.fasterxml.jackson.annotation.JsonAutoDetect;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * InvalidPageDetails
 */
@JsonAutoDetect(fieldVisibility = JsonAutoDetect.Visibility.ANY,
        getterVisibility = JsonAutoDetect.Visibility.NONE, setterVisibility = JsonAutoDetect.Visibility.NONE)
public class InvalidPageDetails {
    @JsonProperty("errors")
    private List<ValidationError> errors = new ArrayList<>();

    public InvalidPageDetails errors(List<ValidationError> errors) {
        this.errors = errors;
        return this;
    }

    public InvalidPageDetails addErrorsItem(ValidationError errorsItem) {
        this.errors.add(errorsItem);
        return this;
    }

    @NotNull
    @Valid
    public List<ValidationError> getErrors() {
        return errors;
    }

    public void setErrors(List<ValidationError> errors) {
        this.errors = errors;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass()) {
            return false;
        }
        InvalidPageDetails that = (InvalidPageDetails) o;
        return Objects.equals(this.errors, that.errors);
    }

    @Override
    public int hashCode() {
        return Objects.hash(errors);
    }

    @Override
    public String toString() {
        return "class InvalidPageDetails {\n"
                + "    errors: " + errors + "\n"
                + "}";
    }
}
