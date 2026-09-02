package com.huawei.cdi.pageassets.model;

import com.fasterxml.jackson.annotation.JsonAutoDetect;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import java.time.OffsetDateTime;
import java.util.Objects;

/**
 * PageRevision
 */
@JsonAutoDetect(fieldVisibility = JsonAutoDetect.Visibility.ANY,
        getterVisibility = JsonAutoDetect.Visibility.NONE, setterVisibility = JsonAutoDetect.Visibility.NONE)
public class PageRevision {
    @JsonProperty("revisionId")
    private String revisionId = null;

    @JsonProperty("revisionNumber")
    private Long revisionNumber = null;

    @JsonProperty("pageId")
    private String pageId = null;

    @JsonProperty("baseRevisionId")
    private String baseRevisionId = null;

    @JsonProperty("document")
    private Object document = null;

    @JsonProperty("contentHash")
    private String contentHash = null;

    @JsonProperty("dataContextVersion")
    private String dataContextVersion = null;

    @JsonProperty("source")
    private RevisionSource source = null;

    @JsonProperty("createdBy")
    private String createdBy = null;

    @JsonProperty("createdAt")
    private OffsetDateTime createdAt = null;

    public PageRevision revisionId(String revisionId) {
        this.revisionId = revisionId;
        return this;
    }

    @NotNull
    public String getRevisionId() {
        return revisionId;
    }

    public void setRevisionId(String revisionId) {
        this.revisionId = revisionId;
    }

    public PageRevision revisionNumber(Long revisionNumber) {
        this.revisionNumber = revisionNumber;
        return this;
    }

    @NotNull
    public Long getRevisionNumber() {
        return revisionNumber;
    }

    public void setRevisionNumber(Long revisionNumber) {
        this.revisionNumber = revisionNumber;
    }

    public PageRevision pageId(String pageId) {
        this.pageId = pageId;
        return this;
    }

    @NotNull
    public String getPageId() {
        return pageId;
    }

    public void setPageId(String pageId) {
        this.pageId = pageId;
    }

    public PageRevision baseRevisionId(String baseRevisionId) {
        this.baseRevisionId = baseRevisionId;
        return this;
    }

    public String getBaseRevisionId() {
        return baseRevisionId;
    }

    public void setBaseRevisionId(String baseRevisionId) {
        this.baseRevisionId = baseRevisionId;
    }

    public PageRevision document(Object document) {
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

    public PageRevision contentHash(String contentHash) {
        this.contentHash = contentHash;
        return this;
    }

    @NotNull
    public String getContentHash() {
        return contentHash;
    }

    public void setContentHash(String contentHash) {
        this.contentHash = contentHash;
    }

    public PageRevision dataContextVersion(String dataContextVersion) {
        this.dataContextVersion = dataContextVersion;
        return this;
    }

    public String getDataContextVersion() {
        return dataContextVersion;
    }

    public void setDataContextVersion(String dataContextVersion) {
        this.dataContextVersion = dataContextVersion;
    }

    public PageRevision source(RevisionSource source) {
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

    public PageRevision createdBy(String createdBy) {
        this.createdBy = createdBy;
        return this;
    }

    @NotNull
    public String getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(String createdBy) {
        this.createdBy = createdBy;
    }

    public PageRevision createdAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
        return this;
    }

    @NotNull
    @Valid
    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass()) {
            return false;
        }
        PageRevision that = (PageRevision) o;
        return Objects.equals(this.revisionId, that.revisionId)
                && Objects.equals(this.revisionNumber, that.revisionNumber)
                && Objects.equals(this.pageId, that.pageId)
                && Objects.equals(this.baseRevisionId, that.baseRevisionId)
                && Objects.equals(this.document, that.document)
                && Objects.equals(this.contentHash, that.contentHash)
                && Objects.equals(this.dataContextVersion, that.dataContextVersion)
                && Objects.equals(this.source, that.source)
                && Objects.equals(this.createdBy, that.createdBy)
                && Objects.equals(this.createdAt, that.createdAt);
    }

    @Override
    public int hashCode() {
        return Objects.hash(revisionId, revisionNumber, pageId, baseRevisionId, document, contentHash,
                dataContextVersion, source, createdBy, createdAt);
    }

    @Override
    public String toString() {
        return "class PageRevision {\n"
                + "    revisionId: " + revisionId + "\n"
                + "    revisionNumber: " + revisionNumber + "\n"
                + "    pageId: " + pageId + "\n"
                + "    baseRevisionId: " + baseRevisionId + "\n"
                + "    document: " + document + "\n"
                + "    contentHash: " + contentHash + "\n"
                + "    dataContextVersion: " + dataContextVersion + "\n"
                + "    source: " + source + "\n"
                + "    createdBy: " + createdBy + "\n"
                + "    createdAt: " + createdAt + "\n"
                + "}";
    }
}
