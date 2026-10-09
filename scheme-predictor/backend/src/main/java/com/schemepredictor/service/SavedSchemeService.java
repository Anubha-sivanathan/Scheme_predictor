package com.schemepredictor.service;

import com.schemepredictor.exception.BadRequestException;
import com.schemepredictor.model.SavedScheme;
import com.schemepredictor.repository.SavedSchemeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SavedSchemeService {

    private final SavedSchemeRepository savedSchemeRepository;

    public void save(String userId, String schemeId) {
        if (savedSchemeRepository.existsByUserIdAndSchemeId(userId, schemeId)) {
            return; // already saved, idempotent
        }
        SavedScheme saved = SavedScheme.builder()
                .userId(userId)
                .schemeId(schemeId)
                .savedAt(Instant.now())
                .build();
        savedSchemeRepository.save(saved);
    }

    public void unsave(String userId, String schemeId) {
        savedSchemeRepository.deleteByUserIdAndSchemeId(userId, schemeId);
    }

    public List<SavedScheme> list(String userId) {
        return savedSchemeRepository.findByUserId(userId);
    }

    public Set<String> savedSchemeIds(String userId) {
        return list(userId).stream().map(SavedScheme::getSchemeId).collect(Collectors.toSet());
    }

    public boolean isSaved(String userId, String schemeId) {
        return savedSchemeRepository.existsByUserIdAndSchemeId(userId, schemeId);
    }
}
