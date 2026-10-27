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
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Normalizes verified citizen documents into the Unified Data Wallet (Profile).
 *
 * Follows core project principle:
 * Unverified OCR data is NEVER treated as final. Only citizen-confirmed/verified
 * fields are normalized and synced into the unified citizen profile.
 *
 * A value already on the profile is never replaced silently: blank profile fields are filled, identical
 * values are left alone, and differing values are reported as {@link Conflict}s for the citizen to
 * accept or reject (see {@link #applyAcceptedChanges}).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ProfileNormalizationService {

    /** A profile field whose document value differs from what the profile already holds. */
    public record Conflict(String field, Object current, Object proposed) {}

    private final ProfileRepository profileRepository;
    private final DocumentRepository documentRepository;

    /**
     * Syncs a single newly verified document into the citizen's unified profile.
     * Only fills blank fields; conflicts are left for the citizen to review.
     */
    public Profile syncVerifiedDocumentToProfile(String userId, DocumentRecord doc) {
        Profile profile = loadProfile(userId);
        int filled = fillBlanks(profile, doc);
        profile.setUpdatedAt(Instant.now());
        Profile saved = profileRepository.save(profile);
        log.info("Synced verified document {} ({}) to profile for user {}: {} field(s) filled",
                doc.getId(), doc.getDocumentType(), userId, filled);
        return saved;
    }

    /**
     * Syncs all verified documents belonging to a citizen into their unified profile (blank fields only).
     */
    public Profile syncAllVerifiedDocuments(String userId) {
        Profile profile = loadProfile(userId);

        List<DocumentRecord> verifiedDocs = documentRepository.findByUserId(userId).stream()
                .filter(d -> "VERIFIED".equalsIgnoreCase(d.getVerificationStatus()))
                .toList();

        for (DocumentRecord doc : verifiedDocs) {
            fillBlanks(profile, doc);
        }

        profile.setUpdatedAt(Instant.now());
        return profileRepository.save(profile);
    }

    /** Profile fields where this document's verified values differ from the current profile. */
    public List<Conflict> findConflicts(String userId, DocumentRecord doc) {
        Profile profile = profileRepository.findByUserId(userId).orElseGet(() -> Profile.builder().userId(userId).build());
        List<Conflict> conflicts = new ArrayList<>();
        proposals(profile, doc).forEach((field, proposed) -> {
            Object current = read(profile, field);
            if (!isEmpty(current) && !sameValue(current, proposed)) {
                conflicts.add(new Conflict(field, current, proposed));
            }
        });
        return conflicts;
    }

    /** Overwrites only the named fields, and only where the document actually proposes a value. */
    public Profile applyAcceptedChanges(String userId, DocumentRecord doc, Set<String> acceptedFields) {
        Profile profile = loadProfile(userId);
        Map<String, Object> proposals = proposals(profile, doc);
        int applied = 0;
        for (String field : acceptedFields) {
            if (proposals.containsKey(field)) {
                write(profile, field, proposals.get(field));
                applied++;
            }
        }
        profile.setUpdatedAt(Instant.now());
        Profile saved = profileRepository.save(profile);
        log.info("User {} accepted {} profile change(s) from document {}", userId, applied, doc.getId());
        return saved;
    }

    private Profile loadProfile(String userId) {
        return profileRepository.findByUserId(userId)
                .orElseGet(() -> Profile.builder().userId(userId).build());
    }

    private int fillBlanks(Profile profile, DocumentRecord doc) {
        int filled = 0;
        for (Map.Entry<String, Object> e : proposals(profile, doc).entrySet()) {
            if (isEmpty(read(profile, e.getKey()))) {
                write(profile, e.getKey(), e.getValue());
                filled++;
            }
        }
        return filled;
    }

    // ---- Proposals: what a verified document says about each profile field ----

    private Map<String, Object> proposals(Profile profile, DocumentRecord doc) {
        Map<String, Object> out = new LinkedHashMap<>();
        Map<String, String> f = doc.getVerifiedFields();
        if (f == null || f.isEmpty()) {
            return out;
        }

        String type = doc.getDocumentType() == null ? "" : doc.getDocumentType().toUpperCase();

        switch (type) {
            case "AADHAAR" -> proposeAadhaar(out, f);
            case "INCOME_CERTIFICATE" -> proposeIncome(out, profile, f);
            case "CASTE_CERTIFICATE", "COMMUNITY_CERTIFICATE" -> put(out, "category", text(f, "category"));
            case "RESIDENCE_CERTIFICATE", "NATIVITY_CERTIFICATE" -> {
                put(out, "state", text(f, "state"));
                put(out, "district", text(f, "district"));
            }
            case "RATION_CARD", "FAMILY_CARD" -> put(out, "familySize", integer(f, "familySize"));
            case "EDUCATION", "EDUCATION_CERTIFICATE", "STUDENT_CERTIFICATE" -> proposeEducation(out, profile, f);
            case "DISABILITY", "DISABILITY_CERTIFICATE" -> proposeDisability(out, f);
            case "LAND", "LAND_DOCUMENT", "PATTA_CHITTA" -> proposeLand(out, f);
            case "EMPLOYMENT", "EMPLOYMENT_DOCUMENT", "LABOUR_DOCUMENT" -> proposeEmployment(out, profile, f);
            case "BANK_PASSBOOK", "BANK" -> { /* Bank details only route DBT payments; nothing socio-economic. */ }
            default -> log.debug("No specialized normalization for document type: {}", type);
        }
        return out;
    }

    private void proposeAadhaar(Map<String, Object> out, Map<String, String> f) {
        put(out, "fullName", text(f, "name"));
        put(out, "gender", text(f, "gender"));
        put(out, "dateOfBirth", text(f, "dateOfBirth"));

        Integer age = null;
        if (text(f, "dateOfBirth") != null) {
            age = calculateAgeFromDob(text(f, "dateOfBirth"));
        }
        if (age == null && text(f, "yearOfBirth") != null) {
            age = calculateAgeFromYear(text(f, "yearOfBirth"));
        }
        if (age != null && age > 0) {
            put(out, "age", age);
            if (age >= 60) {
                put(out, "isSeniorCitizen", true);
            }
        }

        put(out, "state", text(f, "state"));
        put(out, "district", text(f, "district"));
        put(out, "pinCode", text(f, "pinCode"));
        put(out, "address", text(f, "address"));
    }

    private void proposeIncome(Map<String, Object> out, Profile profile, Map<String, String> f) {
        put(out, "income", number(f, "annualIncome"));
        // District on an income certificate is only a fallback for a profile with no district yet.
        if (isEmpty(profile.getDistrict())) {
            put(out, "district", text(f, "district"));
        }
    }

    private void proposeEducation(Map<String, Object> out, Profile profile, Map<String, String> f) {
        if (text(f, "educationLevel") != null) {
            put(out, "education", text(f, "educationLevel"));
        } else if (isEmpty(profile.getEducation())) {
            put(out, "education", text(f, "course"));
        }
        String status = f.get("studentStatus");
        if (status == null || !status.equalsIgnoreCase("Completed")) {
            put(out, "isStudent", true);
        }
    }

    private void proposeDisability(Map<String, Object> out, Map<String, String> f) {
        put(out, "disability", true);
        put(out, "disabilityPercentage", integer(f, "disabilityPercentage"));
    }

    private void proposeLand(Map<String, Object> out, Map<String, String> f) {
        Double acres = number(f, "landHoldingAcres");
        if (acres != null) {
            put(out, "landHoldingAcres", acres);
            if (acres > 0) {
                put(out, "isFarmer", true);
            }
        } else {
            put(out, "isFarmer", true);
        }
    }

    private void proposeEmployment(Map<String, Object> out, Profile profile, Map<String, String> f) {
        String occupation = text(f, "occupation");
        if (occupation != null) {
            put(out, "occupation", occupation);
            String lower = occupation.toLowerCase();
            if (lower.contains("farmer") || lower.contains("agricultural")) {
                put(out, "isFarmer", true);
            }
        }
        String status = text(f, "employmentStatus");
        if (status != null) {
            put(out, "employmentStatus", status);
            if (status.equalsIgnoreCase("Student")) {
                put(out, "isStudent", true);
            }
        }
        if (profile.getIncome() == null) {
            put(out, "income", number(f, "annualIncome"));
        }
    }

    // ---- Profile field access by name ----

    private static Object read(Profile p, String field) {
        return switch (field) {
            case "fullName" -> p.getFullName();
            case "dateOfBirth" -> p.getDateOfBirth();
            case "age" -> p.getAge();
            case "gender" -> p.getGender();
            case "state" -> p.getState();
            case "district" -> p.getDistrict();
            case "pinCode" -> p.getPinCode();
            case "address" -> p.getAddress();
            case "income" -> p.getIncome();
            case "occupation" -> p.getOccupation();
            case "education" -> p.getEducation();
            case "familySize" -> p.getFamilySize();
            case "category" -> p.getCategory();
            case "disability" -> p.getDisability();
            case "disabilityPercentage" -> p.getDisabilityPercentage();
            case "landHoldingAcres" -> p.getLandHoldingAcres();
            case "isStudent" -> p.getIsStudent();
            case "isFarmer" -> p.getIsFarmer();
            case "isSeniorCitizen" -> p.getIsSeniorCitizen();
            case "employmentStatus" -> p.getEmploymentStatus();
            default -> throw new IllegalArgumentException("Unknown profile field: " + field);
        };
    }

    private static void write(Profile p, String field, Object v) {
        switch (field) {
            case "fullName" -> p.setFullName((String) v);
            case "dateOfBirth" -> p.setDateOfBirth((String) v);
            case "age" -> p.setAge((Integer) v);
            case "gender" -> p.setGender((String) v);
            case "state" -> p.setState((String) v);
            case "district" -> p.setDistrict((String) v);
            case "pinCode" -> p.setPinCode((String) v);
            case "address" -> p.setAddress((String) v);
            case "income" -> p.setIncome((Double) v);
            case "occupation" -> p.setOccupation((String) v);
            case "education" -> p.setEducation((String) v);
            case "familySize" -> p.setFamilySize((Integer) v);
            case "category" -> p.setCategory((String) v);
            case "disability" -> p.setDisability((Boolean) v);
            case "disabilityPercentage" -> p.setDisabilityPercentage((Integer) v);
            case "landHoldingAcres" -> p.setLandHoldingAcres((Double) v);
            case "isStudent" -> p.setIsStudent((Boolean) v);
            case "isFarmer" -> p.setIsFarmer((Boolean) v);
            case "isSeniorCitizen" -> p.setIsSeniorCitizen((Boolean) v);
            case "employmentStatus" -> p.setEmploymentStatus((String) v);
            default -> throw new IllegalArgumentException("Unknown profile field: " + field);
        }
    }

    // ---- Value helpers ----

    private static void put(Map<String, Object> out, String field, Object value) {
        if (value != null) {
            out.put(field, value);
        }
    }

    private static String text(Map<String, String> f, String key) {
        String v = f.get(key);
        return v == null || v.trim().isEmpty() ? null : v.trim();
    }

    private Integer integer(Map<String, String> f, String key) {
        String v = text(f, key);
        if (v == null) return null;
        try {
            return Integer.parseInt(v.replaceAll("[^0-9]", ""));
        } catch (NumberFormatException e) {
            log.warn("Could not parse numeric value for {}", key);
            return null;
        }
    }

    private Double number(Map<String, String> f, String key) {
        String v = text(f, key);
        if (v == null) return null;
        try {
            return Double.parseDouble(v.replaceAll("[^0-9.]", ""));
        } catch (NumberFormatException e) {
            log.warn("Could not parse numeric value for {}", key);
            return null;
        }
    }

    private static boolean isEmpty(Object v) {
        return v == null || (v instanceof String s && s.trim().isEmpty());
    }

    private static boolean sameValue(Object a, Object b) {
        if (a instanceof Number x && b instanceof Number y) {
            return Double.compare(x.doubleValue(), y.doubleValue()) == 0;
        }
        if (a instanceof String x && b instanceof String y) {
            return x.trim().equalsIgnoreCase(y.trim());
        }
        return a.equals(b);
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
}
