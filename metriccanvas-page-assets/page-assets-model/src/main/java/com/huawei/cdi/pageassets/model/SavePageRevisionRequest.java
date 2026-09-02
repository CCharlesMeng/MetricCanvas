package com.huawei.cdi.pageassets.model;

import com.fasterxml.jackson.annotation.JsonAutoDetect;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.Objects;

/**
 * SavePageRevisionRequest
 */
@JsonAutoDetect(fieldVisibility = JsonAutoDetect.Visibility.ANY,
        getterVisibility = JsonAutoDetect.Visibility.NONE, setterVisibility = JsonAutoDetect.Visibility.NONE)
public class SavePageRevisionRequest {
    @JsonProperty("baseRevisionId")
    private String baseRevisionId = null;

    @JsonProperty("document")
    private Object document = null;

    @JsonProperty("idempotencyKey")
    private String idempotencyKey = null;

    @JsonProperty("pageIdConfirmed")
    private Boolean pageIdConfirmed = false;

    @JsonProperty("source")
    private RevisionSource source = null;

    @JsonProperty("dataContextVersion")
    private String dataContextVersion = null;

    public SavePageRevisionRequest baseRevisionId(String baseRevisionId) {
        this.baseRevisionId = baseRevisionId;
        return this;
    }

    @Pattern(regexp = "^[0-9a-f]{32}$")
    public String getBaseRevisionId() {
        return baseRevisionId;
    }

    public void setBaseRevisionId(String baseRevisionId) {
        this.baseRevisionId = baseRevisionId;
    }

    public SavePageRevisionRequest document(Object document) {
        this.document = document;
        return this;
    }

    @NotNull
    public Object getDocument() {
        return document;
    }

    public void setDocument(Object document) {
        this.document = document;
    }

    public SavePageRevisionRequest idempotencyKey(String idempotencyKey) {
        this.idempotencyKey = idempotencyKey;
        return this;
    }

    @NotNull
    @Size(min = 1, max = 200)
    public String getIdempotencyKey() {
        return idempotencyKey;
    }

    public void setIdempotencyKey(String idempotencyKey) {
        this.idempotencyKey = idempotencyKey;
    }

    public SavePageRevisionRequest pageIdConfirmed(Boolean pageIdConfirmed) {
        this.pageIdConfirmed = pageIdConfirmed;
        return this;
    }

    public Boolean isPageIdConfirmed() {
        return pageIdConfirmed;
    }

    public void setPageIdConfirmed(Boolean pageIdConfirmed) {
        this.pageIdConfirmed = pageIdConfirmed;
    }

    public SavePageRevisionRequest source(RevisionSource source) {
        this.source = source;
        return this;
    }

    @NotNull
    @Valid
    public RevisionSource getSource() {
        return source;
    }

    public void setSource(RevisionSource source) {
        this.source = source;
    }

    public SavePageRevisionRequest dataContextVersion(String dataContextVersion) {
        this.dataContextVersion = dataContextVersion;
        return this;
    }

    @Size(max = 128)
    public String getDataContextVersion() {
        return dataContextVersion;
    }

    public void setDataContextVersion(String dataContextVersion) {
        this.dataContextVersion = dataContextVersion;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass()) {
            return false;
        }
        SavePageRevisionRequest that = (SavePageRevisionRequest) o;
        return Objects.equals(this.baseRevisionId, that.baseRevisionId)
                && Objects.equals(this.document, that.document)
                && Objects.equals(this.idempotencyKey, that.idempotencyKey)
                && Objects.equals(this.pageIdConfirmed, that.pageIdConfirmed)
                && Objects.equals(this.source, that.source)
                && Objects.equals(this.dataContextVersion, that.dataContextVersion);
    }

    @Override
    public int hashCode() {
        return Objects.hash(baseRevisionId, document, idempotencyKey, pageIdConfirmed, source, dataContextVersion);
    }

    @Override
    public String toString() {
        return "class SavePageRevisionRequest {\n"
                + "    baseRevisionId: " + baseRevisionId + "\n"
                + "    document: " + document + "\n"
                + "    idempotencyKey: " + idempotencyKey + "\n"
                + "    pageIdConfirmed: " + pageIdConfirmed + "\n"
                + "    source: " + source + "\n"
                + "    dataContextVersion: " + dataContextVersion + "\n"
                + "}";
    }
}
