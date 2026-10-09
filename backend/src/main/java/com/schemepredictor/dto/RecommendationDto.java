package com.schemepredictor.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RecommendationDto {
    private String schemeId;
    private String name;
    private String department;
    private String category;
    private String shortDescription;
    private double matchPercentage;
    private boolean eligible;
    private String eligibilityStatus;          // ELIGIBLE / NOT_ELIGIBLE / NEEDS_VERIFICATION
    private String eligibilityStatusMessage;
    private String explanationText;            // Explainable AI narrative
    private List<String> keyBenefits;
    private List<String> requiredDocuments;
    private LocalDate deadline;
    private Long daysRemaining;
    private boolean saved;

    /** 1-based position in the ranked recommendation list (1 = best match). */
    private int rank;

    private List<EligibilityResult.CriterionCheck> criteriaChecks;
    private List<EligibilityResult.CriterionCheck> passedChecks;
    private List<EligibilityResult.CriterionCheck> failedChecks;
    private List<String> missingInformation;
}
