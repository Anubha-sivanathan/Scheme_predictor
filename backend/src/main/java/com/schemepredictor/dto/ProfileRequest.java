package com.schemepredictor.dto;

import lombok.Data;

@Data
public class ProfileRequest {
    private Integer age;
    private String gender;
    private String state;
    private String district;
    private Double income;
    private String occupation;
    private String education;
    private Integer familySize;
    private String category;
    private Boolean disability;
    private Integer disabilityPercentage;
    private Double landHoldingAcres;
    private Boolean isStudent;
    private Boolean isFarmer;
    private Boolean isSeniorCitizen;
    private String employmentStatus;
}
