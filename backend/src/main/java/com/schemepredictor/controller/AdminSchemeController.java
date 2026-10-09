package com.schemepredictor.controller;

import com.schemepredictor.model.Scheme;
import com.schemepredictor.service.SchemeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/admin/schemes")
@RequiredArgsConstructor
public class AdminSchemeController {

    private final SchemeService schemeService;

    @GetMapping
    public ResponseEntity<List<Scheme>> getAllSchemes() {
        return ResponseEntity.ok(schemeService.findAllForAdmin());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Scheme> getSchemeById(@PathVariable String id) {
        return ResponseEntity.ok(schemeService.findById(id));
    }

    @PostMapping
    public ResponseEntity<Scheme> createScheme(@Valid @RequestBody Scheme scheme) {
        Scheme created = schemeService.create(scheme);
        log.info("Admin created new scheme: {} ({})", created.getName(), created.getId());
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Scheme> updateScheme(@PathVariable String id, @Valid @RequestBody Scheme scheme) {
        Scheme updated = schemeService.update(id, scheme);
        log.info("Admin updated scheme: {} ({})", updated.getName(), id);
        return ResponseEntity.ok(updated);
    }

    @PatchMapping("/{id}/toggle-status")
    public ResponseEntity<Scheme> toggleStatus(@PathVariable String id) {
        Scheme updated = schemeService.toggleStatus(id);
        log.info("Admin toggled scheme status: {} to {}", id, updated.getStatus());
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteScheme(@PathVariable String id) {
        schemeService.delete(id);
        log.info("Admin deleted scheme: {}", id);
        return ResponseEntity.noContent().build();
    }
}
