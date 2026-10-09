package com.schemepredictor.eligibility;

import com.schemepredictor.dto.EligibilityResult;
import com.schemepredictor.model.Profile;
import com.schemepredictor.model.Scheme;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Deterministic rule-based eligibility engine.
 *
 * This is the SOLE AUTHORITATIVE SOURCE OF TRUTH for scheme eligibility.
 * The ML/recommendation layer (XGBoost) only ranks and prioritizes schemes —
 * it can NEVER override what this engine decides.
 *
 * Evaluation outputs a tri-state result:
 * 1. ELIGIBLE          -> All mandatory criteria explicitly satisfied (MET).
 * 2. NOT_ELIGIBLE      -> At least one mandatory criterion explicitly failed (NOT_MET).
 * 3. NEEDS_VERIFICATION-> No criteria failed, but one or more mandatory criteria
 *                         are unverified/missing (UNKNOWN).
 */
@Component
public class EligibilityRuleEngine {

    public EligibilityResult evaluate(Scheme scheme, Profile profile) {
        List<EligibilityResult.CriterionCheck> checks = new ArrayList<>();
        List<String> missing = new ArrayList<>();

        Scheme.EligibilityCriteria c = scheme.getEligibilityCriteria();
        boolean allMet = true;
        boolean anyUnknown = false;

        if (c == null) {
            EligibilityResult.CriterionCheck check = EligibilityResult.CriterionCheck.builder()
                    .label("Eligibility criteria")
                    .detail("Not yet configured for automatic checking")
                    .status("UNKNOWN")
                    .build();
            return EligibilityResult.builder()
                    .schemeId(scheme.getId())
                    .eligible(false)
                    .status("NEEDS_VERIFICATION")
                    .statusMessage("Eligibility criteria for this scheme have not been configured yet. Please check the official portal.")
                    .checks(List.of(check))
                    .missingInformation(List.of())
                    .build();
        }

        // --- 1. Age ---
        if (c.getMinAge() != null || c.getMaxAge() != null) {
            if (profile == null || profile.getAge() == null) {
                checks.add(unknown("Age requirement", ageRangeLabel(c)));
                missing.add("Age / Date of Birth (Aadhaar)");
                anyUnknown = true;
            } else {
                boolean ok = (c.getMinAge() == null || profile.getAge() >= c.getMinAge())
                        && (c.getMaxAge() == null || profile.getAge() <= c.getMaxAge());
                checks.add(met(ok, "Age requirement", profile.getAge() + " yrs (required " + ageRangeLabel(c) + ")"));
                allMet &= ok;
            }
        }

        // --- 2. Income ---
        if (c.getMaxIncome() != null || c.getMinIncome() != null) {
            if (profile == null || profile.getIncome() == null) {
                checks.add(unknown("Income requirement", incomeRangeLabel(c)));
                missing.add("Annual Income (Income Certificate)");
                anyUnknown = true;
            } else {
                boolean ok = (c.getMaxIncome() == null || profile.getIncome() <= c.getMaxIncome())
                        && (c.getMinIncome() == null || profile.getIncome() >= c.getMinIncome());
                checks.add(met(ok, "Income requirement",
                        formatCurrency(profile.getIncome()) + " (required " + incomeRangeLabel(c) + ")"));
                allMet &= ok;
            }
        }

        // --- 3. Gender ---
        if (c.getAllowedGenders() != null && !c.getAllowedGenders().isEmpty()) {
            if (profile == null || isBlank(profile.getGender())) {
                checks.add(unknown("Gender requirement", String.join("/", c.getAllowedGenders())));
                missing.add("Gender (Aadhaar Card)");
                anyUnknown = true;
            } else {
                boolean ok = containsIgnoreCase(c.getAllowedGenders(), profile.getGender());
                checks.add(met(ok, "Gender requirement", profile.getGender() + " (eligible: " + String.join("/", c.getAllowedGenders()) + ")"));
                allMet &= ok;
            }
        }

        // --- 4. Category / Community ---
        if (c.getAllowedCategories() != null && !c.getAllowedCategories().isEmpty()) {
            if (profile == null || isBlank(profile.getCategory())) {
                checks.add(unknown("Category requirement", String.join("/", c.getAllowedCategories())));
                missing.add("Community / Caste Certificate");
                anyUnknown = true;
            } else {
                boolean ok = isCategoryCompatible(c.getAllowedCategories(), profile.getCategory());
                checks.add(met(ok, "Category requirement", profile.getCategory() + " (eligible: " + String.join("/", c.getAllowedCategories()) + ")"));
                allMet &= ok;
            }
        }

        // --- 5. State of Residence ---
        if (c.getAllowedStates() != null && !c.getAllowedStates().isEmpty()) {
            if (profile == null || isBlank(profile.getState())) {
                checks.add(unknown("Residence requirement", String.join("/", c.getAllowedStates())));
                missing.add("State of residence (Residence / Nativity Certificate)");
                anyUnknown = true;
            } else {
                boolean ok = containsIgnoreCase(c.getAllowedStates(), profile.getState());
                checks.add(met(ok, "Residence requirement", profile.getState() + " (eligible: " + String.join("/", c.getAllowedStates()) + ")"));
                allMet &= ok;
            }
        }

        // --- 6. District Restriction ---
        if (c.getAllowedDistricts() != null && !c.getAllowedDistricts().isEmpty()) {
            if (profile == null || isBlank(profile.getDistrict())) {
                checks.add(unknown("District requirement", String.join("/", c.getAllowedDistricts())));
                missing.add("District of residence");
                anyUnknown = true;
            } else {
                boolean ok = containsIgnoreCase(c.getAllowedDistricts(), profile.getDistrict());
                checks.add(met(ok, "District requirement", profile.getDistrict() + " (eligible: " + String.join("/", c.getAllowedDistricts()) + ")"));
                allMet &= ok;
            }
        }

        // --- 7. Occupation ---
        if (c.getAllowedOccupations() != null && !c.getAllowedOccupations().isEmpty()) {
            if (profile == null || isBlank(profile.getOccupation())) {
                checks.add(unknown("Occupation requirement", String.join("/", c.getAllowedOccupations())));
                missing.add("Occupation / Employment Document");
                anyUnknown = true;
            } else {
                boolean ok = containsIgnoreCase(c.getAllowedOccupations(), profile.getOccupation());
                checks.add(met(ok, "Occupation requirement", profile.getOccupation() + " (eligible: " + String.join("/", c.getAllowedOccupations()) + ")"));
                allMet &= ok;
            }
        }

        // --- 8. Education Level ---
        if (c.getAllowedEducationLevels() != null && !c.getAllowedEducationLevels().isEmpty()) {
            if (profile == null || isBlank(profile.getEducation())) {
                checks.add(unknown("Education requirement", String.join("/", c.getAllowedEducationLevels())));
                missing.add("Education level (Student Certificate / Marksheet)");
                anyUnknown = true;
            } else {
                boolean ok = containsIgnoreCase(c.getAllowedEducationLevels(), profile.getEducation());
                checks.add(met(ok, "Education requirement", profile.getEducation() + " (eligible: " + String.join("/", c.getAllowedEducationLevels()) + ")"));
                allMet &= ok;
            }
        }

        // --- 9. Disability Status & Threshold ---
        if (Boolean.TRUE.equals(c.getRequiresDisability()) || c.getMinDisabilityPercentage() != null) {
            if (profile == null || profile.getDisability() == null) {
                checks.add(unknown("Disability requirement", "Disability Certificate / UDID required"));
                missing.add("Disability Certificate / UDID");
                anyUnknown = true;
            } else if (!Boolean.TRUE.equals(profile.getDisability())) {
                checks.add(met(false, "Disability requirement", "Required for this welfare scheme"));
                allMet = false;
            } else {
                if (c.getMinDisabilityPercentage() != null) {
                    if (profile.getDisabilityPercentage() == null) {
                        checks.add(unknown("Disability percentage", "Minimum " + c.getMinDisabilityPercentage() + "% required"));
                        missing.add("Disability percentage details");
                        anyUnknown = true;
                    } else {
                        boolean ok = profile.getDisabilityPercentage() >= c.getMinDisabilityPercentage();
                        checks.add(met(ok, "Disability percentage",
                                profile.getDisabilityPercentage() + "% (required min " + c.getMinDisabilityPercentage() + "%)"));
                        allMet &= ok;
                    }
                } else {
                    checks.add(met(true, "Disability requirement", "Verified"));
                }
            }
        }

        // --- 10. Student Status ---
        if (Boolean.TRUE.equals(c.getRequiresStudent())) {
            if (profile == null || profile.getIsStudent() == null) {
                checks.add(unknown("Student status", "Active Student status required"));
                missing.add("Student Bonafide / Enrollment Certificate");
                anyUnknown = true;
            } else {
                boolean ok = Boolean.TRUE.equals(profile.getIsStudent());
                checks.add(met(ok, "Student status", profile.getIsStudent() ? "Yes (Enrolled)" : "No"));
                allMet &= ok;
            }
        }

        // --- 11. Farmer Status ---
        if (Boolean.TRUE.equals(c.getRequiresFarmer())) {
            if (profile == null || profile.getIsFarmer() == null) {
                checks.add(unknown("Farmer status", "Farmer / Landholding required"));
                missing.add("Land records (Patta / Chitta / Adangal)");
                anyUnknown = true;
            } else {
                boolean ok = Boolean.TRUE.equals(profile.getIsFarmer());
                checks.add(met(ok, "Farmer status", profile.getIsFarmer() ? "Yes" : "No"));
                allMet &= ok;
            }
        }

        // --- 12. Landholding Limit ---
        if (c.getMaxLandHoldingAcres() != null) {
            if (profile == null || profile.getLandHoldingAcres() == null) {
                checks.add(unknown("Landholding limit", "Up to " + c.getMaxLandHoldingAcres() + " acres"));
                missing.add("Landholding extent details");
                anyUnknown = true;
            } else {
                boolean ok = profile.getLandHoldingAcres() <= c.getMaxLandHoldingAcres();
                checks.add(met(ok, "Landholding limit", profile.getLandHoldingAcres() + " acres (max allowed " + c.getMaxLandHoldingAcres() + ")"));
                allMet &= ok;
            }
        }

        // --- 13. Senior Citizen Status ---
        if (Boolean.TRUE.equals(c.getRequiresSeniorCitizen())) {
            if (profile == null || profile.getIsSeniorCitizen() == null) {
                if (profile != null && profile.getAge() != null) {
                    boolean ok = profile.getAge() >= 60;
                    checks.add(met(ok, "Senior citizen status", "Age " + profile.getAge() + (ok ? " (Senior Citizen)" : " (Under 60)")));
                    allMet &= ok;
                } else {
                    checks.add(unknown("Senior citizen status", "Age 60+ proof required"));
                    missing.add("Age proof (Aadhaar)");
                    anyUnknown = true;
                }
            } else {
                boolean ok = Boolean.TRUE.equals(profile.getIsSeniorCitizen());
                checks.add(met(ok, "Senior citizen status", profile.getIsSeniorCitizen() ? "Yes (60+)" : "No"));
                allMet &= ok;
            }
        }

        // --- Final Tri-State Decision ---
        String status;
        boolean eligible;
        String statusMessage;

        if (!allMet) {
            status = "NOT_ELIGIBLE";
            eligible = false;
            statusMessage = "Based on your socio-economic details, you do not meet all mandatory requirements for this scheme.";
        } else if (anyUnknown) {
            status = "NEEDS_VERIFICATION";
            eligible = false;
            statusMessage = "You appear potentially eligible, but some mandatory criteria require verified documents.";
        } else {
            status = "ELIGIBLE";
            eligible = true;
            statusMessage = "Based on the verified details provided, you appear to meet all listed eligibility criteria.";
        }

        return EligibilityResult.builder()
                .schemeId(scheme.getId())
                .eligible(eligible)
                .status(status)
                .statusMessage(statusMessage)
                .checks(checks)
                .missingInformation(missing)
                .build();
    }

    // ---------- Helper Methods ----------

    private EligibilityResult.CriterionCheck met(boolean ok, String label, String detail) {
        return EligibilityResult.CriterionCheck.builder()
                .label(label)
                .detail(detail)
                .status(ok ? "MET" : "NOT_MET")
                .build();
    }

    private EligibilityResult.CriterionCheck unknown(String label, String requirement) {
        return EligibilityResult.CriterionCheck.builder()
                .label(label)
                .detail("Required: " + requirement + " — not provided")
                .status("UNKNOWN")
                .build();
    }

    private boolean containsIgnoreCase(List<String> list, String value) {
        if (list == null || value == null) return false;
        return list.stream().anyMatch(v -> v.equalsIgnoreCase(value.trim()));
    }

    private boolean isCategoryCompatible(List<String> allowed, String citizenCategory) {
        if (allowed == null || citizenCategory == null) return false;
        String cat = citizenCategory.trim().toUpperCase();

        for (String a : allowed) {
            String target = a.trim().toUpperCase();
            if (target.equals(cat)) return true;

            // In India (e.g. TN/Central), BC and MBC are sub-categories under OBC
            if (target.equals("OBC") && (cat.equals("BC") || cat.equals("MBC") || cat.equals("OBC"))) {
                return true;
            }
            if ((target.equals("BC") || target.equals("MBC")) && cat.equals("OBC")) {
                return true;
            }
        }
        return false;
    }

    private boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }

    private String ageRangeLabel(Scheme.EligibilityCriteria c) {
        if (c.getMinAge() != null && c.getMaxAge() != null) return c.getMinAge() + "–" + c.getMaxAge() + " yrs";
        if (c.getMinAge() != null) return c.getMinAge() + "+ yrs";
        return "up to " + c.getMaxAge() + " yrs";
    }

    private String incomeRangeLabel(Scheme.EligibilityCriteria c) {
        if (c.getMaxIncome() != null && c.getMinIncome() != null) {
            return "between " + formatCurrency(c.getMinIncome()) + " and " + formatCurrency(c.getMaxIncome());
        }
        if (c.getMaxIncome() != null) return "under " + formatCurrency(c.getMaxIncome());
        return "above " + formatCurrency(c.getMinIncome());
    }

    private String formatCurrency(Double amount) {
        if (amount == null) return "₹0";
        if (amount >= 100000) {
            return String.format(Locale.US, "\u20b9%.1fL", amount / 100000);
        }
        return String.format(Locale.US, "\u20b9%,.0f", amount);
    }
}
