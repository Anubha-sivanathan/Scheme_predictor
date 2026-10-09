package com.schemepredictor.controller;

import com.schemepredictor.model.Scheme;
import com.schemepredictor.security.CurrentUser;
import com.schemepredictor.service.SavedSchemeService;
import com.schemepredictor.service.SchemeHistoryService;
import com.schemepredictor.service.SchemeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/schemes")
@RequiredArgsConstructor
public class SchemeController {

    private final SchemeService schemeService;
    private final SchemeHistoryService schemeHistoryService;
    private final SavedSchemeService savedSchemeService;

    @GetMapping
    public ResponseEntity<List<Scheme>> getAll() {
        return ResponseEntity.ok(schemeService.findAll());
    }

    @GetMapping("/search")
    public ResponseEntity<List<Scheme>> search(@RequestParam("q") String query) {
        return ResponseEntity.ok(schemeService.search(query));
    }

    @GetMapping("/category/{category}")
    public ResponseEntity<List<Scheme>> byCategory(@PathVariable String category) {
        return ResponseEntity.ok(schemeService.findByCategory(category));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Scheme> getById(@PathVariable String id) {
        Scheme scheme = schemeService.findById(id);
        try {
            // Recording history requires an authenticated user; skip silently for anonymous views.
            schemeHistoryService.recordView(CurrentUser.id(), id);
        } catch (IllegalStateException ignored) {
        }
        return ResponseEntity.ok(scheme);
    }

    @PostMapping("/{id}/save")
    public ResponseEntity<Void> saveScheme(@PathVariable String id) {
        savedSchemeService.save(CurrentUser.id(), id);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{id}/save")
    public ResponseEntity<Void> unsaveScheme(@PathVariable String id) {
        savedSchemeService.unsave(CurrentUser.id(), id);
        return ResponseEntity.ok().build();
    }
}
