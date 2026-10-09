package com.schemepredictor.repository;

import com.schemepredictor.model.StagingScheme;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface StagingSchemeRepository extends MongoRepository<StagingScheme, String> {

    List<StagingScheme> findByReviewStatusOrderByCreatedAtDesc(String reviewStatus);

    List<StagingScheme> findAllByOrderByCreatedAtDesc();

    Optional<StagingScheme> findBySourceSystemAndExternalIdAndReviewStatus(
            String sourceSystem, String externalId, String reviewStatus);

    Optional<StagingScheme> findByContentHashAndReviewStatus(String contentHash, String reviewStatus);
}
