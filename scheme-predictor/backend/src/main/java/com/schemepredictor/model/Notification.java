package com.schemepredictor.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "notifications")
public class Notification {
    @Id
    private String id;
    private String userId;

    /** NEW_SCHEME / DEADLINE_APPROACHING / SCHEME_UPDATED / RECOMMENDATION */
    private String type;

    private String message;
    private String relatedSchemeId;

    @Builder.Default
    private boolean read = false;

    private Instant createdAt;
}
