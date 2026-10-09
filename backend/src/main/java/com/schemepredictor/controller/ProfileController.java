package com.schemepredictor.controller;

import com.schemepredictor.dto.ProfileRequest;
import com.schemepredictor.model.Profile;
import com.schemepredictor.security.CurrentUser;
import com.schemepredictor.service.ProfileService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/profile")
@RequiredArgsConstructor
public class ProfileController {

    private final ProfileService profileService;

    @GetMapping
    public ResponseEntity<Map<String, Object>> getProfile() {
        String userId = CurrentUser.id();
        Profile profile = profileService.getByUserId(userId);
        return ResponseEntity.ok(withCompletion(profile));
    }

    @PutMapping
    public ResponseEntity<Map<String, Object>> updateProfile(@RequestBody ProfileRequest request) {
        String userId = CurrentUser.id();
        Profile profile = profileService.update(userId, request);
        return ResponseEntity.ok(withCompletion(profile));
    }

    private Map<String, Object> withCompletion(Profile profile) {
        Map<String, Object> body = new HashMap<>();
        body.put("profile", profile);
        body.put("completionPercentage", profileService.completionPercentage(profile));
        body.put("missingFields", profileService.missingFields(profile));
        return body;
    }
}
