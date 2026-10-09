package com.schemepredictor;

import com.schemepredictor.dto.EligibilityResult;
import com.schemepredictor.eligibility.EligibilityRuleEngine;
import com.schemepredictor.model.Profile;
import com.schemepredictor.model.Scheme;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

public class EligibilityRuleEngineTest {

    private EligibilityRuleEngine ruleEngine;

    @BeforeEach
    void setUp() {
        ruleEngine = new EligibilityRuleEngine();
    }

    @Test
    void testStudentProfile_EligibleForScholarship() {
        // Scheme: Post Matric Scholarship
        Scheme scholarship = Scheme.builder()
                .id("sch-1")
                .name("Post Matric Scholarship")
                .eligibilityCriteria(Scheme.EligibilityCriteria.builder()
                        .minAge(15)
                        .maxAge(30)
                        .maxIncome(250000.0)
                        .allowedCategories(List.of("SC", "ST", "OBC", "EWS"))
                        .requiresStudent(true)
                        .build())
                .build();

        // Archetype A: Student, 19, Female, BC (OBC-compatible), Income 75,000
        Profile student = Profile.builder()
                .age(19)
                .gender("Female")
                .district("Coimbatore")
                .state("Tamil Nadu")
                .income(75000.0)
                .category("BC")
                .education("UG")
                .isStudent(true)
                .isFarmer(false)
                .landHoldingAcres(0.0)
                .disability(false)
                .build();

        EligibilityResult result = ruleEngine.evaluate(scholarship, student);

        assertEquals("ELIGIBLE", result.getStatus());
        assertTrue(result.isEligible());
        assertTrue(result.getMissingInformation().isEmpty());
        assertTrue(result.getChecks().stream().allMatch(c -> "MET".equals(c.getStatus())));
    }

    @Test
    void testFarmerProfile_EligibleForPmKisan() {
        // Scheme: PM Kisan
        Scheme pmKisan = Scheme.builder()
                .id("pm-kisan")
                .name("PM Kisan Samman Nidhi")
                .eligibilityCriteria(Scheme.EligibilityCriteria.builder()
                        .minAge(18)
                        .requiresFarmer(true)
                        .maxLandHoldingAcres(5.0)
                        .build())
                .build();

        // Archetype B: Farmer, 45, Land 3.5 acres
        Profile farmer = Profile.builder()
                .age(45)
                .gender("Male")
                .state("Tamil Nadu")
                .district("Coimbatore")
                .occupation("Farmer")
                .isFarmer(true)
                .landHoldingAcres(3.5)
                .income(120000.0)
                .build();

        EligibilityResult result = ruleEngine.evaluate(pmKisan, farmer);

        assertEquals("ELIGIBLE", result.getStatus());
        assertTrue(result.isEligible());
    }

    @Test
    void testSeniorCitizen_EligibleForOldAgePension() {
        // Scheme: Old Age Pension
        Scheme pension = Scheme.builder()
                .id("oap")
                .name("Old Age Pension Scheme")
                .eligibilityCriteria(Scheme.EligibilityCriteria.builder()
                        .minAge(60)
                        .maxIncome(150000.0)
                        .requiresSeniorCitizen(true)
                        .build())
                .build();

        // Archetype C: Age 65, Low income
        Profile senior = Profile.builder()
                .age(65)
                .isSeniorCitizen(true)
                .income(80000.0)
                .gender("Female")
                .state("Tamil Nadu")
                .build();

        EligibilityResult result = ruleEngine.evaluate(pension, senior);

        assertEquals("ELIGIBLE", result.getStatus());
        assertTrue(result.isEligible());
    }

    @Test
    void testDisabledCitizen_EligibleForAdip() {
        // Scheme: ADIP Disability Support
        Scheme adip = Scheme.builder()
                .id("adip")
                .name("ADIP Scheme")
                .eligibilityCriteria(Scheme.EligibilityCriteria.builder()
                        .maxIncome(300000.0)
                        .requiresDisability(true)
                        .minDisabilityPercentage(40)
                        .build())
                .build();

        // Archetype D: Disability 60%
        Profile disabled = Profile.builder()
                .age(30)
                .disability(true)
                .disabilityPercentage(60)
                .income(100000.0)
                .build();

        EligibilityResult result = ruleEngine.evaluate(adip, disabled);

        assertEquals("ELIGIBLE", result.getStatus());
        assertTrue(result.isEligible());
    }

    @Test
    void testHighIncome_NotEligible() {
        Scheme scholarship = Scheme.builder()
                .id("sch-1")
                .name("Post Matric Scholarship")
                .eligibilityCriteria(Scheme.EligibilityCriteria.builder()
                        .maxIncome(250000.0)
                        .requiresStudent(true)
                        .build())
                .build();

        // Archetype E: Income ₹15,00,000 exceeds ₹2,50,000 limit
        Profile highIncome = Profile.builder()
                .age(20)
                .income(1500000.0)
                .isStudent(true)
                .build();

        EligibilityResult result = ruleEngine.evaluate(scholarship, highIncome);

        assertEquals("NOT_ELIGIBLE", result.getStatus());
        assertFalse(result.isEligible());
        assertTrue(result.getChecks().stream().anyMatch(c -> "NOT_MET".equals(c.getStatus())));
    }

    @Test
    void testMissingInformation_NeedsVerification() {
        Scheme scholarship = Scheme.builder()
                .id("sch-1")
                .name("Post Matric Scholarship")
                .eligibilityCriteria(Scheme.EligibilityCriteria.builder()
                        .minAge(15)
                        .maxAge(30)
                        .maxIncome(250000.0)
                        .requiresStudent(true)
                        .build())
                .build();

        // Archetype F: Empty profile with no verified documents
        Profile emptyProfile = Profile.builder().build();

        EligibilityResult result = ruleEngine.evaluate(scholarship, emptyProfile);

        assertEquals("NEEDS_VERIFICATION", result.getStatus());
        assertFalse(result.isEligible());
        assertFalse(result.getMissingInformation().isEmpty());
        assertTrue(result.getChecks().stream().anyMatch(c -> "UNKNOWN".equals(c.getStatus())));
    }
}
