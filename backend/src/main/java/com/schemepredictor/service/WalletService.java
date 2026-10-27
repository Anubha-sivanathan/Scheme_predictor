package com.schemepredictor.service;

import com.schemepredictor.exception.BadRequestException;
import com.schemepredictor.exception.ResourceNotFoundException;
import com.schemepredictor.model.DocumentRecord;
import com.schemepredictor.model.DocumentVersion;
import com.schemepredictor.repository.DocumentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import com.schemepredictor.model.Profile;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class WalletService {

    /** Older versions beyond this count are dropped (and their files deleted). */
    public static final int MAX_VERSIONS = 10;

    private final DocumentRepository documentRepository;
    private final RestTemplate restTemplate;
    private final ProfileNormalizationService profileNormalizationService;
    private final FileValidationService fileValidation;
    private final ShareService shareService;

    @Value("${app.upload.dir}")
    private String uploadDir;

    @Value("${app.services.ocr-url}")
    private String ocrServiceUrl;

    public List<DocumentRecord> listDocuments(String userId) {
        return documentRepository.findByUserId(userId);
    }

    public DocumentRecord getDocument(String userId, String documentId) {
        DocumentRecord record = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found"));
        if (!userId.equals(record.getUserId())) {
            throw new ResourceNotFoundException("Document not found");
        }
        return record;
    }

    public DocumentRecord upload(String userId, String documentType, MultipartFile file) {
        String type = fileValidation.validateDocumentType(documentType);
        FileValidationService.ValidatedFile valid = fileValidation.validate(file);

        DocumentVersion version = storeVersion(userId, file, valid, 1);

        DocumentRecord record = DocumentRecord.builder()
                .userId(userId)
                .documentType(type)
                .fileName(valid.safeName())
                .storagePath(version.getStoragePath())
                .contentType(valid.contentType())
                .currentVersion(1)
                .versions(new ArrayList<>(List.of(version)))
                .verificationStatus("PENDING")
                .uploadedAt(Instant.now())
                .updatedAt(Instant.now())
                .build();

        record = documentRepository.save(record);
        return runOcrBestEffort(record);
    }

    /** Adds a new file revision to an existing document. Earlier revisions stay available for restore. */
    public DocumentRecord addVersion(String userId, String documentId, MultipartFile file) {
        DocumentRecord record = getDocument(userId, documentId);
        FileValidationService.ValidatedFile valid = fileValidation.validate(file);

        DocumentVersion version = storeVersion(userId, file, valid, nextVersionNumber(record));
        return applyNewVersion(record, version);
    }

    public List<DocumentVersion> listVersions(String userId, String documentId) {
        return effectiveVersions(getDocument(userId, documentId));
    }

    /** Restoring never rewrites history: the chosen revision is copied forward as a new latest version. */
    public DocumentRecord restoreVersion(String userId, String documentId, int versionNumber) {
        DocumentRecord record = getDocument(userId, documentId);
        DocumentVersion source = effectiveVersions(record).stream()
                .filter(v -> v.getVersionNumber() == versionNumber)
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Version not found"));

        int next = nextVersionNumber(record);
        try {
            Path src = resolveInsideUploads(source.getStoragePath());
            Path dir = userDir(userId);
            Files.createDirectories(dir);
            Path target = dir.resolve(UUID.randomUUID() + extensionOf(source.getStoragePath()));
            Files.copy(src, target, StandardCopyOption.REPLACE_EXISTING);

            DocumentVersion restored = DocumentVersion.builder()
                    .versionNumber(next)
                    .fileName(source.getFileName())
                    .storagePath(target.toString())
                    .contentType(source.getContentType())
                    .sizeBytes(source.getSizeBytes())
                    .sha256(source.getSha256())
                    .uploadedAt(Instant.now())
                    .build();
            return applyNewVersion(record, restored);
        } catch (IOException e) {
            throw new BadRequestException("Could not restore this version");
        }
    }

    /** The newest version's file, for owners and for share links. */
    public DocumentVersion currentVersion(DocumentRecord record) {
        List<DocumentVersion> versions = effectiveVersions(record);
        return versions.get(versions.size() - 1);
    }

    public Path fileOf(DocumentVersion version) {
        Path path = resolveInsideUploads(version.getStoragePath());
        if (!Files.isRegularFile(path)) {
            throw new ResourceNotFoundException("File not found");
        }
        return path;
    }

    /** Legacy documents (pre-versioning) are presented as a single version 1. */
    public List<DocumentVersion> effectiveVersions(DocumentRecord record) {
        if (record.getVersions() != null && !record.getVersions().isEmpty()) {
            return record.getVersions();
        }
        return List.of(DocumentVersion.builder()
                .versionNumber(1)
                .fileName(record.getFileName())
                .storagePath(record.getStoragePath())
                .contentType(record.getContentType())
                .uploadedAt(record.getUploadedAt())
                .build());
    }

    private int nextVersionNumber(DocumentRecord record) {
        return effectiveVersions(record).stream().mapToInt(DocumentVersion::getVersionNumber).max().orElse(0) + 1;
    }

    private DocumentRecord applyNewVersion(DocumentRecord record, DocumentVersion version) {
        List<DocumentVersion> versions = new ArrayList<>(effectiveVersions(record));
        versions.add(version);
        while (versions.size() > MAX_VERSIONS) {
            deleteFileQuietly(versions.remove(0).getStoragePath());
        }

        record.setVersions(versions);
        record.setCurrentVersion(version.getVersionNumber());
        record.setFileName(version.getFileName());
        record.setStoragePath(version.getStoragePath());
        record.setContentType(version.getContentType());
        // The file changed, so anything read from or confirmed against the old file is stale.
        record.setExtractedFields(null);
        record.setVerifiedFields(null);
        record.setVerificationStatus("PENDING");
        record.setUpdatedAt(Instant.now());
        record = documentRepository.save(record);
        return runOcrBestEffort(record);
    }

    private DocumentVersion storeVersion(String userId, MultipartFile file,
                                         FileValidationService.ValidatedFile valid, int versionNumber) {
        try {
            Path dir = userDir(userId);
            Files.createDirectories(dir);
            // Stored name never includes user-supplied text beyond the validated extension.
            Path target = dir.resolve(UUID.randomUUID() + "." + valid.extension());

            MessageDigest sha = MessageDigest.getInstance("SHA-256");
            try (InputStream in = new DigestInputStream(file.getInputStream(), sha)) {
                Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
            }
            return DocumentVersion.builder()
                    .versionNumber(versionNumber)
                    .fileName(valid.safeName())
                    .storagePath(target.toString())
                    .contentType(valid.contentType())
                    .sizeBytes(Files.size(target))
                    .sha256(HexFormat.of().formatHex(sha.digest()))
                    .uploadedAt(Instant.now())
                    .build();
        } catch (IOException | java.security.NoSuchAlgorithmException e) {
            throw new BadRequestException("Failed to store uploaded file");
        }
    }

    /**
     * OCR is best-effort: the document is always stored, and the status tells the user what happened.
     * OCR_EXTRACTED = fields found (review them); OCR_EMPTY = service answered but found nothing;
     * OCR_FAILED = service unreachable or errored. In the last two the citizen can still enter details
     * manually. (OCR is English-script only; Tamil/Hindi documents are not supported.)
     * Only counts and the exception type are logged: extracted values are personal data.
     */
    private DocumentRecord runOcrBestEffort(DocumentRecord record) {
        try {
            Map<String, String> extracted = runOcr(Paths.get(record.getStoragePath()), record.getDocumentType());
            record.setExtractedFields(extracted);
            record.setVerificationStatus(extracted.isEmpty() ? "OCR_EMPTY" : "OCR_EXTRACTED");
            log.info("OCR for document {} ({}) returned {} field(s)",
                    record.getId(), record.getDocumentType(), extracted.size());
        } catch (Exception ocrEx) {
            record.setExtractedFields(null);
            record.setVerificationStatus("OCR_FAILED");
            log.warn("OCR extraction unavailable for document {}: {}", record.getId(), ocrEx.getClass().getSimpleName());
        }
        record.setUpdatedAt(Instant.now());
        return documentRepository.save(record);
    }

    private Map<String, String> runOcr(Path filePath, String documentType) {
        String url = ocrServiceUrl + "/extract";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("file", new org.springframework.core.io.FileSystemResource(filePath.toFile()));
        body.add("documentType", documentType);

        HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);
        Map<?, ?> response = restTemplate.postForObject(url, requestEntity, Map.class);

        return toFieldMap(response == null ? null : response.get("fields"));
    }

    /** Keeps every non-blank field Flask returned (values coerced to trimmed strings); ignores anything else. */
    static Map<String, String> toFieldMap(Object fields) {
        Map<String, String> out = new LinkedHashMap<>();
        if (fields instanceof Map<?, ?> raw) {
            raw.forEach((k, v) -> {
                if (k != null && v != null && !String.valueOf(v).trim().isEmpty()) {
                    out.put(String.valueOf(k), String.valueOf(v).trim());
                }
            });
        }
        return out;
    }

    /** The citizen reviews/corrects OCR output here before it becomes trusted profile data. */
    public DocumentRecord verifyFields(String userId, String documentId, Map<String, String> verifiedFields) {
        DocumentRecord record = getDocument(userId, documentId);

        record.setVerifiedFields(verifiedFields);
        record.setVerificationStatus("VERIFIED");
        record.setUpdatedAt(Instant.now());
        record = documentRepository.save(record);

        // Sync verified document into the unified profile (Unified Data Wallet)
        try {
            profileNormalizationService.syncVerifiedDocumentToProfile(userId, record);
        } catch (Exception e) {
            log.error("Failed to sync verified document to profile for user {}: {}", userId, e.getMessage());
        }

        return record;
    }

    /** Profile values that a verified document disagrees with; nothing is changed by asking. */
    public List<ProfileNormalizationService.Conflict> profileConflicts(String userId, String documentId) {
        DocumentRecord record = getDocument(userId, documentId);
        return profileNormalizationService.findConflicts(userId, record);
    }

    /** Overwrites only the profile fields the citizen explicitly accepted. */
    public Profile applyProfileChanges(String userId, String documentId, Set<String> acceptedFields) {
        DocumentRecord record = getDocument(userId, documentId);
        if (!"VERIFIED".equalsIgnoreCase(record.getVerificationStatus())) {
            throw new BadRequestException("Confirm the document details before updating your profile");
        }
        return profileNormalizationService.applyAcceptedChanges(userId, record, acceptedFields);
    }

    public Profile syncWallet(String userId) {
        return profileNormalizationService.syncAllVerifiedDocuments(userId);
    }

    public void delete(String userId, String documentId) {
        DocumentRecord record = getDocument(userId, documentId);

        shareService.deleteAllForDocument(documentId);
        for (DocumentVersion v : effectiveVersions(record)) {
            deleteFileQuietly(v.getStoragePath());
        }
        documentRepository.deleteById(documentId);
    }

    private Path userDir(String userId) {
        return Paths.get(uploadDir, userId).toAbsolutePath().normalize();
    }

    /** Refuses any stored path that resolves outside the upload directory. */
    private Path resolveInsideUploads(String storagePath) {
        Path root = Paths.get(uploadDir).toAbsolutePath().normalize();
        Path path = Paths.get(storagePath).toAbsolutePath().normalize();
        if (!path.startsWith(root)) {
            throw new ResourceNotFoundException("File not found");
        }
        return path;
    }

    private void deleteFileQuietly(String storagePath) {
        try {
            Files.deleteIfExists(resolveInsideUploads(storagePath));
        } catch (IOException | RuntimeException e) {
            log.warn("Could not delete file from disk: {}", e.getMessage());
        }
    }

    private static String extensionOf(String fileName) {
        int dot = fileName == null ? -1 : fileName.lastIndexOf('.');
        return dot < 0 ? "" : fileName.substring(dot).toLowerCase();
    }
}
