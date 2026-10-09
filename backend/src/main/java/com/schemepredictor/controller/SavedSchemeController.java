package com.schemepredictor.controller;

import com.schemepredictor.model.Scheme;
import com.schemepredictor.security.CurrentUser;
import com.schemepredictor.service.SavedSchemeService;
import com.schemepredictor.service.SchemeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/saved-schemes")
@RequiredArgsConstructor
public class SavedSchemeController {

    private final SavedSchemeService savedSchemeService;
    private final SchemeService schemeService;

    @GetMapping
    public ResponseEntity<List<Scheme>> list() {
        String userId = CurrentUser.id();
        List<Scheme> saved = savedSchemeService.list(userId).stream()
                .map(s -> {
                    try {
                        return schemeService.findById(s.getSchemeId());
                    } catch (Exception e) {
                        return null;
                    }
                })
                .filter(java.util.Objects::nonNull)
                .toList();
        return ResponseEntity.ok(saved);
    }
}
