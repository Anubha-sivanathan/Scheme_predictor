package com.schemepredictor.dto;

import com.schemepredictor.model.ShareLink;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
public class ShareResponse {
    private String id;
    private String documentId;
    private String permission;
    private Instant createdAt;
    private Instant expiresAt;
    private Instant revokedAt;

    /** Only populated in the response that creates the link; it cannot be recovered afterwards. */
    private String token;

    public static ShareResponse of(ShareLink link, String token) {
        return ShareResponse.builder()
                .id(link.getId())
                .documentId(link.getDocumentId())
                .permission(link.getPermission())
                .createdAt(link.getCreatedAt())
                .expiresAt(link.getExpiresAt())
                .revokedAt(link.getRevokedAt())
                .token(token)
                .build();
    }
}
