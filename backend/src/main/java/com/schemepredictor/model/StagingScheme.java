package com.schemepredictor.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.Map;

/**
 * Staged government scheme awaiting administrative review and approval.
 * Data here is completely isolated from citizen-facing recommendations and eligibility checking.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "staging_schemes")
public class StagingScheme {

    @Id
    private String id;

    /** Full proposed Scheme data to be activated upon approval */
    private Scheme proposedData;

    private String sourceSystem;
    private String sourceUrl;
    private String externalId;
    private String dataOrigin;

    /** Change classification: NEW, UPDATE, EXPIRE */
    @Builder.Default
    private String changeType = "NEW";

    /** Review state: PENDING, APPROVED, REJECTED */
    @Indexed
    @Builder.Default
    private String reviewStatus = "PENDING";

    /** Field-level differences between existing live scheme and proposed data */
    private Map<String, Object> changedFields;

    /** If changeType is UPDATE or EXPIRE, ID of the existing live scheme in 'schemes' collection */
    private String existingSchemeId;

    /** SHA-256 fingerprint for change and duplicate detection */
    private String contentHash;

    private Instant createdAt;
    private Instant updatedAt;
    private Instant reviewedAt;
    private String reviewedBy;
    private String rejectionReason;
}
