package com.schemepredictor.service;

import com.schemepredictor.dto.EligibilityResult;
import com.schemepredictor.eligibility.EligibilityRuleEngine;
import com.schemepredictor.model.Profile;
import com.schemepredictor.model.Scheme;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class EligibilityService {

    private final EligibilityRuleEngine ruleEngine;

    /** The rule engine is the sole authority on eligibility — nothing else may override it. */
    public EligibilityResult check(Scheme scheme, Profile profile) {
        return ruleEngine.evaluate(scheme, profile);
    }
}
