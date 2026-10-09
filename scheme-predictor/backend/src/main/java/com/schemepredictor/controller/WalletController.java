package com.schemepredictor.controller;

import com.schemepredictor.model.DocumentRecord;
import com.schemepredictor.security.CurrentUser;
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
        DocumentRecord doc = walletService.listDocuments(CurrentUser.id()).stream()
                .filter(d -> d.getId().equals(id))
                .findFirst()
                .orElseThrow(() -> new com.schemepredictor.exception.ResourceNotFoundException("Document not found"));
        return ResponseEntity.ok(doc);
    }

    @PutMapping("/{id}/verify")
    public ResponseEntity<DocumentRecord> verify(@PathVariable String id, @RequestBody Map<String, String> verifiedFields) {
        return ResponseEntity.ok(walletService.verifyFields(CurrentUser.id(), id, verifiedFields));
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
}
