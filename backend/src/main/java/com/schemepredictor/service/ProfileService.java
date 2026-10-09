package com.schemepredictor.service;

import com.schemepredictor.dto.ProfileRequest;
import com.schemepredictor.exception.ResourceNotFoundException;
import com.schemepredictor.model.Profile;
import com.schemepredictor.repository.ProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ProfileService {

    private final ProfileRepository profileRepository;

    /** Fields counted toward "profile completion %". Kept small & meaningful rather than exhaustive. */
    private static final List<String> REQUIRED_FIELDS = Arrays.asList(
            "age", "gender", "state", "district", "income", "occupation", "education", "category"
    );

    public Profile getByUserId(String userId) {
        return profileRepository.findByUserId(userId)
                .orElseGet(() -> profileRepository.save(Profile.builder().userId(userId).build()));
    }

    public Profile update(String userId, ProfileRequest req) {
        Profile profile = profileRepository.findByUserId(userId)
                .orElse(Profile.builder().userId(userId).build());

        if (req.getAge() != null) profile.setAge(req.getAge());
        if (req.getGender() != null) profile.setGender(req.getGender());
        if (req.getState() != null) profile.setState(req.getState());
        if (req.getDistrict() != null) profile.setDistrict(req.getDistrict());
        if (req.getIncome() != null) profile.setIncome(req.getIncome());
        if (req.getOccupation() != null) profile.setOccupation(req.getOccupation());
        if (req.getEducation() != null) profile.setEducation(req.getEducation());
        if (req.getFamilySize() != null) profile.setFamilySize(req.getFamilySize());
        if (req.getCategory() != null) profile.setCategory(req.getCategory());
        if (req.getDisability() != null) profile.setDisability(req.getDisability());
        if (req.getDisabilityPercentage() != null) profile.setDisabilityPercentage(req.getDisabilityPercentage());
        if (req.getLandHoldingAcres() != null) profile.setLandHoldingAcres(req.getLandHoldingAcres());
        if (req.getIsStudent() != null) profile.setIsStudent(req.getIsStudent());
        if (req.getIsFarmer() != null) profile.setIsFarmer(req.getIsFarmer());
        if (req.getIsSeniorCitizen() != null) profile.setIsSeniorCitizen(req.getIsSeniorCitizen());
        if (req.getEmploymentStatus() != null) profile.setEmploymentStatus(req.getEmploymentStatus());

        profile.setUpdatedAt(Instant.now());
        return profileRepository.save(profile);
    }

    /** Returns 0-100 completion percentage based on REQUIRED_FIELDS being populated. */
    public int completionPercentage(Profile profile) {
        int filled = 0;
        if (profile.getAge() != null) filled++;
        if (notBlank(profile.getGender())) filled++;
        if (notBlank(profile.getState())) filled++;
        if (notBlank(profile.getDistrict())) filled++;
        if (profile.getIncome() != null) filled++;
        if (notBlank(profile.getOccupation())) filled++;
        if (notBlank(profile.getEducation())) filled++;
        if (notBlank(profile.getCategory())) filled++;

        return (int) Math.round((filled * 100.0) / REQUIRED_FIELDS.size());
    }

    public List<String> missingFields(Profile profile) {
        List<String> missing = new java.util.ArrayList<>();
        if (profile.getAge() == null) missing.add("Age");
        if (!notBlank(profile.getGender())) missing.add("Gender");
        if (!notBlank(profile.getState())) missing.add("State");
        if (!notBlank(profile.getDistrict())) missing.add("District");
        if (profile.getIncome() == null) missing.add("Annual income");
        if (!notBlank(profile.getOccupation())) missing.add("Occupation");
        if (!notBlank(profile.getEducation())) missing.add("Education");
        if (!notBlank(profile.getCategory())) missing.add("Category");
        return missing;
    }

    private boolean notBlank(String s) {
        return s != null && !s.trim().isEmpty();
    }
}
