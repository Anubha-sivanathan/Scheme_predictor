package com.schemepredictor.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.schemepredictor.dto.ImportSummaryDto;
import com.schemepredictor.dto.RejectStagingRequest;
import com.schemepredictor.exception.BadRequestException;
import com.schemepredictor.exception.ResourceNotFoundException;
import com.schemepredictor.model.Scheme;
import com.schemepredictor.model.StagingScheme;
import com.schemepredictor.repository.SchemeRepository;
import com.schemepredictor.repository.StagingSchemeRepository;
import com.schemepredictor.util.CsvParserUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class StagingSchemeService {

    private final StagingSchemeRepository stagingSchemeRepository;
    private final SchemeRepository schemeRepository;
    private final ObjectMapper objectMapper;

    public static final Set<String> SUPPORTED_CATEGORIES = Set.of(
            "Education",
            "Agriculture",
            "Healthcare",
            "Housing",
            "Employment",
            "Women & Child Welfare",
            "Financial Assistance",
            "Disability Support",
            "Senior Citizens"
    );

    private static final Map<String, String> CANONICAL_CATEGORY_MAP = new HashMap<>();

    static {
        for (String cat : SUPPORTED_CATEGORIES) {
            CANONICAL_CATEGORY_MAP.put(cat.toLowerCase(), cat);
        }
        CANONICAL_CATEGORY_MAP.put("women and child welfare", "Women & Child Welfare");
        CANONICAL_CATEGORY_MAP.put("women and child", "Women & Child Welfare");
        CANONICAL_CATEGORY_MAP.put("women & child", "Women & Child Welfare");
        CANONICAL_CATEGORY_MAP.put("social welfare", "Financial Assistance");
        CANONICAL_CATEGORY_MAP.put("disability", "Disability Support");
    }

    public List<StagingScheme> listStagingSchemes(String status) {
        if (status == null || status.isBlank() || "ALL".equalsIgnoreCase(status)) {
            return stagingSchemeRepository.findAllByOrderByCreatedAtDesc();
        }
        return stagingSchemeRepository.findByReviewStatusOrderByCreatedAtDesc(status.toUpperCase());
    }

    public StagingScheme getById(String id) {
        return stagingSchemeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Staging record not found: " + id));
    }

    /**
     * Imports bulk schemes from JSON or CSV string content.
     */
    public ImportSummaryDto importRawData(String content, String format, String defaultSourceSystem, String defaultSourceUrl) {
        if (content == null || content.trim().isEmpty()) {
            throw new BadRequestException("Import content cannot be empty");
        }

        List<Map<String, Object>> rawRecords = new ArrayList<>();
        String normalizedFormat = format != null ? format.trim().toLowerCase() : "json";

        try {
            if ("csv".equals(normalizedFormat)) {
                List<Map<String, String>> csvRows = CsvParserUtil.parseCsv(content);
                for (Map<String, String> row : csvRows) {
                    Map<String, Object> record = new HashMap<>(row);
                    rawRecords.add(record);
                }
            } else {
                // Default to JSON
                JsonNode rootNode = objectMapper.readTree(content);
                if (rootNode.isArray()) {
                    rawRecords = objectMapper.convertValue(rootNode, new TypeReference<List<Map<String, Object>>>() {});
                } else if (rootNode.has("schemes") && rootNode.get("schemes").isArray()) {
                    rawRecords = objectMapper.convertValue(rootNode.get("schemes"), new TypeReference<List<Map<String, Object>>>() {});
                    if (defaultSourceSystem == null && rootNode.has("sourceSystem")) {
                        defaultSourceSystem = rootNode.get("sourceSystem").asText();
                    }
                    if (defaultSourceUrl == null && rootNode.has("sourceUrl")) {
                        defaultSourceUrl = rootNode.get("sourceUrl").asText();
                    }
                } else {
                    // Single object JSON
                    Map<String, Object> single = objectMapper.convertValue(rootNode, new TypeReference<Map<String, Object>>() {});
                    rawRecords.add(single);
                }
            }
        } catch (IOException e) {
            log.error("Failed to parse import content as {}: {}", normalizedFormat, e.getMessage());
            throw new BadRequestException("Invalid " + normalizedFormat.toUpperCase() + " data format: " + e.getMessage());
        }

        return processRecords(rawRecords, defaultSourceSystem, defaultSourceUrl);
    }

    private ImportSummaryDto processRecords(List<Map<String, Object>> rawRecords, String defaultSourceSystem, String defaultSourceUrl) {
        ImportSummaryDto summary = new ImportSummaryDto();
        summary.setTotalProcessed(rawRecords.size());

        for (int i = 0; i < rawRecords.size(); i++) {
            Map<String, Object> record = rawRecords.get(i);
            int recordIndex = i + 1;

            try {
                // 1. Normalization & Object mapping
                Scheme proposed = mapAndNormalize(record, defaultSourceSystem, defaultSourceUrl);

                // 2. Strict Validation
                List<String> validationErrors = validateScheme(proposed);
                if (!validationErrors.isEmpty()) {
                    String err = "Record #" + recordIndex + " (" + (proposed.getName() != null ? proposed.getName() : "Unknown") + "): "
                            + String.join(", ", validationErrors);
                    summary.getErrors().add(err);
                    summary.setRejectedErrors(summary.getRejectedErrors() + 1);
                    continue;
                }

                // 3. Compute Content Hash
                String hash = computeContentHash(proposed);
                proposed.setContentHash(hash);

                // 4. Duplicate & Update Detection
                DuplicateCheckResult dupResult = detectDuplicates(proposed, hash);

                if (dupResult.isExactDuplicate()) {
                    summary.setSkippedDuplicates(summary.getSkippedDuplicates() + 1);
                    continue;
                }

                // 5. Stage Record (NEVER directly write to live collection)
                Instant now = Instant.now();
                StagingScheme staging = StagingScheme.builder()
                        .proposedData(proposed)
                        .sourceSystem(proposed.getSourceSystem())
                        .sourceUrl(proposed.getSourceUrl())
                        .externalId(proposed.getExternalId())
                        .dataOrigin(proposed.getDataOrigin() != null ? proposed.getDataOrigin() : "BULK_IMPORT")
                        .changeType(dupResult.getChangeType())
                        .reviewStatus("PENDING")
                        .existingSchemeId(dupResult.getExistingSchemeId())
                        .changedFields(dupResult.getChangedFields())
                        .contentHash(hash)
                        .createdAt(now)
                        .updatedAt(now)
                        .build();

                StagingScheme saved = stagingSchemeRepository.save(staging);
                summary.getStagedSchemeIds().add(saved.getId());

                if ("NEW".equals(dupResult.getChangeType())) {
                    summary.setStagedNew(summary.getStagedNew() + 1);
                } else {
                    summary.setStagedUpdate(summary.getStagedUpdate() + 1);
                }

            } catch (Exception e) {
                log.warn("Error processing record #{}: {}", recordIndex, e.getMessage());
                summary.getErrors().add("Record #" + recordIndex + ": " + e.getMessage());
                summary.setRejectedErrors(summary.getRejectedErrors() + 1);
            }
        }

        return summary;
    }

    /**
     * Validates proposed Scheme against domain rules.
     */
    public List<String> validateScheme(Scheme scheme) {
        List<String> errors = new ArrayList<>();

        if (scheme.getName() == null || scheme.getName().trim().length() < 3) {
            errors.add("Scheme name is required (minimum 3 characters)");
        }

        if (scheme.getDepartment() == null || scheme.getDepartment().trim().isEmpty()) {
            errors.add("Department is required");
        }

        if (scheme.getCategory() == null || scheme.getCategory().trim().isEmpty()) {
            errors.add("Category is required");
        } else if (!SUPPORTED_CATEGORIES.contains(scheme.getCategory())) {
            errors.add("Category '" + scheme.getCategory() + "' is not supported. Supported: " + SUPPORTED_CATEGORIES);
        }

        if (scheme.getApplicationLink() == null || scheme.getApplicationLink().trim().isEmpty()) {
            errors.add("Official portal application link is required");
        } else {
            String link = scheme.getApplicationLink().trim();
            if (!link.toLowerCase().startsWith("https://")) {
                errors.add("Application link must use HTTPS for official government security (" + link + ")");
            }
        }

        return errors;
    }

    /**
     * Normalizes a raw map into a typed Scheme model without fabricating missing criteria.
     */
    @SuppressWarnings("unchecked")
    private Scheme mapAndNormalize(Map<String, Object> raw, String defaultSourceSystem, String defaultSourceUrl) {
        String name = getString(raw, "name", "schemename", "scheme_name");
        String department = getString(raw, "department", "dept", "ministry", "nodal_department");
        String rawCategory = getString(raw, "category", "schemecategory", "sector");
        String description = getString(raw, "description", "details", "brief");
        String applicationLink = getString(raw, "applicationlink", "application_link", "url", "link", "portal_link");
        String applicationProcess = getString(raw, "applicationprocess", "application_process", "how_to_apply");
        String deadlineStr = getString(raw, "deadline", "end_date", "last_date");
        String externalId = getString(raw, "externalid", "external_id", "id", "scheme_id");
        String sourceSystem = getString(raw, "sourcesystem", "source_system");
        String sourceUrl = getString(raw, "sourceurl", "source_url");

        if (sourceSystem == null || sourceSystem.isBlank()) {
            sourceSystem = defaultSourceSystem != null ? defaultSourceSystem : "BULK_IMPORT";
        }
        if (sourceUrl == null || sourceUrl.isBlank()) {
            sourceUrl = defaultSourceUrl != null ? defaultSourceUrl : "";
        }

        // Normalize Category
        String normalizedCategory = null;
        if (rawCategory != null && !rawCategory.isBlank()) {
            normalizedCategory = CANONICAL_CATEGORY_MAP.get(rawCategory.trim().toLowerCase());
            if (normalizedCategory == null) {
                normalizedCategory = rawCategory.trim(); // Keep raw to trigger validation error
            }
        }

        // Normalize URL (trim & strip trailing slash)
        if (applicationLink != null) {
            applicationLink = applicationLink.trim();
            if (applicationLink.endsWith("/")) {
                applicationLink = applicationLink.substring(0, applicationLink.length() - 1);
            }
        }

        // Parse Deadline
        LocalDate deadline = null;
        if (deadlineStr != null && !deadlineStr.isBlank()) {
            try {
                deadline = LocalDate.parse(deadlineStr.trim());
            } catch (DateTimeParseException e) {
                log.debug("Could not parse deadline string: {}", deadlineStr);
            }
        }

        // Parse Benefits
        List<String> benefits = parseStringList(raw.get("benefits"));
        List<String> requiredDocuments = parseStringList(raw.get("requiredDocuments") != null ? raw.get("requiredDocuments") : raw.get("required_documents"));

        // Parse EligibilityCriteria if explicitly provided (do NOT invent missing criteria)
        Scheme.EligibilityCriteria criteria = null;
        Object critObj = raw.get("eligibilityCriteria") != null ? raw.get("eligibilityCriteria") : raw.get("eligibility_criteria");
        if (critObj instanceof Map<?, ?> critMap) {
            criteria = objectMapper.convertValue(critMap, Scheme.EligibilityCriteria.class);
        }

        return Scheme.builder()
                .name(name != null ? name.trim() : null)
                .department(department != null ? department.trim() : null)
                .category(normalizedCategory)
                .description(description != null ? description.trim() : "")
                .benefits(benefits)
                .requiredDocuments(requiredDocuments)
                .applicationLink(applicationLink)
                .applicationProcess(applicationProcess != null ? applicationProcess.trim() : "")
                .deadline(deadline)
                .status("ACTIVE")
                .eligibilityCriteria(criteria)
                .sourceSystem(sourceSystem)
                .sourceUrl(sourceUrl)
                .externalId(externalId)
                .dataOrigin("BULK_IMPORT")
                .build();
    }

    private List<String> parseStringList(Object obj) {
        if (obj == null) return new ArrayList<>();
        if (obj instanceof List<?> list) {
            List<String> res = new ArrayList<>();
            for (Object item : list) {
                if (item != null && !item.toString().trim().isEmpty()) {
                    res.add(item.toString().trim());
                }
            }
            return res;
        }
        if (obj instanceof String str) {
            String[] parts = str.split("[|;\\n]");
            List<String> res = new ArrayList<>();
            for (String p : parts) {
                if (!p.trim().isEmpty()) {
                    res.add(p.trim());
                }
            }
            return res;
        }
        return new ArrayList<>();
    }

    private String getString(Map<String, Object> map, String... possibleKeys) {
        for (String k : possibleKeys) {
            for (Map.Entry<String, Object> entry : map.entrySet()) {
                if (entry.getKey().equalsIgnoreCase(k) && entry.getValue() != null) {
                    String val = entry.getValue().toString().trim();
                    if (!val.isEmpty()) return val;
                }
            }
        }
        return null;
    }

    /**
     * Duplicate detection following priority:
     * 1. sourceSystem + externalId
     * 2. normalized applicationLink
     * 3. normalized scheme name + department
     */
    public DuplicateCheckResult detectDuplicates(Scheme proposed, String proposedHash) {
        Scheme matchedLive = null;

        // 1. sourceSystem + externalId
        if (proposed.getSourceSystem() != null && !proposed.getSourceSystem().isBlank()
                && proposed.getExternalId() != null && !proposed.getExternalId().isBlank()) {
            matchedLive = schemeRepository.findBySourceSystemAndExternalId(
                    proposed.getSourceSystem(), proposed.getExternalId()).orElse(null);
        }

        // 2. applicationLink
        if (matchedLive == null && proposed.getApplicationLink() != null && !proposed.getApplicationLink().isBlank()) {
            matchedLive = schemeRepository.findByApplicationLink(proposed.getApplicationLink()).orElse(null);
        }

        // 3. name + department
        if (matchedLive == null && proposed.getName() != null && proposed.getDepartment() != null) {
            List<Scheme> nameDeptMatches = schemeRepository.findByNameIgnoreCaseAndDepartmentIgnoreCase(
                    proposed.getName().trim(), proposed.getDepartment().trim());
            if (!nameDeptMatches.isEmpty()) {
                matchedLive = nameDeptMatches.get(0);
            }
        }

        if (matchedLive != null) {
            String liveHash = matchedLive.getContentHash();
            if (liveHash == null || liveHash.isBlank()) {
                liveHash = computeContentHash(matchedLive);
            }

            if (proposedHash.equals(liveHash)) {
                // Exact duplicate of live scheme with no changes
                return DuplicateCheckResult.builder()
                        .exactDuplicate(true)
                        .changeType("EXACT_DUPLICATE")
                        .existingSchemeId(matchedLive.getId())
                        .build();
            } else {
                // Existing scheme found but content has changed -> UPDATE
                Map<String, Object> diff = computeDiff(matchedLive, proposed);
                return DuplicateCheckResult.builder()
                        .exactDuplicate(false)
                        .changeType("UPDATE")
                        .existingSchemeId(matchedLive.getId())
                        .changedFields(diff)
                        .build();
            }
        }

        // No live match -> check if identical staging record is already PENDING review
        Optional<StagingScheme> pendingExisting = stagingSchemeRepository.findByContentHashAndReviewStatus(proposedHash, "PENDING");
        if (pendingExisting.isPresent()) {
            return DuplicateCheckResult.builder()
                    .exactDuplicate(true)
                    .changeType("PENDING_DUPLICATE")
                    .existingSchemeId(pendingExisting.get().getId())
                    .build();
        }

        return DuplicateCheckResult.builder()
                .exactDuplicate(false)
                .changeType("NEW")
                .existingSchemeId(null)
                .build();
    }

    /**
     * Computes changed fields between live and proposed data.
     */
    public Map<String, Object> computeDiff(Scheme live, Scheme proposed) {
        Map<String, Object> diff = new LinkedHashMap<>();

        checkFieldDiff(diff, "name", live.getName(), proposed.getName());
        checkFieldDiff(diff, "department", live.getDepartment(), proposed.getDepartment());
        checkFieldDiff(diff, "category", live.getCategory(), proposed.getCategory());
        checkFieldDiff(diff, "description", live.getDescription(), proposed.getDescription());
        checkFieldDiff(diff, "applicationLink", live.getApplicationLink(), proposed.getApplicationLink());
        checkFieldDiff(diff, "applicationProcess", live.getApplicationProcess(), proposed.getApplicationProcess());
        checkFieldDiff(diff, "deadline", live.getDeadline(), proposed.getDeadline());
        checkFieldDiff(diff, "benefits", live.getBenefits(), proposed.getBenefits());
        checkFieldDiff(diff, "requiredDocuments", live.getRequiredDocuments(), proposed.getRequiredDocuments());

        if (proposed.getEligibilityCriteria() != null && !proposed.getEligibilityCriteria().equals(live.getEligibilityCriteria())) {
            Map<String, Object> val = new HashMap<>();
            val.put("old", live.getEligibilityCriteria());
            val.put("new", proposed.getEligibilityCriteria());
            diff.put("eligibilityCriteria", val);
        }

        return diff;
    }

    private void checkFieldDiff(Map<String, Object> diff, String field, Object oldVal, Object newVal) {
        if (!Objects.equals(oldVal, newVal)) {
            Map<String, Object> change = new LinkedHashMap<>();
            change.put("old", oldVal);
            change.put("new", newVal);
            diff.put(field, change);
        }
    }

    /**
     * Compute SHA-256 fingerprint of the core scheme attributes.
     */
    public String computeContentHash(Scheme s) {
        String canonical = String.join("|",
                s.getName() != null ? s.getName().trim().toLowerCase() : "",
                s.getDepartment() != null ? s.getDepartment().trim().toLowerCase() : "",
                s.getCategory() != null ? s.getCategory().trim() : "",
                s.getDescription() != null ? s.getDescription().trim() : "",
                s.getApplicationLink() != null ? s.getApplicationLink().trim().toLowerCase() : "",
                s.getDeadline() != null ? s.getDeadline().toString() : "",
                s.getBenefits() != null ? String.join(";", s.getBenefits()) : "",
                s.getRequiredDocuments() != null ? String.join(";", s.getRequiredDocuments()) : ""
        );

        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(canonical.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 algorithm not available", e);
        }
    }

    /**
     * Edit staged data prior to approval.
     */
    public StagingScheme updateStagedData(String stagingId, Scheme updatedProposedData, String adminUserId) {
        StagingScheme staging = getById(stagingId);

        if (!"PENDING".equalsIgnoreCase(staging.getReviewStatus())) {
            throw new BadRequestException("Only PENDING staging records can be edited. Current status: " + staging.getReviewStatus());
        }

        // Revalidate
        List<String> errors = validateScheme(updatedProposedData);
        if (!errors.isEmpty()) {
            throw new BadRequestException("Validation failed for staged edits: " + String.join(", ", errors));
        }

        String newHash = computeContentHash(updatedProposedData);
        updatedProposedData.setContentHash(newHash);

        staging.setProposedData(updatedProposedData);
        staging.setContentHash(newHash);
        staging.setUpdatedAt(Instant.now());

        // Re-evaluate diff if updating existing scheme
        if ("UPDATE".equalsIgnoreCase(staging.getChangeType()) && staging.getExistingSchemeId() != null) {
            schemeRepository.findById(staging.getExistingSchemeId())
                    .ifPresent(live -> staging.setChangedFields(computeDiff(live, updatedProposedData)));
        }

        return stagingSchemeRepository.save(staging);
    }

    /**
     * Approves a staged scheme and activates it into the live schemes collection.
     */
    public Scheme approve(String stagingId, String adminUserId) {
        StagingScheme staging = getById(stagingId);

        if (!"PENDING".equalsIgnoreCase(staging.getReviewStatus())) {
            throw new BadRequestException("Cannot approve record with status: " + staging.getReviewStatus());
        }

        Scheme proposed = staging.getProposedData();
        List<String> validationErrors = validateScheme(proposed);
        if (!validationErrors.isEmpty()) {
            throw new BadRequestException("Cannot approve invalid record: " + String.join(", ", validationErrors));
        }

        Instant now = Instant.now();
        Scheme liveScheme;

        if ("UPDATE".equalsIgnoreCase(staging.getChangeType()) && staging.getExistingSchemeId() != null) {
            liveScheme = schemeRepository.findById(staging.getExistingSchemeId())
                    .orElseThrow(() -> new ResourceNotFoundException("Live scheme to update was not found: " + staging.getExistingSchemeId()));

            // Update live fields
            liveScheme.setName(proposed.getName());
            liveScheme.setDepartment(proposed.getDepartment());
            liveScheme.setCategory(proposed.getCategory());
            liveScheme.setDescription(proposed.getDescription());
            liveScheme.setBenefits(proposed.getBenefits());
            liveScheme.setEligibilityCriteria(proposed.getEligibilityCriteria());
            liveScheme.setRequiredDocuments(proposed.getRequiredDocuments());
            liveScheme.setApplicationProcess(proposed.getApplicationProcess());
            liveScheme.setApplicationLink(proposed.getApplicationLink());
            liveScheme.setDeadline(proposed.getDeadline());
            if (proposed.getStatus() != null && !proposed.getStatus().isBlank()) {
                liveScheme.setStatus(proposed.getStatus());
            }

            // Provenance
            liveScheme.setSourceSystem(staging.getSourceSystem());
            liveScheme.setSourceUrl(staging.getSourceUrl());
            liveScheme.setExternalId(staging.getExternalId());
            liveScheme.setDataOrigin(staging.getDataOrigin());
            liveScheme.setReviewStatus("APPROVED");
            liveScheme.setContentHash(staging.getContentHash());
            liveScheme.setUpdatedAt(now);

            liveScheme = schemeRepository.save(liveScheme);
            log.info("Admin {} approved UPDATE for scheme '{}' ({})", adminUserId, liveScheme.getName(), liveScheme.getId());
        } else {
            // NEW Scheme
            proposed.setId(null);
            proposed.setStatus("ACTIVE");
            proposed.setSourceSystem(staging.getSourceSystem());
            proposed.setSourceUrl(staging.getSourceUrl());
            proposed.setExternalId(staging.getExternalId());
            proposed.setDataOrigin(staging.getDataOrigin() != null ? staging.getDataOrigin() : "BULK_IMPORT");
            proposed.setReviewStatus("APPROVED");
            proposed.setContentHash(staging.getContentHash());
            proposed.setCreatedAt(now);
            proposed.setUpdatedAt(now);

            liveScheme = schemeRepository.save(proposed);
            log.info("Admin {} approved NEW scheme '{}' ({})", adminUserId, liveScheme.getName(), liveScheme.getId());
        }

        // Mark staging record as APPROVED
        staging.setReviewStatus("APPROVED");
        staging.setReviewedAt(now);
        staging.setReviewedBy(adminUserId);
        staging.setUpdatedAt(now);
        stagingSchemeRepository.save(staging);

        return liveScheme;
    }

    /**
     * Rejects a staged scheme with an explicit reason.
     */
    public StagingScheme reject(String stagingId, RejectStagingRequest request, String adminUserId) {
        StagingScheme staging = getById(stagingId);

        if (!"PENDING".equalsIgnoreCase(staging.getReviewStatus())) {
            throw new BadRequestException("Cannot reject record with status: " + staging.getReviewStatus());
        }

        Instant now = Instant.now();
        staging.setReviewStatus("REJECTED");
        staging.setRejectionReason(request.getReason());
        staging.setReviewedAt(now);
        staging.setReviewedBy(adminUserId);
        staging.setUpdatedAt(now);

        log.info("Admin {} rejected staging scheme {} with reason: {}", adminUserId, stagingId, request.getReason());
        return stagingSchemeRepository.save(staging);
    }

    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class DuplicateCheckResult {
        private boolean exactDuplicate;
        private String changeType; // NEW, UPDATE, EXACT_DUPLICATE, PENDING_DUPLICATE
        private String existingSchemeId;
        private Map<String, Object> changedFields;
    }
}
