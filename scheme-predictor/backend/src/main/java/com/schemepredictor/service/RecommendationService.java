package com.schemepredictor.service;

import com.schemepredictor.dto.EligibilityResult;
import com.schemepredictor.dto.RecommendationDto;
import com.schemepredictor.model.Profile;
import com.schemepredictor.model.Scheme;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Combines the authoritative rule engine eligibility checks with XGBoost ML ranking
 * to produce tri-state ordered, explainable recommendations.
 *
 * Architecture:
 * - Rule Engine is the sole legal authority on eligibility (ELIGIBLE / NEEDS_VERIFICATION / NOT_ELIGIBLE).
 * - ML ranking predicts relevance/affinity, but can NEVER flip an ineligible scheme into eligible.
 * - Explainable AI builds transparent narratives explaining why each scheme was ranked and recommended.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RecommendationService {

    private final SchemeService schemeService;
    private final EligibilityService eligibilityService;
    private final ProfileService profileService;
    private final SavedSchemeService savedSchemeService;
    private final RestTemplate restTemplate;

    @Value("${app.services.recommendation-url}")
    private String recommendationServiceUrl;

    public List<RecommendationDto> recommend(String userId, Profile profile) {
        List<Scheme> schemes = schemeService.findAll();
        Set<String> saved = savedSchemeService.savedSchemeIds(userId);

        Map<String, Object> mlPayload = fetchMlData(profile, schemes);
        @SuppressWarnings("unchecked")
        Map<String, Double> mlScores = (Map<String, Double>) mlPayload.getOrDefault("scores", Map.of());
        @SuppressWarnings("unchecked")
        List<String> topFactors = (List<String>) mlPayload.getOrDefault("topFactors", List.of());

        List<RecommendationDto> ranked = schemes.stream()
                .map(scheme -> toRecommendation(scheme, profile, mlScores, topFactors, saved))
                .sorted((a, b) -> {
                    // 1. Prioritize by status: ELIGIBLE (3) > NEEDS_VERIFICATION (2) > NOT_ELIGIBLE (1)
                    int statusDiff = Integer.compare(statusPriority(b.getEligibilityStatus()), statusPriority(a.getEligibilityStatus()));
                    if (statusDiff != 0) {
                        return statusDiff;
                    }
                    // 2. Then by ML match percentage descending
                    return Double.compare(b.getMatchPercentage(), a.getMatchPercentage());
                })
                .collect(Collectors.toList());

        // Assign 1-based sequential rank after prioritized ordering
        for (int i = 0; i < ranked.size(); i++) {
            ranked.get(i).setRank(i + 1);
        }
        return ranked;
    }

    private int statusPriority(String status) {
        if ("ELIGIBLE".equalsIgnoreCase(status)) return 3;
        if ("NEEDS_VERIFICATION".equalsIgnoreCase(status)) return 2;
        return 1; // NOT_ELIGIBLE
    }

    private RecommendationDto toRecommendation(Scheme scheme, Profile profile,
                                                Map<String, Double> mlScores, List<String> topFactors, Set<String> saved) {
        EligibilityResult eligibility = eligibilityService.check(scheme, profile);
        String status = eligibility.getStatus() != null ? eligibility.getStatus() : (eligibility.isEligible() ? "ELIGIBLE" : "NOT_ELIGIBLE");

        double matchPercentage = mlScores.getOrDefault(scheme.getId(), fallbackScore(eligibility));

        // Strict capping: ineligibility or unverified criteria cap ML match scores
        if ("NOT_ELIGIBLE".equals(status)) {
            matchPercentage = Math.min(matchPercentage, 40.0);
        } else if ("NEEDS_VERIFICATION".equals(status)) {
            matchPercentage = Math.min(matchPercentage, 75.0);
        }

        Long daysRemaining = null;
        if (scheme.getDeadline() != null) {
            daysRemaining = ChronoUnit.DAYS.between(LocalDate.now(), scheme.getDeadline());
        }

        List<EligibilityResult.CriterionCheck> passed = eligibility.getChecks().stream()
                .filter(c -> "MET".equals(c.getStatus())).toList();
        List<EligibilityResult.CriterionCheck> failed = eligibility.getChecks().stream()
                .filter(c -> "NOT_MET".equals(c.getStatus())).toList();

        String explanation = buildExplanation(scheme, profile, status, passed, failed, eligibility.getMissingInformation(), topFactors);

        return RecommendationDto.builder()
                .schemeId(scheme.getId())
                .name(scheme.getName())
                .department(scheme.getDepartment())
                .category(scheme.getCategory())
                .shortDescription(scheme.getDescription())
                .matchPercentage(Math.round(matchPercentage * 10.0) / 10.0)
                .eligible("ELIGIBLE".equals(status))
                .eligibilityStatus(status)
                .eligibilityStatusMessage(eligibility.getStatusMessage())
                .explanationText(explanation)
                .keyBenefits(scheme.getBenefits())
                .requiredDocuments(scheme.getRequiredDocuments())
                .deadline(scheme.getDeadline())
                .daysRemaining(daysRemaining)
                .saved(saved.contains(scheme.getId()))
                .criteriaChecks(eligibility.getChecks())
                .passedChecks(passed)
                .failedChecks(failed)
                .missingInformation(eligibility.getMissingInformation())
                .build();
    }

    /**
     * Explainable AI Narrative Generator.
     * Accurately communicates both the deterministic rule decisions and ML profile factors.
     */
    private String buildExplanation(Scheme scheme, Profile profile, String status,
                                    List<EligibilityResult.CriterionCheck> passed,
                                    List<EligibilityResult.CriterionCheck> failed,
                                    List<String> missing,
                                    List<String> topFactors) {
        StringBuilder sb = new StringBuilder();

        if ("ELIGIBLE".equals(status)) {
            sb.append("Recommended because you satisfy all mandatory criteria: ");
            List<String> passedLabels = passed.stream().map(EligibilityResult.CriterionCheck::getLabel).limit(3).toList();
            sb.append(String.join(", ", passedLabels));
            if (passed.size() > 3) sb.append(", and others");
            sb.append(". ");
            if (profile != null && profile.getIncome() != null) {
                sb.append("Your verified income fits the target beneficiary bracket.");
            }
        } else if ("NEEDS_VERIFICATION".equals(status)) {
            sb.append("Potentially matches your background in ").append(scheme.getCategory()).append(", but requires document verification. ");
            if (!missing.isEmpty()) {
                sb.append("Please upload: ").append(String.join(", ", missing.stream().limit(3).toList())).append(".");
            }
        } else {
            sb.append("Currently not eligible because one or more criteria failed: ");
            List<String> failedDetails = failed.stream().map(c -> c.getLabel() + " (" + c.getDetail() + ")").limit(2).toList();
            sb.append(String.join("; ", failedDetails)).append(".");
        }

        return sb.toString();
    }

    /**
     * Calls the Python XGBoost microservice for category probabilities and scores.
     * Falls back seamlessly to rule scoring if the AI service is offline.
     */
    private Map<String, Object> fetchMlData(Profile profile, List<Scheme> schemes) {
        try {
            Map<String, String> schemeCategories = new HashMap<>();
            schemes.forEach(s -> schemeCategories.put(s.getId(), s.getCategory()));

            Map<String, Object> payload = new HashMap<>();
            payload.put("profile", profile);
            payload.put("schemeIds", schemes.stream().map(Scheme::getId).toList());
            payload.put("schemeCategories", schemeCategories);

            @SuppressWarnings("unchecked")
            Map<String, Object> response = restTemplate.postForObject(
                    recommendationServiceUrl + "/predict", payload, Map.class);

            if (response != null) {
                Map<String, Object> result = new HashMap<>();
                if (response.get("scores") instanceof Map<?, ?> rawScores) {
                    Map<String, Double> scores = new HashMap<>();
                    rawScores.forEach((k, v) -> scores.put(String.valueOf(k), ((Number) v).doubleValue()));
                    result.put("scores", scores);
                }
                if (response.get("topFactors") instanceof List<?> factors) {
                    result.put("topFactors", factors);
                }
                return result;
            }
        } catch (Exception e) {
            log.info("XGBoost ML service offline, using rule-based fallback scoring: {}", e.getMessage());
        }
        return Map.of();
    }

    private double fallbackScore(EligibilityResult eligibility) {
        long met = eligibility.getChecks().stream().filter(c -> "MET".equals(c.getStatus())).count();
        long total = eligibility.getChecks().size();
        if (total == 0) return 50.0;
        return Math.round((met * 100.0 / total) * 10.0) / 10.0;
    }
}
