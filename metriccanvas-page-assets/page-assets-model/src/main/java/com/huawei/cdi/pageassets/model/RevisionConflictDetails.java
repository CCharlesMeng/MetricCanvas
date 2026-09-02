package com.huawei.cdi.pageassets.model;

import com.fasterxml.jackson.annotation.JsonAutoDetect;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;

import java.util.Objects;

/**
 * RevisionConflictDetails
 */
@JsonAutoDetect(fieldVisibility = JsonAutoDetect.Visibility.ANY,
        getterVisibility = JsonAutoDetect.Visibility.NONE, setterVisibility = JsonAutoDetect.Visibility.NONE)
public class RevisionConflictDetails {
    @JsonProperty("currentLatest")
    private LatestRevisionRef currentLatest = null;

    public RevisionConflictDetails currentLatest(LatestRevisionRef currentLatest) {
        this.currentLatest = currentLatest;
        return this;
    }

    @Valid
    public LatestRevisionRef getCurrentLatest() {
        return currentLatest;
    }

    public void setCurrentLatest(LatestRevisionRef currentLatest) {
        this.currentLatest = currentLatest;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass()) {
            return false;
        }
        RevisionConflictDetails that = (RevisionConflictDetails) o;
        return Objects.equals(this.currentLatest, that.currentLatest);
    }

    @Override
    public int hashCode() {
        return Objects.hash(currentLatest);
    }

    @Override
    public String toString() {
        return "class RevisionConflictDetails {\n"
                + "    currentLatest: " + currentLatest + "\n"
                + "}";
    }
}
