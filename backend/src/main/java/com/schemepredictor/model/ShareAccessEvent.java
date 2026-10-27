package com.schemepredictor.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/** Audit record of an access attempt. Deliberately holds no document content, token or raw IP. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "share_access_events")
public class ShareAccessEvent {

    public static final String VIEWED = "VIEWED";
    public static final String DOWNLOADED = "DOWNLOADED";
    public static final String DENIED_EXPIRED = "DENIED_EXPIRED";
    public static final String DENIED_REVOKED = "DENIED_REVOKED";
    public static final String DENIED_PERMISSION = "DENIED_PERMISSION";

    @Id
    private String id;

    @Indexed
    private String shareId;

    private String outcome;
    private Instant at;
}
