package com.schemepredictor.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "schemes")
public class Scheme {

    @Id
    private String id;

    @Indexed
    private String name;

    private String department;

    @Indexed
    private String category;

    private String description;

    private List<String> benefits;

    /** Machine-checkable eligibility criteria used by the rule engine. */
    private EligibilityCriteria eligibilityCriteria;

    private List<String> requiredDocuments;

    private String applicationProcess;

    /** Real official URL only. Never fabricated. */
    private String applicationLink;

    private LocalDate deadline;

    @Builder.Default
    private String status = "ACTIVE"; // ACTIVE / INACTIVE / EXPIRED

    private Instant createdAt;
    private Instant updatedAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EligibilityCriteria {
        private Integer minAge;
        private Integer maxAge;
        private Double maxIncome;
        private Double minIncome;
        private List<String> allowedCategories;   // e.g. ["SC","ST","OBC","General","EWS"]
        private List<String> allowedStates;        // empty/null = all states
        private List<String> allowedOccupations;   // e.g. ["Farmer","Student"]
        private Boolean requiresDisability;
        private Boolean requiresStudent;
        private Boolean requiresFarmer;
        private Boolean requiresSeniorCitizen;
        private Double maxLandHoldingAcres;
        private List<String> allowedEducationLevels;
        private List<String> allowedGenders;        // e.g. ["Female"]
        private List<String> allowedDistricts;      // empty/null = all districts
        private Integer minDisabilityPercentage;   // e.g. 40
    }
}
