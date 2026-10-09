package com.schemepredictor.service;

import com.schemepredictor.model.DocumentRecord;
import com.schemepredictor.model.Profile;
import com.schemepredictor.repository.DocumentRepository;
import com.schemepredictor.repository.ProfileRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.Period;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

/**
 * Normalizes verified citizen documents into the Unified Data Wallet (Profile).
 *
 * Follows core project principle:
 * Unverified OCR data is NEVER treated as final. Only citizen-confirmed/verified
 * fields are normalized and synced into the unified citizen profile.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ProfileNormalizationService {

    private final ProfileRepository profileRepository;
    private final DocumentRepository documentRepository;

    /**
     * Syncs a single newly verified document into the citizen's unified profile.
     */
    public Profile syncVerifiedDocumentToProfile(String userId, DocumentRecord doc) {
        Profile profile = profileRepository.findByUserId(userId)
                .orElseGet(() -> Profile.builder().userId(userId).build());

        applyDocumentFields(profile, doc);
        profile.setUpdatedAt(Instant.now());
        Profile saved = profileRepository.save(profile);
        log.info("Synced verified document {} ({}) to profile for user {}", doc.getId(), doc.getDocumentType(), userId);
        return saved;
    }

    /**
     * Syncs all verified documents belonging to a citizen into their unified profile.
     */
    public Profile syncAllVerifiedDocuments(String userId) {
        Profile profile = profileRepository.findByUserId(userId)
                .orElseGet(() -> Profile.builder().userId(userId).build());

        List<DocumentRecord> verifiedDocs = documentRepository.findByUserId(userId).stream()
                .filter(d -> "VERIFIED".equalsIgnoreCase(d.getVerificationStatus()))
                .toList();

        for (DocumentRecord doc : verifiedDocs) {
            applyDocumentFields(profile, doc);
        }

        profile.setUpdatedAt(Instant.now());
        return profileRepository.save(profile);
    }

    private void applyDocumentFields(Profile profile, DocumentRecord doc) {
        Map<String, String> f = doc.getVerifiedFields();
        if (f == null || f.isEmpty()) {
            return;
        }

        String type = doc.getDocumentType() == null ? "" : doc.getDocumentType().toUpperCase();

        switch (type) {
            case "AADHAAR" -> applyAadhaar(profile, f);
            case "INCOME_CERTIFICATE" -> applyIncome(profile, f);
            case "CASTE_CERTIFICATE", "COMMUNITY_CERTIFICATE" -> applyCaste(profile, f);
            case "RESIDENCE_CERTIFICATE", "NATIVITY_CERTIFICATE" -> applyResidence(profile, f);
            case "RATION_CARD", "FAMILY_CARD" -> applyRationCard(profile, f);
            case "EDUCATION", "EDUCATION_CERTIFICATE", "STUDENT_CERTIFICATE" -> applyEducation(profile, f);
            case "DISABILITY", "DISABILITY_CERTIFICATE" -> applyDisability(profile, f);
            case "LAND", "LAND_DOCUMENT", "PATTA_CHITTA" -> applyLand(profile, f);
            case "EMPLOYMENT", "EMPLOYMENT_DOCUMENT", "LABOUR_DOCUMENT" -> applyEmployment(profile, f);
            case "BANK_PASSBOOK", "BANK" -> applyBankPassbook(profile, f);
            default -> log.debug("No specialized normalization for document type: {}", type);
        }
    }

    private void applyAadhaar(Profile profile, Map<String, String> f) {
        if (f.containsKey("gender") && isNotBlank(f.get("gender"))) {
            profile.setGender(f.get("gender").trim());
        }

        Integer calculatedAge = null;
        if (f.containsKey("dateOfBirth") && isNotBlank(f.get("dateOfBirth"))) {
            calculatedAge = calculateAgeFromDob(f.get("dateOfBirth"));
        }
        if (calculatedAge == null && f.containsKey("yearOfBirth") && isNotBlank(f.get("yearOfBirth"))) {
            calculatedAge = calculateAgeFromYear(f.get("yearOfBirth"));
        }

        if (calculatedAge != null && calculatedAge > 0) {
            profile.setAge(calculatedAge);
            if (calculatedAge >= 60) {
                profile.setIsSeniorCitizen(true);
            }
        }

        if (f.containsKey("state") && isNotBlank(f.get("state"))) {
            profile.setState(f.get("state").trim());
        }
        if (f.containsKey("district") && isNotBlank(f.get("district"))) {
            profile.setDistrict(f.get("district").trim());
        }
    }

    private void applyIncome(Profile profile, Map<String, String> f) {
        if (f.containsKey("annualIncome") && isNotBlank(f.get("annualIncome"))) {
            try {
                double income = Double.parseDouble(f.get("annualIncome").replaceAll("[^0-9.]", ""));
                profile.setIncome(income);
            } catch (NumberFormatException e) {
                log.warn("Failed to parse annual income: {}", f.get("annualIncome"));
            }
        }
        if (f.containsKey("district") && isNotBlank(f.get("district")) && isBlank(profile.getDistrict())) {
            profile.setDistrict(f.get("district").trim());
        }
    }

    private void applyCaste(Profile profile, Map<String, String> f) {
        if (f.containsKey("category") && isNotBlank(f.get("category"))) {
            profile.setCategory(f.get("category").trim());
        }
    }

    private void applyResidence(Profile profile, Map<String, String> f) {
        if (f.containsKey("state") && isNotBlank(f.get("state"))) {
            profile.setState(f.get("state").trim());
        }
        if (f.containsKey("district") && isNotBlank(f.get("district"))) {
            profile.setDistrict(f.get("district").trim());
        }
    }

    private void applyRationCard(Profile profile, Map<String, String> f) {
        if (f.containsKey("familySize") && isNotBlank(f.get("familySize"))) {
            try {
                int size = Integer.parseInt(f.get("familySize").replaceAll("[^0-9]", ""));
                profile.setFamilySize(size);
            } catch (NumberFormatException ignored) {
            }
        }
    }

    private void applyEducation(Profile profile, Map<String, String> f) {
        if (f.containsKey("educationLevel") && isNotBlank(f.get("educationLevel"))) {
            profile.setEducation(f.get("educationLevel").trim());
        } else if (f.containsKey("course") && isNotBlank(f.get("course")) && isBlank(profile.getEducation())) {
            profile.setEducation(f.get("course").trim());
        }

        String status = f.get("studentStatus");
        if (status == null || !status.equalsIgnoreCase("Completed")) {
            profile.setIsStudent(true);
        }
    }

    private void applyDisability(Profile profile, Map<String, String> f) {
        profile.setDisability(true);
        if (f.containsKey("disabilityPercentage") && isNotBlank(f.get("disabilityPercentage"))) {
            try {
                int pct = Integer.parseInt(f.get("disabilityPercentage").replaceAll("[^0-9]", ""));
                profile.setDisabilityPercentage(pct);
            } catch (NumberFormatException ignored) {
            }
        }
    }

    private void applyLand(Profile profile, Map<String, String> f) {
        if (f.containsKey("landHoldingAcres") && isNotBlank(f.get("landHoldingAcres"))) {
            try {
                double acres = Double.parseDouble(f.get("landHoldingAcres").replaceAll("[^0-9.]", ""));
                profile.setLandHoldingAcres(acres);
                if (acres > 0) {
                    profile.setIsFarmer(true);
                }
            } catch (NumberFormatException ignored) {
            }
        } else {
            profile.setIsFarmer(true);
        }
    }

    private void applyEmployment(Profile profile, Map<String, String> f) {
        if (f.containsKey("occupation") && isNotBlank(f.get("occupation"))) {
            profile.setOccupation(f.get("occupation").trim());
            if (f.get("occupation").toLowerCase().contains("farmer") ||
                f.get("occupation").toLowerCase().contains("agricultural")) {
                profile.setIsFarmer(true);
            }
        }
        if (f.containsKey("employmentStatus") && isNotBlank(f.get("employmentStatus"))) {
            profile.setEmploymentStatus(f.get("employmentStatus").trim());
            if (f.get("employmentStatus").equalsIgnoreCase("Student")) {
                profile.setIsStudent(true);
            }
        }
        if (f.containsKey("annualIncome") && isNotBlank(f.get("annualIncome")) && profile.getIncome() == null) {
            try {
                double income = Double.parseDouble(f.get("annualIncome").replaceAll("[^0-9.]", ""));
                profile.setIncome(income);
            } catch (NumberFormatException ignored) {
            }
        }
    }

    private void applyBankPassbook(Profile profile, Map<String, String> f) {
        // Bank details primarily provide DBT payment routing; no direct socio-economic field to override
    }

    private Integer calculateAgeFromDob(String dobStr) {
        if (dobStr == null) return null;
        String clean = dobStr.replace(".", "/").replace("-", "/");
        String[] parts = clean.split("/");
        if (parts.length == 3) {
            try {
                int d = Integer.parseInt(parts[0]);
                int m = Integer.parseInt(parts[1]);
                int y = Integer.parseInt(parts[2]);
                if (y < 100) y += 2000;
                LocalDate birthDate = LocalDate.of(y, m, d);
                return Period.between(birthDate, LocalDate.now()).getYears();
            } catch (Exception ignored) {
            }
        }
        return null;
    }

    private Integer calculateAgeFromYear(String yearStr) {
        try {
            int y = Integer.parseInt(yearStr.trim());
            return LocalDate.now().getYear() - y;
        } catch (Exception ignored) {
            return null;
        }
    }

    private boolean isNotBlank(String s) {
        return s != null && !s.trim().isEmpty();
    }

    private boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }
}
