package com.schemepredictor.controller;

import com.schemepredictor.dto.ShareCreateRequest;
import com.schemepredictor.dto.ShareResponse;
import com.schemepredictor.model.DocumentRecord;
import com.schemepredictor.model.DocumentVersion;
import com.schemepredictor.model.ShareAccessEvent;
import com.schemepredictor.security.CurrentUser;
import com.schemepredictor.service.ProfileNormalizationService;
import com.schemepredictor.service.ShareService;
import com.schemepredictor.service.WalletService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/wallet")
@RequiredArgsConstructor
public class WalletController {

    private final WalletService walletService;
    private final ShareService shareService;

    @GetMapping
    public ResponseEntity<List<DocumentRecord>> list() {
        return ResponseEntity.ok(walletService.listDocuments(CurrentUser.id()));
    }

    @PostMapping(value = "/upload", consumes = "multipart/form-data")
    public ResponseEntity<DocumentRecord> upload(
            @RequestParam("documentType") String documentType,
            @RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(walletService.upload(CurrentUser.id(), documentType, file));
    }

    @GetMapping("/{id}")
    public ResponseEntity<DocumentRecord> getOne(@PathVariable String id) {
        return ResponseEntity.ok(walletService.getDocument(CurrentUser.id(), id));
    }

    @PutMapping("/{id}/verify")
    public ResponseEntity<DocumentRecord> verify(@PathVariable String id, @RequestBody Map<String, String> verifiedFields) {
        return ResponseEntity.ok(walletService.verifyFields(CurrentUser.id(), id, verifiedFields));
    }

    @GetMapping("/{id}/profile-changes")
    public ResponseEntity<List<ProfileNormalizationService.Conflict>> profileChanges(@PathVariable String id) {
        return ResponseEntity.ok(walletService.profileConflicts(CurrentUser.id(), id));
    }

    @PostMapping("/{id}/profile-changes/apply")
    public ResponseEntity<com.schemepredictor.model.Profile> applyProfileChanges(
            @PathVariable String id, @RequestBody Map<String, List<String>> body) {
        List<String> fields = body.getOrDefault("fields", List.of());
        return ResponseEntity.ok(walletService.applyProfileChanges(CurrentUser.id(), id, new java.util.HashSet<>(fields)));
    }

    @PostMapping("/sync")
    public ResponseEntity<com.schemepredictor.model.Profile> sync() {
        return ResponseEntity.ok(walletService.syncWallet(CurrentUser.id()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        walletService.delete(CurrentUser.id(), id);
        return ResponseEntity.ok().build();
    }

    // ---- Version history ----

    @GetMapping("/{id}/versions")
    public ResponseEntity<List<DocumentVersion>> versions(@PathVariable String id) {
        return ResponseEntity.ok(walletService.listVersions(CurrentUser.id(), id));
    }

    @PostMapping(value = "/{id}/versions", consumes = "multipart/form-data")
    public ResponseEntity<DocumentRecord> addVersion(@PathVariable String id, @RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(walletService.addVersion(CurrentUser.id(), id, file));
    }

    @PostMapping("/{id}/versions/{versionNumber}/restore")
    public ResponseEntity<DocumentRecord> restore(@PathVariable String id, @PathVariable int versionNumber) {
        return ResponseEntity.ok(walletService.restoreVersion(CurrentUser.id(), id, versionNumber));
    }

    // ---- Sharing ----

    @PostMapping("/{id}/shares")
    public ResponseEntity<ShareResponse> createShare(@PathVariable String id, @RequestBody ShareCreateRequest request) {
        ShareService.CreatedShare created = shareService.create(CurrentUser.id(), id,
                request.getPermission(), request.getExpiresInHours(), request.isAcknowledgeRisk());
        return ResponseEntity.ok(ShareResponse.of(created.link(), created.token()));
    }

    @GetMapping("/{id}/shares")
    public ResponseEntity<List<ShareResponse>> listShares(@PathVariable String id) {
        return ResponseEntity.ok(shareService.list(CurrentUser.id(), id).stream()
                .map(l -> ShareResponse.of(l, null)).toList());
    }

    @DeleteMapping("/{id}/shares/{shareId}")
    public ResponseEntity<ShareResponse> revokeShare(@PathVariable String id, @PathVariable String shareId) {
        return ResponseEntity.ok(ShareResponse.of(shareService.revoke(CurrentUser.id(), id, shareId), null));
    }

    @GetMapping("/{id}/shares/{shareId}/events")
    public ResponseEntity<List<ShareAccessEvent>> shareEvents(@PathVariable String id, @PathVariable String shareId) {
        return ResponseEntity.ok(shareService.events(CurrentUser.id(), id, shareId));
    }
}
