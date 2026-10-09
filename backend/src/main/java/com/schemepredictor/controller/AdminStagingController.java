package com.schemepredictor.controller;

import com.schemepredictor.dto.ImportSummaryDto;
import com.schemepredictor.dto.RejectStagingRequest;
import com.schemepredictor.exception.BadRequestException;
import com.schemepredictor.model.Scheme;
import com.schemepredictor.model.StagingScheme;
import com.schemepredictor.security.CurrentUser;
import com.schemepredictor.service.StagingSchemeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/admin/staging")
@RequiredArgsConstructor
public class AdminStagingController {

    private final StagingSchemeService stagingSchemeService;

    @GetMapping
    public ResponseEntity<List<StagingScheme>> getStagingSchemes(
            @RequestParam(value = "status", required = false, defaultValue = "PENDING") String status) {
        return ResponseEntity.ok(stagingSchemeService.listStagingSchemes(status));
    }

    @GetMapping("/{id}")
    public ResponseEntity<StagingScheme> getStagingSchemeById(@PathVariable String id) {
        return ResponseEntity.ok(stagingSchemeService.getById(id));
    }

    @PostMapping(value = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ImportSummaryDto> importFile(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "sourceSystem", required = false, defaultValue = "FILE_UPLOAD") String sourceSystem,
            @RequestParam(value = "sourceUrl", required = false) String sourceUrl) {

        if (file.isEmpty()) {
            throw new BadRequestException("Uploaded file cannot be empty");
        }

        String fileName = file.getOriginalFilename() != null ? file.getOriginalFilename().toLowerCase() : "";
        String format = fileName.endsWith(".csv") ? "csv" : "json";

        try {
            String content = new String(file.getBytes(), StandardCharsets.UTF_8);
            ImportSummaryDto summary = stagingSchemeService.importRawData(content, format, sourceSystem, sourceUrl);
            log.info("Admin {} imported file {} ({}): {} new, {} update, {} skipped, {} errors",
                    CurrentUser.id(), fileName, format, summary.getStagedNew(), summary.getStagedUpdate(),
                    summary.getSkippedDuplicates(), summary.getRejectedErrors());
            return ResponseEntity.status(HttpStatus.CREATED).body(summary);
        } catch (IOException e) {
            throw new BadRequestException("Failed to read file: " + e.getMessage());
        }
    }

    @PostMapping(value = "/import-json", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ImportSummaryDto> importJson(
            @RequestBody String rawJson,
            @RequestParam(value = "sourceSystem", required = false, defaultValue = "JSON_IMPORT") String sourceSystem,
            @RequestParam(value = "sourceUrl", required = false) String sourceUrl) {

        ImportSummaryDto summary = stagingSchemeService.importRawData(rawJson, "json", sourceSystem, sourceUrl);
        log.info("Admin {} imported JSON payload: {} new, {} update, {} skipped, {} errors",
                CurrentUser.id(), summary.getStagedNew(), summary.getStagedUpdate(),
                summary.getSkippedDuplicates(), summary.getRejectedErrors());
        return ResponseEntity.status(HttpStatus.CREATED).body(summary);
    }

    @PutMapping("/{id}")
    public ResponseEntity<StagingScheme> updateStagedScheme(
            @PathVariable String id,
            @Valid @RequestBody Scheme updatedProposedData) {
        StagingScheme updated = stagingSchemeService.updateStagedData(id, updatedProposedData, CurrentUser.id());
        log.info("Admin {} edited staging scheme {}", CurrentUser.id(), id);
        return ResponseEntity.ok(updated);
    }

    @PostMapping("/{id}/approve")
    public ResponseEntity<Scheme> approveStagedScheme(@PathVariable String id) {
        Scheme approved = stagingSchemeService.approve(id, CurrentUser.id());
        log.info("Admin {} approved staging scheme {} -> Live scheme {}", CurrentUser.id(), id, approved.getId());
        return ResponseEntity.ok(approved);
    }

    @PostMapping("/{id}/reject")
    public ResponseEntity<StagingScheme> rejectStagedScheme(
            @PathVariable String id,
            @Valid @RequestBody RejectStagingRequest request) {
        StagingScheme rejected = stagingSchemeService.reject(id, request, CurrentUser.id());
        log.info("Admin {} rejected staging scheme {}", CurrentUser.id(), id);
        return ResponseEntity.ok(rejected);
    }
}
