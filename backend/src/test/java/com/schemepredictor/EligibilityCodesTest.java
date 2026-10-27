package com.schemepredictor;

import com.schemepredictor.dto.EligibilityResult;
import com.schemepredictor.eligibility.EligibilityRuleEngine;
import com.schemepredictor.model.Profile;
import com.schemepredictor.model.Scheme;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** The English text must stay as it was; the new codes/params are what translated clients render. */
class EligibilityCodesTest {

    private final EligibilityRuleEngine engine = new EligibilityRuleEngine();

    private Scheme scheme(Scheme.EligibilityCriteria c) {
        return Scheme.builder().id("s").name("S").eligibilityCriteria(c).build();
    }

    @Test
    void metCheckCarriesCodeAndRawValuesAndKeepsEnglishText() {
        Scheme s = scheme(Scheme.EligibilityCriteria.builder().minAge(15).maxAge(30).build());
        EligibilityResult r = engine.evaluate(s, Profile.builder().age(19).build());

        EligibilityResult.CriterionCheck c = r.getChecks().get(0);
        assertEquals("AGE", c.getCode());
        assertEquals("Age requirement", c.getLabel());
        assertEquals("19 yrs (required 15–30 yrs)", c.getDetail());
        assertEquals("19", c.getParams().get("actual"));
        assertEquals("15", c.getParams().get("min"));
        assertEquals("30", c.getParams().get("max"));
    }

    @Test
    void missingInformationHasParallelCodes() {
        Scheme s = scheme(Scheme.EligibilityCriteria.builder()
                .maxIncome(250000.0).requiresStudent(true).build());
        EligibilityResult r = engine.evaluate(s, Profile.builder().build());

        assertEquals(r.getMissingInformation().size(), r.getMissingCodes().size());
        assertEquals(List.of("INCOME", "STUDENT"), r.getMissingCodes());
        assertTrue(r.getMissingCodes().stream().noneMatch(java.util.Objects::isNull),
                "every missing-information text must have a code");
        EligibilityResult.CriterionCheck income = r.getChecks().get(0);
        assertEquals("UNKNOWN", income.getStatus());
        assertEquals("250000.0", income.getParams().get("max"));
        assertNull(income.getParams().get("actual"), "no value was provided");
    }

    @Test
    void everyCheckTheEngineCanProduceHasACode() {
        Scheme.EligibilityCriteria all = Scheme.EligibilityCriteria.builder()
                .minAge(18).maxIncome(1e6).allowedGenders(List.of("Female")).allowedCategories(List.of("SC"))
                .allowedStates(List.of("Tamil Nadu")).allowedDistricts(List.of("Chennai"))
                .allowedOccupations(List.of("Farmer")).allowedEducationLevels(List.of("Graduate"))
                .requiresDisability(true).minDisabilityPercentage(40).requiresStudent(true)
                .requiresFarmer(true).maxLandHoldingAcres(5.0).requiresSeniorCitizen(true).build();

        for (Profile p : new Profile[]{null, Profile.builder().build(), Profile.builder().age(70).income(1000.0)
                .gender("Female").category("SC").state("Tamil Nadu").district("Chennai").occupation("Farmer")
                .education("Graduate").disability(true).disabilityPercentage(50).isStudent(true).isFarmer(true)
                .landHoldingAcres(2.0).isSeniorCitizen(true).build()}) {
            EligibilityResult r = engine.evaluate(scheme(all), p);
            r.getChecks().forEach(c -> assertNotNull(c.getCode(), "no code for: " + c.getLabel()));
            assertTrue(r.getMissingCodes().stream().noneMatch(java.util.Objects::isNull));
        }
    }

    @Test
    void unconfiguredSchemeIsMarkedWithItsOwnCode() {
        EligibilityResult r = engine.evaluate(scheme(null), Profile.builder().build());
        assertEquals("UNCONFIGURED", r.getChecks().get(0).getCode());
    }
}
