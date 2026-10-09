package com.schemepredictor.controller;

import com.schemepredictor.dto.RecommendationDto;
import com.schemepredictor.model.Profile;
import com.schemepredictor.security.CurrentUser;
import com.schemepredictor.service.ProfileService;
import com.schemepredictor.service.RecommendationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/recommendations")
@RequiredArgsConstructor
public class RecommendationController {

    private final RecommendationService recommendationService;
    private final ProfileService profileService;

    @GetMapping
    public ResponseEntity<List<RecommendationDto>> getRecommendations() {
        String userId = CurrentUser.id();
        Profile profile = profileService.getByUserId(userId);
        return ResponseEntity.ok(recommendationService.recommend(userId, profile));
    }

    /** Re-run prediction on demand, e.g. right after the citizen updates their profile. */
    @PostMapping("/predict")
    public ResponseEntity<List<RecommendationDto>> predict() {
        return getRecommendations();
    }
}
