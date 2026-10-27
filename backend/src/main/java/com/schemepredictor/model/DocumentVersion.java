package com.schemepredictor.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/** One stored file revision of a wallet document. The newest version is the one served and shared. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DocumentVersion {
    private int versionNumber;
    private String fileName;
    private String storagePath;
    private String contentType;
    private long sizeBytes;
    private String sha256;
    private Instant uploadedAt;
}
