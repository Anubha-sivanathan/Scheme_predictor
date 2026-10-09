package com.schemepredictor.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.Map;

/**
 * A wallet document uploaded by a citizen (Aadhaar, income certificate, etc).
 * Named DocumentRecord to avoid clashing with org.springframework.data.mongodb.core.mapping.Document.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "documents")
public class DocumentRecord {

    @Id
    private String id;

    private String userId;

    /** e.g. AADHAAR, INCOME_CERTIFICATE, CASTE_CERTIFICATE, RESIDENCE_CERTIFICATE, EDUCATION, LAND, DISABILITY, OTHER */
    private String documentType;

    private String fileName;
    private String storagePath;

    @Builder.Default
    private String verificationStatus = "PENDING"; // PENDING / OCR_EXTRACTED / VERIFIED / REJECTED

    /** Raw fields extracted by OCR, before the user reviews/corrects them. */
    private Map<String, String> extractedFields;

    /** Fields the user has confirmed/corrected — these are what the profile trusts. */
    private Map<String, String> verifiedFields;

    private Instant uploadedAt;
    private Instant updatedAt;
}
