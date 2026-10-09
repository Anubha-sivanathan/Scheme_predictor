package com.schemepredictor.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Unified socio-economic profile for a citizen. This is the "data wallet"
 * information used by the eligibility rule engine and the recommendation model.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "profiles")
public class Profile {

    @Id
    private String id;

    @Indexed(unique = true)
    private String userId;

    private Integer age;
    private String gender;              // Male / Female / Other
    private String state;
    private String district;
    private Double income;              // Annual household income in INR
    private String occupation;
    private String education;
    private Integer familySize;
    private String category;            // General / OBC / SC / ST / EWS
    private Boolean disability;
    private Integer disabilityPercentage;
    private Double landHoldingAcres;
    private Boolean isStudent;
    private Boolean isFarmer;
    private Boolean isSeniorCitizen;
    private String employmentStatus;

    @LastModifiedDate
    private Instant updatedAt;

    /**
     * Fields checked for "profile completeness" scoring.
     * Kept in sync manually with ProfileService#REQUIRED_FIELDS.
     */
}
