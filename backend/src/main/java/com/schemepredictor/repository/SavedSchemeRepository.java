package com.schemepredictor.repository;

import com.schemepredictor.model.SavedScheme;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface SavedSchemeRepository extends MongoRepository<SavedScheme, String> {
    List<SavedScheme> findByUserId(String userId);
    Optional<SavedScheme> findByUserIdAndSchemeId(String userId, String schemeId);
    void deleteByUserIdAndSchemeId(String userId, String schemeId);
    boolean existsByUserIdAndSchemeId(String userId, String schemeId);
}
