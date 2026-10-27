package com.schemepredictor.dto;

import lombok.Data;

@Data
public class ShareCreateRequest {
    /** VIEW (default) or DOWNLOAD. */
    private String permission;
    /** 1..168; defaults to 24. */
    private Integer expiresInHours;
    /** Must be true for sensitive document types. */
    private boolean acknowledgeRisk;
}
