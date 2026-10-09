package com.schemepredictor.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** Output of the rule engine for one scheme against one profile. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EligibilityResult {

    private String schemeId;
    private boolean eligible;

    /** ELIGIBLE / NOT_ELIGIBLE / NEEDS_VERIFICATION */
    private String status;

    /** e.g. "appears to meet the listed eligibility criteria" — never "officially eligible". */
    private String statusMessage;

    private List<CriterionCheck> checks;
    private List<String> missingInformation;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CriterionCheck {
        private String label;      // e.g. "Age requirement"
        private String detail;     // e.g. "21 (required 18-25)"
        private String status;     // MET / NOT_MET / UNKNOWN (missing data)
    }
}
