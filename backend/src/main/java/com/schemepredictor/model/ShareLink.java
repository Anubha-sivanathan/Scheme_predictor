package com.schemepredictor.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * A revocable, expiring link to one wallet document. The raw token is shown to the owner exactly once
 * at creation; only its SHA-256 hash is persisted.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "share_links")
public class ShareLink {

    public static final String VIEW = "VIEW";
    public static final String DOWNLOAD = "DOWNLOAD";

    @Id
    private String id;

    @Indexed
    private String documentId;

    @Indexed
    private String ownerId;

    @Indexed(unique = true)
    private String tokenHash;

    /** VIEW = inline only, DOWNLOAD = may be saved as a file. */
    private String permission;

    private Instant createdAt;
    private Instant expiresAt;
    private Instant revokedAt;
}
