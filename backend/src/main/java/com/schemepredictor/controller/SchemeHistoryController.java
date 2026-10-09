package com.schemepredictor.controller;

import com.schemepredictor.model.Scheme;
import com.schemepredictor.model.SchemeHistory;
import com.schemepredictor.security.CurrentUser;
import com.schemepredictor.service.SchemeHistoryService;
import com.schemepredictor.service.SchemeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/scheme-history")
@RequiredArgsConstructor
public class SchemeHistoryController {

    private final SchemeHistoryService schemeHistoryService;
    private final SchemeService schemeService;

    @GetMapping
    public ResponseEntity<List<Scheme>> recentlyViewed() {
        String userId = CurrentUser.id();
        List<SchemeHistory> history = schemeHistoryService.recentlyViewed(userId);

        // De-duplicate by scheme, keeping most-recent-first order, resolve to full Scheme objects.
        Map<String, Scheme> seen = new LinkedHashMap<>();
        for (SchemeHistory h : history) {
            if (!seen.containsKey(h.getSchemeId())) {
                try {
                    seen.put(h.getSchemeId(), schemeService.findById(h.getSchemeId()));
                } catch (Exception ignored) {
                }
            }
        }
        return ResponseEntity.ok(List.copyOf(seen.values()));
    }
}
