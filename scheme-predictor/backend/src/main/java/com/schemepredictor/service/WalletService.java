package com.schemepredictor.service;

import com.schemepredictor.exception.BadRequestException;
import com.schemepredictor.exception.ResourceNotFoundException;
import com.schemepredictor.model.DocumentRecord;
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
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.List;
import com.schemepredictor.model.Profile;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class WalletService {

    private final DocumentRepository documentRepository;
    private final RestTemplate restTemplate;
    private final ProfileNormalizationService profileNormalizationService;

    @Value("${app.upload.dir}")
    private String uploadDir;

    @Value("${app.services.ocr-url}")
    private String ocrServiceUrl;

    public List<DocumentRecord> listDocuments(String userId) {
        return documentRepository.findByUserId(userId);
    }

    public DocumentRecord upload(String userId, String documentType, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("No file provided");
        }

        try {
            Path dir = Paths.get(uploadDir, userId);
            Files.createDirectories(dir);

            String storedName = UUID.randomUUID() + "_" + file.getOriginalFilename();
            Path target = dir.resolve(storedName);
            file.transferTo(target);

            DocumentRecord record = DocumentRecord.builder()
                    .userId(userId)
                    .documentType(documentType)
                    .fileName(file.getOriginalFilename())
                    .storagePath(target.toString())
                    .verificationStatus("PENDING")
                    .uploadedAt(Instant.now())
                    .updatedAt(Instant.now())
                    .build();

            record = documentRepository.save(record);

            // Best-effort OCR extraction. If the OCR service is unreachable, the
            // document still gets stored and the user can enter/verify fields manually —
            // we never block the citizen's flow on the AI service being up.
            try {
                Map<String, String> extracted = runOcr(target, documentType);
                record.setExtractedFields(extracted);
                record.setVerificationStatus("OCR_EXTRACTED");
                record.setUpdatedAt(Instant.now());
                documentRepository.save(record);
            } catch (Exception ocrEx) {
                log.warn("OCR extraction unavailable for document {}: {}", record.getId(), ocrEx.getMessage());
            }

            return record;
        } catch (IOException e) {
            throw new BadRequestException("Failed to store uploaded file: " + e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, String> runOcr(Path filePath, String documentType) {
        String url = ocrServiceUrl + "/extract";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("file", new org.springframework.core.io.FileSystemResource(filePath.toFile()));
        body.add("documentType", documentType);

        HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);
        Map<String, Object> response = restTemplate.postForObject(url, requestEntity, Map.class);

        if (response == null || !response.containsKey("fields")) {
            return Map.of();
        }
        return (Map<String, String>) response.get("fields");
    }

    /** The citizen reviews/corrects OCR output here before it becomes trusted profile data. */
    public DocumentRecord verifyFields(String userId, String documentId, Map<String, String> verifiedFields) {
        DocumentRecord record = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found"));

        if (!record.getUserId().equals(userId)) {
            throw new ResourceNotFoundException("Document not found");
        }

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

    public Profile syncWallet(String userId) {
        return profileNormalizationService.syncAllVerifiedDocuments(userId);
    }

    public void delete(String userId, String documentId) {
        DocumentRecord record = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found"));

        if (!record.getUserId().equals(userId)) {
            throw new ResourceNotFoundException("Document not found");
        }

        try {
            Files.deleteIfExists(Paths.get(record.getStoragePath()));
        } catch (IOException e) {
            log.warn("Could not delete file from disk: {}", e.getMessage());
        }

        documentRepository.deleteById(documentId);
    }
}
